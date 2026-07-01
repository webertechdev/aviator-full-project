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
    // Faster explosion
    //----------------------------------------------------

    const maxFrames = 18;

    if (frame < maxFrames) {

        for (let i = 0; i < 20; i++) {

            const angle =
                (i / 20) * Math.PI * 2;

            const radius =
                frame * 5;

            const alpha =
                Math.max(
                    0,
                    1 - frame / maxFrames
                );

            ctx.beginPath();

            ctx.arc(

                x + Math.cos(angle) * radius,

                y + Math.sin(angle) * radius,

                Math.max(
                    1.5,
                    5 - frame * 0.18
                ),

                0,

                Math.PI * 2

            );

            ctx.fillStyle =
                `rgba(255,${180 - frame * 6},20,${alpha})`;

            ctx.fill();

        }

    }

    //----------------------------------------------------
    // Shockwave
    //----------------------------------------------------

    if (frame < 10) {

        ctx.save();

        ctx.beginPath();

        ctx.arc(

            x,

            y,

            frame * 10,

            0,

            Math.PI * 2

        );

        ctx.strokeStyle =
            `rgba(255,80,80,${1 - frame / 10})`;

        ctx.lineWidth = 3;

        ctx.stroke();

        ctx.restore();

    }

    //----------------------------------------------------
    // Crash Text
    //----------------------------------------------------

    ctx.save();

    const alpha =
        Math.min(1, frame / 5);

    ctx.globalAlpha = alpha;

    ctx.textAlign = "center";

    ctx.shadowColor = "#ff2d2d";

    ctx.shadowBlur = 30;

    ctx.fillStyle = "#ff1c1c";

    ctx.font = "bold 30px Orbitron";

    ctx.fillText(

        "FLEW AWAY!",

        ctx.canvas.width / 2,

        ctx.canvas.height / 2 - 18

    );

    ctx.font = "bold 18px Orbitron";

    ctx.fillStyle = "#ffd9d9";

    ctx.fillText(

        `${multiplier.toFixed(2)}x`,

        ctx.canvas.width / 2,

        ctx.canvas.height / 2 + 18

    );

    ctx.restore();

}