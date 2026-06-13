import { useState, useEffect, useRef, useCallback } from "react";
import {
  doc, onSnapshot, setDoc, updateDoc, collection,
  serverTimestamp, runTransaction, getDocs,
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
  const [bets, setBets] = useState([null, null]); // Each slot can have a current bet or a pending next round bet
  const [pastMultipliers, setPastMultipliers] = useState([]);
  const [liveBets, setLiveBets] = useState([]);
  const [error, setError] = useState(null);
  const [winNotif, setWinNotif] = useState(null);
  const animRef = useRef(null);
  const phaseRef = useRef("waiting");
  const roundTimerRef = useRef(null);
  const watchdogRef = useRef(null);

  const currency = { KE: "KES", TZ: "TZS", UG: "UGX" }[profile?.country] || "KES";
  const activeBalance = profile?.mode === "demo" ? (profile?.demoBalance || 0) : (profile?.balance || 0);

  // Distributed Crashing: Anyone can crash the plane if it's time
  const checkAndCrash = useCallback(async (data) => {
    if (data.phase !== "flying") return;
    const startTime = data.startTime?.toMillis?.() || Date.now();
    const crashMultiplier = data.crashMultiplier;
    const duration = Math.ceil((Math.log(crashMultiplier) / 0.06) * 1000);
    const elapsed = Date.now() - startTime;

    if (elapsed >= duration) {
      console.log("Distributed Crash: Ending round", data.roundId);
      try {
        // Use a transaction to ensure atomic update of gameState and round
        await runTransaction(db, async (t) => {
          const currentGameStateRef = doc(db, "gameState", "current");
          const currentGameStateSnap = await t.get(currentGameStateRef);
          if (currentGameStateSnap.data()?.phase === "flying" && currentGameStateSnap.data()?.roundId === data.roundId) {
            t.update(currentGameStateRef, {
              phase: "crashed",
              endTime: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            const roundRef = doc(db, "rounds", data.roundId);
            t.update(roundRef, { phase: "crashed", endTime: serverTimestamp() });
          }
        });
      } catch (e) {
        console.error("Crash takeover failed", e);
      }
    } else {
      // Schedule a local check for when it should crash
      clearTimeout(roundTimerRef.current);
      roundTimerRef.current = setTimeout(() => checkAndCrash(data), duration - elapsed + 100);
    }
  }, []);

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

      if (data.phase === "flying") {
        setGamePhase("flying");
        startAnimation(data.crashMultiplier, data.startTime?.toMillis?.() || Date.now());
        checkAndCrash(data); // Everyone watches to see if it's time to crash
      } else if (data.phase === "crashed") {
        setGamePhase("crashed");
        setMultiplier(data.crashMultiplier);
        cancelAnimationFrame(animRef.current);
        if (prev !== "crashed") {
          setPastMultipliers(p => [data.crashMultiplier, ...p].slice(0, 25));
          settleLostBets(data.roundId);
          // Move pending next round bets to current round
          setBets(prevBets => prevBets.map(bet => {
            if (bet && bet.status === "pending_next_round") {
              return { ...bet, status: "active", roundId: data.roundId }; // Assign current roundId
            }
            return bet;
          }));
          // Dynamic delay for next round based on crash multiplier
          const delay = Math.min(6000, Math.max(3000, data.crashMultiplier * 100));
          setTimeout(() => maybeStartNextRound(), delay);
        }
      } else if (data.phase === "waiting") {
        setGamePhase("waiting");
        cancelAnimationFrame(animRef.current);
        if (prev !== "waiting") {
          setMultiplier(1.0);
          // Clear current round bets, but keep pending next round bets
          setBets(prevBets => prevBets.map(bet => bet && bet.status === "pending_next_round" ? bet : null));
          setTimeout(() => maybeStartNextRound(), 4000);
        }
      }
    });
    return () => { unsub(); clearTimeout(roundTimerRef.current); cancelAnimationFrame(animRef.current); };
  }, [user, checkAndCrash]);

  // Live bets and past multipliers listeners (same as before)
  useEffect(() => {
    if (!gameState?.roundId) return;
    const q = query(collection(db, "bets"), where("roundId", "==", gameState.roundId), limit(50));
    const unsub = onSnapshot(q, snap => setLiveBets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [gameState?.roundId]);

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
    } catch {}
  }

  async function maybeStartNextRound() {
    // Only attempt to start a new round if the current phase is waiting or crashed
    if (phaseRef.current !== "waiting" && phaseRef.current !== "crashed") return;

    const lockRef = doc(db, "gameState", "lock");
    const currentGameStateRef = doc(db, "gameState", "current");

    try {
      await runTransaction(db, async (t) => {
        const lockSnap = await t.get(lockRef);
        const currentGameStateSnap = await t.get(currentGameStateRef);
        const now = Date.now();

        // Check if another client has recently acquired the lock or if the game state is not ready
        if (lockSnap.exists() && now - (lockSnap.data().at || 0) < 5000) {
          throw new Error("Lock acquired by another client");
        }
        if (currentGameStateSnap.data()?.phase === "flying") {
          throw new Error("Game already flying");
        }

        // Acquire lock
        t.set(lockRef, { at: now });

        // Start new round within the same transaction for atomicity
        const crashMultiplier = generateMultiplier();
        const roundRef = doc(collection(db, "rounds"));
        const roundId = roundRef.id;

        t.set(roundRef, { id: roundId, crashMultiplier, phase: "flying", startTime: serverTimestamp() });
        t.update(currentGameStateRef, {
          phase: "flying", roundId, crashMultiplier,
          startTime: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      });
      console.log("New round started successfully.");
    } catch (e) {
      if (e.message !== "Lock acquired by another client" && e.message !== "Game already flying") {
        console.error("Failed to start new round transaction:", e);
      }
    }
  }

  function startAnimation(crashAt, startMs) {
    cancelAnimationFrame(animRef.current);
    function tick() {
      const elapsed = (Date.now() - startMs) / 1000;
      const m = Math.min(Math.pow(Math.E, 0.06 * elapsed), crashAt);
      setMultiplier(Math.round(m * 100) / 100);

      setBets(prev => {
        prev.forEach((bet, idx) => {
          if (bet && bet.status === "active" && bet.autoCashout && m >= bet.autoCashout && !bet.cashedOut) {
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
    setBets(prev => prev.map(b => b && b.status === "active" && !b.cashedOut ? { ...b, lost: true, status: "lost" } : b));
  }

  const placeBet = useCallback(async (slotIdx, stake, autoCashout) => {
    if (!user) return setError("Please log in to place a bet.");
    if (stake > activeBalance) return setError("Insufficient balance");
    setError(null);

    const isEarlyBet = gameState?.phase === "flying";
    const betStatus = isEarlyBet ? "pending_next_round" : "active";
    const targetRoundId = isEarlyBet ? null : gameState?.roundId; // Will be updated when next round starts

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
          id: betRef.id, uid: user.uid, fullName: profile?.fullName || "Player",
          email: profile?.email || "", roundId: targetRoundId,
          stake, autoCashout: autoCashout || null, result: "pending",
          currency, mode: profile?.mode || "real", timestamp: serverTimestamp(),
          slotIdx, status: betStatus, // Store slot index and initial status
        });
        return betRef.id;
      });

      setBets(prev => {
        const next = [...prev];
        next[slotIdx] = { id: betId, stake, autoCashout, slotIdx, cashedOut: false, lost: false, status: betStatus };
        return next;
      });
      await refreshProfile();
    } catch (e) { setError(e.message); }
  }, [user, profile, gameState, activeBalance, currency, refreshProfile]);

  async function doCashout(slotIdx, bet, currentMult) {
    if (!bet || bet.cashedOut || bet.status !== "active") return;
    setBets(prev => {
      const next = [...prev];
      if (next[slotIdx]) next[slotIdx] = { ...next[slotIdx], cashedOut: true, status: "cashed_out" };
      return next;
    });

    const winnings = parseFloat((bet.stake * currentMult).toFixed(2));
    const field = profile?.mode === "demo" ? "demoBalance" : "balance";

    try {
      await runTransaction(db, async (t) => {
        const uRef = doc(db, "users", user.uid);
        const uSnap = await t.get(uRef);
        t.update(uRef, { [field]: (uSnap.data()[field] || 0) + winnings });
      });

      if (bet.id) {
        await updateDoc(doc(db, "bets", bet.id), {
          result: "won", cashedOut: true, cashoutMultiplier: currentMult,
          winnings, cashedOutAt: serverTimestamp(), status: "cashed_out",
        });
      }
      setWinNotif({ slotIdx, winnings, mult: currentMult });
      setTimeout(() => setWinNotif(null), 3000);
      await refreshProfile();
    } catch (err) { console.error("Cashout error:", err); }
  }

  const cashout = useCallback(async (slotIdx) => {
    const bet = bets[slotIdx];
    if (!bet || bet.cashedOut || bet.status !== "active" || phaseRef.current !== "flying") return;
    await doCashout(slotIdx, bet, multiplier);
  }, [bets, multiplier]);

  return { gameState, multiplier, gamePhase, bets, pastMultipliers, liveBets, error, winNotif, currency, activeBalance, placeBet, cashout };
}
