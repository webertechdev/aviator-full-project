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

  if (!points.length) return;

  //------------------------------------------------------
  // Plane Position
  //------------------------------------------------------

  const tip = points[points.length - 1];

  //------------------------------------------------------
  // Smooth Rotation
  //------------------------------------------------------

  const targetAngle =
    calculateAngle(points);

  angleRef.current =
    smoothAngle(
      angleRef.current,
      targetAngle
    );

  //------------------------------------------------------
  // Floating Lift
  //------------------------------------------------------

  const lift =
    planeLift(gameTime);

  //------------------------------------------------------
  // Engine Trail
  //------------------------------------------------------

  const trail =
    createTrail(points);

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
      `rgba(255,70,70,${p.alpha * .30})`;

    ctx.fill();

  });

  ctx.restore();

  //------------------------------------------------------
  // Draw Aircraft
  //------------------------------------------------------

  ctx.save();

  ctx.translate(

    tip.x,

    tip.y - 10 + lift

  );

  ctx.rotate(angleRef.current);

  //------------------------------------------------------

  if (gamePhase === "crashed") {

    ctx.globalAlpha = .65;

    ctx.filter =
      "grayscale(1) brightness(.45)";

  }

  //------------------------------------------------------

  ctx.shadowColor =
    gamePhase === "crashed"
      ? "#ff3300"
      : "#ff2045";

  ctx.shadowBlur =
    gamePhase === "crashed"
      ? 8
      : 18;

  const width = 105;

  const height = 28;

  ctx.drawImage(

    planeImage,

    -width / 2,

    -height / 2,

    width,

    height

  );

  ctx.filter = "none";

  ctx.globalAlpha = 1;

  ctx.restore();

}