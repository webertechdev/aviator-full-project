// ======================================================
// Premium Crash Animation
// ======================================================

export function drawCrash(
  ctx,
  x,
  y,
  frame,
  multiplier
) {

  //----------------------------------------------------
  // Explosion particles
  //----------------------------------------------------

  if (frame < 24) {

    for (let i = 0; i < 14; i++) {

      const angle =
        (i / 14) * Math.PI * 2;

      const radius =
        frame * 4;

      const alpha =
        Math.max(
          0,
          1 - frame / 24
        );

      ctx.beginPath();

      ctx.arc(

        x + Math.cos(angle) * radius,

        y + Math.sin(angle) * radius,

        Math.max(
          1,
          4 - frame * .12
        ),

        0,

        Math.PI * 2

      );

      ctx.fillStyle =
        `rgba(255,${
          180 - frame * 5
        },0,${alpha})`;

      ctx.fill();

    }

  }

  //----------------------------------------------------
  // Crash Text
  //----------------------------------------------------

  ctx.save();

  const alpha =
    Math.min(1, frame / 8);

  ctx.globalAlpha = alpha;

  ctx.textAlign = "center";

  ctx.shadowColor = "#ff0000";

  ctx.shadowBlur = 28;

  ctx.fillStyle = "#ff1f1f";

  ctx.font =
    "bold 28px Orbitron";

  ctx.fillText(

    "FLEW AWAY!",

    ctx.canvas.width / 2,

    ctx.canvas.height / 2 - 12

  );

  ctx.font =
    "bold 16px Orbitron";

  ctx.fillStyle =
    "rgba(255,180,180,.95)";

  ctx.fillText(

    `${multiplier.toFixed(2)}x`,

    ctx.canvas.width / 2,

    ctx.canvas.height / 2 + 20

  );

  ctx.restore();

}