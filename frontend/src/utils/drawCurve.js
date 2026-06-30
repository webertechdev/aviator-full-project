// ======================================================
// Premium Aviator Curve Renderer
// Betika-style exponential curve
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
  // Area Fill
  //------------------------------------------------------

  ctx.save();

  ctx.beginPath();

  ctx.moveTo(points[0].x, height);

  buildSpline(ctx, points);

  ctx.lineTo(
    points[points.length - 1].x,
    height
  );

  ctx.closePath();

  const fill = ctx.createLinearGradient(
    0,
    0,
    0,
    height
  );

  if (gamePhase === "crashed") {

    fill.addColorStop(
      0,
      "rgba(255,60,60,.65)"
    );

    fill.addColorStop(
      .45,
      "rgba(160,0,0,.20)"
    );

    fill.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

  } else {

    fill.addColorStop(
      0,
      "rgba(232,0,61,.55)"
    );

    fill.addColorStop(
      .45,
      "rgba(170,0,40,.20)"
    );

    fill.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

  }

  ctx.fillStyle = fill;

  ctx.fill();

  ctx.restore();

  //------------------------------------------------------
  // Neon Glow
  //------------------------------------------------------

  ctx.save();

  ctx.beginPath();

  buildSpline(ctx, points);

  ctx.strokeStyle =
    gamePhase === "crashed"
      ? "#ff4444"
      : "#ff1248";

  ctx.lineWidth = 12;

  ctx.shadowBlur = 30;

  ctx.shadowColor = ctx.strokeStyle;

  ctx.globalAlpha = .18;

  ctx.stroke();

  ctx.restore();

  //------------------------------------------------------
  // Main Line
  //------------------------------------------------------

  ctx.save();

  ctx.beginPath();

  buildSpline(ctx, points);

  ctx.strokeStyle =
    gamePhase === "crashed"
      ? "#cc2020"
      : "#e8003d";

  ctx.lineWidth = 3.8;

  ctx.lineCap = "round";

  ctx.lineJoin = "round";

  ctx.shadowBlur = 14;

  ctx.shadowColor = ctx.strokeStyle;

  ctx.stroke();

  ctx.restore();

  //------------------------------------------------------
  // Tip Glow
  //------------------------------------------------------

  if (gamePhase !== "crashed") {

    const tip =
      points[points.length - 1];

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      tip.x,
      tip.y,
      6,
      0,
      Math.PI * 2
    );

    const g =
      ctx.createRadialGradient(
        tip.x,
        tip.y,
        0,
        tip.x,
        tip.y,
        10
      );

    g.addColorStop(0, "#ffffff");

    g.addColorStop(.35, "#ff2958");

    g.addColorStop(1, "rgba(255,0,0,0)");

    ctx.fillStyle = g;

    ctx.shadowBlur = 18;

    ctx.shadowColor = "#ff2958";

    ctx.fill();

    ctx.restore();

  }

}