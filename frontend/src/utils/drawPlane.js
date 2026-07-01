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

const tip = points[Math.max(points.length - 1, 0)];

const prev =
    points[Math.max(points.length - 2, 0)];

const dx = tip.x - prev.x;
const dy = tip.y - prev.y;

const len = Math.hypot(dx, dy) || 1;

//------------------------------------------------------
// Position plane from its tail, not its centre
//------------------------------------------------------

const planeWidth = 100;
const tailOffset = planeWidth * 0.42;

const planeX =
    tip.x + (dx / len) * tailOffset;

const planeY =
    tip.y + (dy / len) * tailOffset;
    //------------------------------------------------------
    // Keep plane inside graph
    //------------------------------------------------------

    const margin = 35;

    const drawX = Math.max(
    margin,
    Math.min(
        ctx.canvas.width - margin,
        planeX
    )
);

const drawY = Math.max(
    margin,
    Math.min(
        ctx.canvas.height - margin,
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
            3,
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