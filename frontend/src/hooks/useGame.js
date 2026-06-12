import { useState, useEffect, useRef, useCallback } from "react";
import {
  doc, onSnapshot, setDoc, updateDoc, collection,
  addDoc, serverTimestamp, runTransaction, getDocs,
  query, where, orderBy, limit, getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

function generateMultiplier() {
  const r = Math.random();
  let raw;
  if (r < 0.70) raw = 1 + Math.random() * 2;
  else if (r < 0.95) raw = 3 + Math.random() * 17;
  else raw = 20 + Math.random() * 180;
  return Math.max(1.01, parseFloat((raw * 0.95).toFixed(2)));
}

export function useGame() {
  const { user, profile, refreshProfile } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [gamePhase, setGamePhase] = useState("waiting");
  const [bets, setBets] = useState([null, null]); // two bet slots
  const [pastMultipliers, setPastMultipliers] = useState([]);
  const [liveBets, setLiveBets] = useState([]);
  const [error, setError] = useState(null);
  const [winNotif, setWinNotif] = useState(null);
  const animRef = useRef(null);
  const phaseRef = useRef("waiting");
  const isLeaderRef = useRef(false);
  const roundTimerRef = useRef(null);

  const currency = { KE: "KES", TZ: "TZS", UG: "UGX" }[profile?.country] || "KES";
  const activeBalance = profile?.mode === "demo" ? (profile?.demoBalance || 0) : (profile?.balance || 0);

  // Listen to gameState
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "gameState", "current"), async (snap) => {
      if (!snap.exists()) {
        await tryBootstrap();
        return;
      }
      const data = snap.data();
      setGameState(data);
      const prev = phaseRef.current;
      phaseRef.current = data.phase;

      if (data.phase === "flying" && prev !== "flying") {
        setGamePhase("flying");
        startAnimation(data.crashMultiplier, data.startTime?.toMillis?.() || Date.now());
      } else if (data.phase === "crashed" && prev !== "crashed") {
        setGamePhase("crashed");
        setMultiplier(data.crashMultiplier);
        cancelAnimationFrame(animRef.current);
        setPastMultipliers(p => [data.crashMultiplier, ...p].slice(0, 25));
        settleLostBets(data.roundId);
        roundTimerRef.current = setTimeout(() => maybeStartNextRound(), 5000);
      } else if (data.phase === "waiting") {
        setGamePhase("waiting");
        cancelAnimationFrame(animRef.current);
        if (prev !== "waiting") {
          setMultiplier(1.0);
          setBets([null, null]);
        }
      }
    });
    return () => { unsub(); clearTimeout(roundTimerRef.current); cancelAnimationFrame(animRef.current); };
  }, [user]);

  // Listen to live bets
  useEffect(() => {
    if (!gameState?.roundId) return;
    const q = query(collection(db, "bets"), where("roundId", "==", gameState.roundId), limit(50));
    const unsub = onSnapshot(q, snap => {
      setLiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [gameState?.roundId]);

  // Load past multipliers on mount
  useEffect(() => {
    (async () => {
      const q = query(collection(db, "rounds"), orderBy("startTime", "desc"), limit(25));
      const snap = await getDocs(q);
      setPastMultipliers(snap.docs.map(d => d.data().crashMultiplier).filter(Boolean));
    })();
  }, []);

  async function tryBootstrap() {
    try {
      await setDoc(doc(db, "gameState", "current"), {
        phase: "waiting", roundId: null, crashMultiplier: null,
        startTime: null, updatedAt: serverTimestamp(),
      }, { merge: true });
      setTimeout(() => maybeStartNextRound(), 3000);
    } catch {}
  }

  async function maybeStartNextRound() {
    const lockRef = doc(db, "gameState", "lock");
    try {
      await runTransaction(db, async (t) => {
        const lockSnap = await t.get(lockRef);
        const now = Date.now();
        if (lockSnap.exists() && now - (lockSnap.data().at || 0) < 8000) {
          throw new Error("Another client is starting the round");
        }
        t.set(lockRef, { at: now });
      });
      startNewRound();
    } catch {}
  }

  async function startNewRound() {
    const crashMultiplier = generateMultiplier();
    const roundRef = doc(collection(db, "rounds"));
    const roundId = roundRef.id;

    await setDoc(roundRef, {
      id: roundId, crashMultiplier, phase: "flying",
      startTime: serverTimestamp(),
    });

    await setDoc(doc(db, "gameState", "current"), {
      phase: "flying", roundId, crashMultiplier,
      startTime: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    const duration = Math.ceil((Math.log(crashMultiplier) / 0.06) * 1000);
    roundTimerRef.current = setTimeout(async () => {
      await setDoc(doc(db, "gameState", "current"), {
        phase: "crashed", roundId, crashMultiplier,
        startTime: (await getDoc(doc(db, "gameState", "current"))).data().startTime,
        endTime: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await updateDoc(roundRef, { phase: "crashed", endTime: serverTimestamp() });
    }, duration);
  }

  function startAnimation(crashAt, startMs) {
    cancelAnimationFrame(animRef.current);
    function tick() {
      const elapsed = (Date.now() - startMs) / 1000;
      const m = Math.min(Math.pow(Math.E, 0.06 * elapsed), crashAt);
      setMultiplier(Math.round(m * 100) / 100);

      // Auto-cashout check
      setBets(prev => {
        prev.forEach((bet, idx) => {
          if (bet && bet.autoCashout && m >= bet.autoCashout && !bet.cashedOut) {
            doCashout(idx, bet, m);
          }
        });
        return prev;
      });

      if (m < crashAt) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
  }

  async function settleLostBets(roundId) {
    setBets(prev => prev.map(b => b && !b.cashedOut ? { ...b, lost: true } : b));
  }

  const placeBet = useCallback(async (slotIdx, stake, autoCashout) => {
    if (!user || gamePhase !== "waiting")
      return setError("Wait for next round");

    if (stake > activeBalance)
      return setError("Insufficient balance");

    if (!gameState)
      return setError("Game unavailable");

    setError(null);

    const field = profile?.mode === "demo" ? "demoBalance" : "balance";

    try {
      const betId = await runTransaction(db, async (t) => {
        const uRef = doc(db, "users", user.uid);
        const uSnap = await t.get(uRef);

        const bal = uSnap.data()[field];
        if (stake > bal) throw new Error("Insufficient balance");

        const betRef = doc(collection(db, "bets"));
        t.update(uRef, { [field]: bal - stake });
        t.set(betRef, {
          id: betRef.id,
          uid: user.uid,
          fullName: profile?.fullName || "Player",
          email: profile?.email || "",
          roundId: gameState?.roundId || null,
          stake,
          autoCashout: autoCashout || null,
          result: "pending",
          currency,
          mode: profile?.mode || "real",
          timestamp: serverTimestamp(),
        });
        return betRef.id;
      });

      setBets(prev => {
        const next = [...prev];
        next[slotIdx] = {
          id: betId,
          stake,
          autoCashout,
          slotIdx,
          cashedOut: false,
          lost: false,
        };
        return next;
      });

      await refreshProfile();
    } catch (e) {
      setError(e.message);
    }
  }, [user, profile, gamePhase, gameState, activeBalance, currency]);

  async function doCashout(slotIdx, bet, currentMult) {
    if (!bet || bet.cashedOut) return;

    setBets(prev => {
      const next = [...prev];
      if (next[slotIdx]) next[slotIdx] = { ...next[slotIdx], cashedOut: true };
      return next;
    });

    const winnings = parseFloat((bet.stake * currentMult).toFixed(2));
    const field = profile?.mode === "demo" ? "demoBalance" : "balance";

    try {
      await runTransaction(db, async (t) => {
        const uRef = doc(db, "users", user.uid);
        const uSnap = await t.get(uRef);

        t.update(uRef, {
          [field]: (uSnap.data()[field] || 0) + winnings,
        });
      });

      if (bet.id) {
        await updateDoc(doc(db, "bets", bet.id), {
          result: "won",
          cashedOut: true,
          cashoutMultiplier: currentMult,
          winnings,
          cashedOutAt: serverTimestamp(),
        });
      }

      setWinNotif({ slotIdx, winnings, mult: currentMult });
      setTimeout(() => setWinNotif(null), 3000);

      await refreshProfile();
    } catch (err) {
      console.error("Cashout error:", err);
    }
  }

  const cashout = useCallback(async (slotIdx) => {
    const bet = bets[slotIdx];
    if (!bet || bet.cashedOut || gamePhase !== "flying") return;
    await doCashout(slotIdx, bet, multiplier);
  }, [bets, multiplier, gamePhase]);

  return {
    gameState,
    multiplier,
    gamePhase,
    bets,
    pastMultipliers,
    liveBets,
    error,
    winNotif,
    currency,
    activeBalance,
    placeBet,
    cashout,
  };
}
