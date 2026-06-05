import { useState, useEffect, useRef, useCallback } from "react";
import { doc, onSnapshot, collection, addDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE || "https://us-central1-aviator-6827d.cloudfunctions.net";

export function useGame() {
  const { user, profile } = useAuth();
  const [round, setRound] = useState(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [gamePhase, setGamePhase] = useState("waiting"); // waiting | flying | crashed
  const [activeBet, setActiveBet] = useState(null);
  const [pastMultipliers, setPastMultipliers] = useState([]);
  const [liveBets, setLiveBets] = useState([]);
  const [error, setError] = useState(null);
  const multiplierRef = useRef(1.0);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  // Listen to current round from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "gameState", "current"), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setRound(data);

      if (data.phase === "flying") {
        setGamePhase("flying");
        startTimeRef.current = data.startTime?.toMillis?.() || Date.now();
        animateMultiplier(data.crashMultiplier);
      } else if (data.phase === "crashed") {
        setGamePhase("crashed");
        setMultiplier(data.crashMultiplier);
        cancelAnimationFrame(animFrameRef.current);
        // Add to history
        setPastMultipliers((prev) => [data.crashMultiplier, ...prev].slice(0, 20));
        setTimeout(() => {
          setGamePhase("waiting");
          setMultiplier(1.0);
          multiplierRef.current = 1.0;
        }, 3000);
      } else if (data.phase === "waiting") {
        setGamePhase("waiting");
        setMultiplier(1.0);
        multiplierRef.current = 1.0;
        cancelAnimationFrame(animFrameRef.current);
      }
    });
    return () => { unsub(); cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // Listen to live bets for this round
  useEffect(() => {
    if (!round?.roundId) return;
    const unsub = onSnapshot(
      collection(db, "bets"),
      (snap) => {
        const bets = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((b) => b.roundId === round.roundId)
          .slice(0, 50);
        setLiveBets(bets);
      }
    );
    return unsub;
  }, [round?.roundId]);

  function animateMultiplier(crashAt) {
    const startTime = Date.now();
    function tick() {
      const elapsed = (Date.now() - startTime) / 1000;
      // Exponential growth: e^(0.06 * t)
      const m = Math.min(Math.pow(Math.E, 0.06 * elapsed), crashAt);
      const rounded = Math.round(m * 100) / 100;
      multiplierRef.current = rounded;
      setMultiplier(rounded);
      if (m < crashAt) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }

  const placeBet = useCallback(async (stake, autoCashout) => {
    if (!user || !round?.roundId || gamePhase !== "waiting") return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/placeBet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, roundId: round.roundId, stake, autoCashout }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveBet({ betId: data.betId, stake, autoCashout });
    } catch (e) {
      setError(e.message);
    }
  }, [user, round, gamePhase]);

  const cashout = useCallback(async () => {
    if (!user || !activeBet || gamePhase !== "flying") return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, betId: activeBet.betId, roundId: round.roundId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveBet(null);
      return data.winnings;
    } catch (e) {
      setError(e.message);
    }
  }, [user, activeBet, round, gamePhase]);

  return { round, multiplier, gamePhase, activeBet, pastMultipliers, liveBets, error, placeBet, cashout };
}
