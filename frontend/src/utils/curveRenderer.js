// ======================================================
// Curve Renderer V2
// ======================================================

export function sampleCurve(history, width, height) {

    if (!history.length) return [];

    const left = 40;
    const right = width - 120;

    const bottom = height - 40;
    const top = 40;

    const maxTime = history[history.length - 1].t || 1;
    const maxMultiplier = Math.max(...history.map(h => h.m), 2);

    return history.map(h => {

        const x =
            left +
            (h.t / maxTime) * (right - left);

        const progress =
            Math.log(h.m) /
            Math.log(maxMultiplier);

        const y =
            bottom -
            progress * (bottom - top);

        return { x, y };

    });

}

export function buildSpline(ctx, pts) {

    if (pts.length < 2) return;

    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length; i++) {

        const midX = (pts[i - 1].x + pts[i].x) / 2;

        ctx.quadraticCurveTo(

            pts[i - 1].x,
            pts[i - 1].y,

            midX,
            (pts[i - 1].y + pts[i].y) / 2

        );

    }

    ctx.lineTo(
        pts[pts.length - 1].x,
        pts[pts.length - 1].y
    );

}

export function calculateAngle(points) {

    if (points.length < 2) return -0.3;

    const a = points[points.length - 2];
    const b = points[points.length - 1];

    return Math.atan2(
        b.y - a.y,
        b.x - a.x
    );

}

export function smoothAngle(current, target) {

    return current + (target - current) * 0.18;

}

export function planeLift() {

    return 0;

}

export function createTrail(points) {

    if (!points.length) return [];

    const last = points[points.length - 1];

    return Array.from({ length: 8 }).map((_, i) => ({

        x: last.x - i * 7,

        y: last.y,

        alpha: 1 - i / 8

    }));

}