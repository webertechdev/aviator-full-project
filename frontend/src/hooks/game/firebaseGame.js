import { useRef } from "react";
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../lib/firebase";
import { generateMultiplier } from "./helpers";


export function useFirebaseGame() {
  //----------------------------------------------------
// Prevent animation restarting every Firestore update
//----------------------------------------------------

const startedRoundRef = useRef(null);
  //----------------------------------------------------
  // Subscribe to current game
  //----------------------------------------------------
  function subscribeToGame(setters, engines) {

    const {
        setGameState,
        setGamePhase,
        setMultiplier,
        setPastMultipliers,
        setBets
    } = setters;

    const {
        bettingEngine,
        roundEngine,
        hostController,
        firebaseGame
    } = engines;

    return onSnapshot(
        doc(db, "gameState", "current"),
        async (snapshot) => {

            if (!snapshot.exists()) {

                await bootstrapGame();

                return;

            }

            const game = snapshot.data();

            //--------------------------------------------------
            // Update UI
            //--------------------------------------------------

            setGameState(game);

            setGamePhase(game.phase);

            setMultiplier(game.multiplier || 1);

        
            //--------------------------------------------------
            // Flying
            //--------------------------------------------------

            if (game.phase === "flying") {

                if (startedRoundRef.current !== game.roundId) {

                    startedRoundRef.current = game.roundId;

                    roundEngine.onRoundStarted(

                        bettingEngine.consumeQueuedBets,

                        bettingEngine.placeBet

                    );

                }

                return;

            }

            //--------------------------------------------------
            // Crashed
            //--------------------------------------------------

            if (game.phase === "crashed") {

                setPastMultipliers(prev => [

                    game.crashMultiplier,

                    ...prev

                ].slice(0, 25));

                roundEngine.onRoundEnded(

                    bettingEngine.betsRef,

                    bettingEngine.clearBet

                );

                return;

            }

            //--------------------------------------------------
            // Waiting
            //--------------------------------------------------

            if (game.phase === "waiting") {

    startedRoundRef.current = null;

    setMultiplier(1);

    setBets([null, null]);

    const becameHost =
        await hostController.tryBecomeHost(game);

    if (becameHost) {

        hostController.startHosting();

        await hostController.hostStartRound(firebaseGame);

    }

    return;

}

        }

    );

}

  //----------------------------------------------------
  // Load history
  //----------------------------------------------------
  const loadHistory = async () => {
    const q = query(
      collection(db, "rounds"),
      orderBy("startTime", "desc"),
      limit(25)
    );

    const snap = await getDocs(q);

    return snap.docs
      .map((d) => d.data())
      .filter((r) => r.crashMultiplier);
  };

  //----------------------------------------------------
  // Bootstrap game
  //----------------------------------------------------
  const bootstrapGame = async () => {
    const ref = doc(db, "gameState", "current");

    const snap = await getDoc(ref);

    if (snap.exists()) return;

    const crash = generateMultiplier();

    await setDoc(ref, {
      phase: "waiting",
      multiplier: 1,
      crashMultiplier: crash,
      roundId: crypto.randomUUID(),
      startTime: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  };

  //----------------------------------------------------
  // Start round
  //----------------------------------------------------
 const startRound = async (crashMultiplier) => {
console.log("START ROUND FUNCTION");
  await updateDoc(
    doc(db, "gameState", "current"),
    {
      phase: "flying",
      multiplier: 1,
      crashMultiplier,
      roundId: crypto.randomUUID(),
      startTime: serverTimestamp(),
      startTimeMs: Date.now()
    }
  );
console.log("Firestore switched to flying");
};
//----------------------------------------------------
// Update multiplier during flight
//----------------------------------------------------

const updateMultiplier = async (multiplier) => {

  await updateDoc(
    doc(db, "gameState", "current"),
    {
      multiplier
    }
  );

};

  //----------------------------------------------------
  // Finish round
  //----------------------------------------------------

  const finishRound = async (multiplier) => {

    console.log("finishRound() EXECUTED");
    // Show the crash
    await updateDoc(
        doc(db, "gameState", "current"),
        {
            phase: "crashed",
            multiplier,
            endedAt: serverTimestamp()
        }
    );

    // Keep the crash visible for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Return to waiting
    await updateDoc(
        doc(db, "gameState", "current"),
        {
            phase: "waiting",
            multiplier: 1,
            crashMultiplier: generateMultiplier(),
            roundId: crypto.randomUUID(),
            startTime: serverTimestamp(),
            startTimeMs: null,
            endedAt: null
        }
    );

};
  return {
    subscribeToGame,
    loadHistory,
    bootstrapGame,
    startRound,
    updateMultiplier,
    finishRound,
};
}