// ======================================================
// curvePath.js
// Premium Aviator Flight Path
// ======================================================

export function getFlightProgress(multiplier) {

    const MAX = 70;

    return Math.max(
        0,
        Math.min(
            1,
            (multiplier - 1) / (MAX - 1)
        )
    );

}

export function getFlightPoint(progress, width, height) {

    // Graph origin
const LEFT = 42;
const BOTTOM = height - 65;

// Drawing area
// Keep the curve behind the plane
const PLANE_WIDTH = 100;
const TAIL_OFFSET = PLANE_WIDTH * 0.50;

// Curve stops before the plane nose
const RIGHT = width * 0.65 - TAIL_OFFSET;
const TOP = 50;

const usableWidth = RIGHT - LEFT;
const usableHeight = BOTTOM - TOP;

    const p0 = {
    x: LEFT,
    y: BOTTOM
};

const p1 = {
    x: LEFT + usableWidth * 0.42,
    y: BOTTOM
};

const p2 = {
    x: RIGHT,
    y: TOP
};

    const t = Math.max(0, Math.min(progress, 1));
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

    const maxMultiplier = Math.max(

        history[history.length - 1].m,

        2

    );

    return history.map(item =>
    getFlightPoint(
        Math.min(item.p ?? getFlightProgress(item.m), 1),
        width,
        height
    )
);

}