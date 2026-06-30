import { useEffect, useRef, useState } from "react";

import { calculateMultiplier } from "./helpers";

export function useAnimationEngine() {

    const frameRef = useRef(null);

    const startTimeRef = useRef(0);

    const crashRef = useRef(1);

    const runningRef = useRef(false);

    const [multiplier, setMultiplier] = useState(1);

    //--------------------------------------------------

    const stopAnimation = () => {

    runningRef.current = false;

    if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
    }

};

    //--------------------------------------------------

    const animate = () => {

    if (!runningRef.current) return;

    const elapsed =
        Date.now() - startTimeRef.current;

    const current =
        calculateMultiplier(elapsed);

    if (current >= crashRef.current) {

        setMultiplier(crashRef.current);

        stopAnimation();

        return;

    }

    setMultiplier(current);

    frameRef.current =
        requestAnimationFrame(animate);

};
    //--------------------------------------------------

    const startAnimation = (crashMultiplier) => {

    stopAnimation();

    crashRef.current = crashMultiplier;

    startTimeRef.current = Date.now();
    

    runningRef.current = true;

    setMultiplier(prev => prev);

    frameRef.current = requestAnimationFrame(animate);

};
    //--------------------------------------------------

    useEffect(() => {

        return () => stopAnimation();

    }, []);

    return {

    multiplier,

    setMultiplier,

    startAnimation,

    stopAnimation,

    isRunning: runningRef

};
}