// ======================================================
// Premium Aviator Curve Renderer
// Thin Betika-style curve
// ======================================================

import { buildSpline } from "./curveRenderer";

export function drawCurve(
    ctx,
    points,
    width,
    height,
    gamePhase = "flying"
) {
    if (!points || points.length < 2) return;

    //------------------------------------------------------
    // Deep shaded region
    //------------------------------------------------------

    ctx.save();

    ctx.beginPath();

// start directly under the first point
ctx.moveTo(points[0].x, height);

// left edge
ctx.lineTo(points[0].x, points[0].y);

// curve
buildSpline(ctx, points);

// go straight down from the last curve point
ctx.lineTo(
    points[points.length - 1].x,
    height
);

// return along the bottom
ctx.lineTo(
    points[0].x,
    height
);

ctx.closePath();

    const fill = ctx.createLinearGradient(
        0,
        points[0].y,
        0,
        height
    );

    if (gamePhase === "crashed") {

        fill.addColorStop(0, "rgba(255,25,25,0.72)");
        fill.addColorStop(0.45, "rgba(185,0,0,0.55)");
        fill.addColorStop(1, "rgba(70,0,0,0)");

    } else {

        fill.addColorStop(0, "rgba(235,0,55,0.72)");
        fill.addColorStop(0.45, "rgba(165,0,35,0.58)");
        fill.addColorStop(1, "rgba(60,0,0,0)");

    }

    ctx.fillStyle = fill;
    ctx.fill();

    ctx.restore();

    //------------------------------------------------------
    // Thin premium curve
    //------------------------------------------------------

    ctx.save();

    ctx.beginPath();

    ctx.moveTo(points[0].x, points[0].y);

    buildSpline(ctx, points);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // soft glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff0b47";

    // thin outer glow
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,0,70,0.45)";
    ctx.stroke();

    // main thin line
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    buildSpline(ctx, points);

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#ff1a5e";
    ctx.stroke();

    // bright highlight
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    buildSpline(ctx, points);

    ctx.lineWidth = 0.9;
    ctx.strokeStyle = "#f6063a";
    ctx.globalAlpha = 0.8;
    ctx.stroke();

    ctx.restore();
}