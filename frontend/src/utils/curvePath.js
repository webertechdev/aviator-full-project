// ======================================================
// curvePath.js
// Betika-style quadratic flight path
// ======================================================

export function getFlightProgress(multiplier, maxMultiplier) {

    if (maxMultiplier <= 1) return 0;

    return Math.max(
        0,
        Math.min(
            1,
            (multiplier - 1) / (maxMultiplier - 1)
        )
    );

}

export function getFlightPoint(progress, width, height) {

    const LEFT = 0;
const BOTTOM = height - 60;

    const usableWidth = width - LEFT - 140;
    const usableHeight = height - 140;

    const p0 = {
        x: LEFT,
        y: BOTTOM
    };

    const p1 = {
        x: LEFT + usableWidth * 0.40,
        y: BOTTOM
    };

    const p2 = {
        x: LEFT + usableWidth,
        y: BOTTOM - usableHeight
    };

    const t = Math.max(0, Math.min(1, progress));
    const omt = 1 - t;

    return {

        x:
            omt * omt * p0.x +
            2 * omt * t * p1.x +
            t * t * p2.x,

        y:
            omt * omt * p0.y +
            2 * omt * t * p1.y +
            t * t * p2.y

    };

}

export function buildFlightCurve(history, width, height) {

    if (!history.length) return [];

    const maxMultiplier =
history[history.length - 1].m;

    return history.map(point => {

        const progress =
            getFlightProgress(
                point.m,
                maxMultiplier
            );

        return getFlightPoint(
            progress,
            width,
            height
        );

    });

}