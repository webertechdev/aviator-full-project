import {
  doc,
  runTransaction,
  updateDoc
} from "firebase/firestore";

import { db } from "../../lib/firebase";

import {
  generateMultiplier,
  calculateMultiplier
} from "./helpers";

import { useRef } from "react";

export function useHostController(user, profile) {

    const heartbeatRef = useRef(null);
    const roundTimerRef = useRef(null);

    const HOST_TIMEOUT = 6000;

    async function tryBecomeHost(game) {

        if (!user) return false;

        const ref = doc(db, "gameState", "current");

        let success = false;

        await runTransaction(db, async tx => {

            const snap = await tx.get(ref);

            const data = snap.data();

            const heartbeat = data.hostHeartbeat || 0;

            const dead =
                Date.now() - heartbeat > HOST_TIMEOUT;

            const priority =
                profile?.role === "admin" ||
                profile?.role === "superadmin";

            if (
                !data.hostUid ||
                dead ||
                data.hostUid === user.uid ||
                priority
            ) {

                tx.update(ref, {

                    hostUid: user.uid,

                    hostRole: profile?.role || "user",

                    hostHeartbeat: Date.now()

                });

                success = true;

            }

        });

        return success;

    }

    function startHosting() {

        if (heartbeatRef.current) return;

        heartbeatRef.current = setInterval(async () => {

            try {

                await updateDoc(
                    doc(db, "gameState", "current"),
                    {
                        hostHeartbeat: Date.now()
                    }
                );

            }

            catch (err) {

                console.error(err);

            }

        }, 2000);

    }

    function stopHosting() {

        if (heartbeatRef.current) {

            clearInterval(heartbeatRef.current);

            heartbeatRef.current = null;

        }

        if (roundTimerRef.current) {

            clearInterval(roundTimerRef.current);

            roundTimerRef.current = null;

        }

    }
/* replace....
    async function hostStartRound(firebaseGame) {

        const crash = generateMultiplier();

        const duration = roundDuration(crash);

        await firebaseGame.startRound(crash);

        if (roundTimerRef.current) {

            clearTimeout(roundTimerRef.current);

        }

        roundTimerRef.current = setTimeout(async () => {

            await firebaseGame.finishRound(crash);

        }, duration);

    }
       with */
    async function hostStartRound(firebaseGame) {

    console.log("HOST START ROUND");

    const crash = generateMultiplier();

    await firebaseGame.startRound(crash);

    const started = Date.now();

    if (roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
    }

    roundTimerRef.current = setInterval(async () => {

    console.log("HOST LOOP RUNNING");

    const elapsed = Date.now() - started;

    const currentMultiplier = calculateMultiplier(elapsed);

    console.log(
        "Current:",
        currentMultiplier,
        "Crash:",
        crash
    );

    if (currentMultiplier >= crash) {

        console.log("CALLING finishRound()");

        clearInterval(roundTimerRef.current);
        roundTimerRef.current = null;

        await firebaseGame.finishRound(crash);

        return;
    }

    await firebaseGame.updateMultiplier(currentMultiplier);

}, 40);

}


    return {

        tryBecomeHost,

        startHosting,

        stopHosting,

        hostStartRound

    };

}
