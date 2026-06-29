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
  // Subscribe to current game
  //----------------------------------------------------
  const subscribeToGame = (
    setters,
    engines
  ) => {
    const {
      setGameState,
      setGamePhase,
      setMultiplier,
      setPastMultipliers,
      setBets,
      setQueuedBets,
      betsRef,
    } = setters;

    const {

    animationEngine,

    roundEngine,

    bettingEngine,

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

        setGameState(game);
        setGamePhase(game.phase);
        // ----------------------------------------------------
// deleted Host election
// ----------------------------------------------------


       if (game.phase === "flying") {

    animationEngine.startAnimation(
        game.crashMultiplier
    );

    roundEngine.onRoundStarted(

    bettingEngine.consumeQueuedBets,

    bettingEngine.placeBet

);
    //--------------------------------------------------
// deleted Restore active bets from Firestore
//--------------------------------------------------


    //--------------------------------------------------
    // Host disappeared while round flying
    //--------------------------------------------------

    /*
    const hb = game.hostHeartbeat?.toMillis
        ? game.hostHeartbeat.toMillis()
        : game.hostHeartbeat || 0;

    const dead =
        Date.now() - hb > 5000;

    if (dead) {

        const host =
    await hostController.tryBecomeHost(game);

        if (host) {

            await firebaseGame.finishRound(
                game.crashMultiplier
            );

            return;

        }

    }
*/

}
        if (game.phase === "waiting") {
          animationEngine.stopAnimation();

          animationEngine.setMultiplier(1);

          setBets([null, null]);
        }

        if (game.phase === "crashed") {

    animationEngine.stopAnimation();

    setMultiplier(game.crashMultiplier);

    setPastMultipliers(prev => [
        game.crashMultiplier,
        ...prev
    ].slice(0, 25));

    roundEngine.onRoundEnded(
        bettingEngine.betsRef,
        bettingEngine.clearBet
    );

    // deleted Host starts the next round
    

}


      }
    );
  };

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
  // Finish round
  //----------------------------------------------------
  const finishRound = async (multiplier) => {

  await updateDoc(
    doc(db, "gameState", "current"),
    {
      phase: "crashed",
      multiplier,
      endedAt: serverTimestamp()
    }
  );

};
  return {
    subscribeToGame,
    loadHistory,
    bootstrapGame,
    startRound,
    finishRound,
  };
}