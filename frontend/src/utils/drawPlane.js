// ======================================================
// Premium Betika Aviator Plane Renderer
// ======================================================

import {
    calculateAngle,
    smoothAngle,
    planeLift,
    createTrail
} from "./curveRenderer";

export function drawPlane(
    ctx,
    planeImage,
    points,
    angleRef,
    gameTime = 0,
    gamePhase = "flying"
) {

    if (!planeImage) return;
    if (!points || points.length < 2) return;

    //------------------------------------------------------
    // Use EXACTLY the last visible curve point
    //------------------------------------------------------

    //------------------------------------------------------
// Plane flies slightly ahead of the curve
//------------------------------------------------------

const tip = points[points.length - 1];
const prev = points[points.length - 2];

const dx = tip.x - prev.x;
const dy = tip.y - prev.y;

const len = Math.hypot(dx, dy) || 1;

// keep the TAIL exactly on the curve
const planeWidth = 100;

const planeX = tip.x + (dx / len) * (planeWidth * 0.50);
const planeY = tip.y + (dy / len) * (planeWidth * 0.50);

// emergency fallback
if (!Number.isFinite(planeX) || !Number.isFinite(planeY)) {
    return;
}
    //------------------------------------------------------
    // Keep plane inside graph
    //------------------------------------------------------

    const margin = 35;

    // ------------------------------------------------------
// Confine plane to the visible graph rectangle
// ------------------------------------------------------

const GRAPH_LEFT = 42;
const GRAPH_RIGHT = ctx.canvas.width - 90;

const GRAPH_TOP = 60;
const GRAPH_BOTTOM = ctx.canvas.height - 65;

const drawX = Math.max(
    GRAPH_LEFT,
    Math.min(
        GRAPH_RIGHT,
        planeX
    )
);

const drawY = Math.max(
    GRAPH_TOP,
    Math.min(
        GRAPH_BOTTOM,
        planeY
    )
);
    //------------------------------------------------------
    // Smooth rotation
    //------------------------------------------------------

    const targetAngle = calculateAngle(points);

    angleRef.current = smoothAngle(
        angleRef.current,
        targetAngle
    );

    //------------------------------------------------------
    // Plane only floats near the end
    //------------------------------------------------------

    let lift = 0;

    if (drawX > ctx.canvas.width * 0.75) {

        lift = planeLift(gameTime);

    }

    //------------------------------------------------------
    // Smoke trail
    //------------------------------------------------------

    const trail = createTrail(points);

    ctx.save();

    trail.forEach(p => {

        ctx.beginPath();

        ctx.arc(
    p.x,
    p.y,
    p.r,
    0,
    Math.PI * 2
);

        ctx.fillStyle =
            `rgba(255,70,70,${p.alpha * 0.30})`;

        ctx.fill();

    });

    ctx.restore();

    //------------------------------------------------------
    // Plane
    //------------------------------------------------------

    ctx.save();

    ctx.translate(
        drawX,
        drawY - 10 + lift
    );

    ctx.rotate(angleRef.current);

    if (gamePhase === "crashed") {

        ctx.globalAlpha = .65;

        ctx.filter =
            "grayscale(1) brightness(.45)";

    }

    ctx.shadowColor =
        gamePhase === "crashed"
            ? "#ff3300"
            : "#ff2045";

    ctx.shadowBlur =
        gamePhase === "crashed"
            ? 8
            : 18;

    const width = 100;
    const height = 28;

    ctx.drawImage(
        planeImage,
        -width / 2,
        -height / 2,
        width,
        height
    );

    ctx.restore();

}