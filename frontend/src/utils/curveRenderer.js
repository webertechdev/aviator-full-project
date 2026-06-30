// ===============================================
// Curve Renderer
// Generates the smooth Betika-style flight curve
// ===============================================

export function visualMultiplier(m) {
  return Math.log(m + 1);
}

export function sampleCurve(history, width, height) {
  console.log("sampleCurve history:", history);
  if (!history.length) return [];

  const padding = 40;

  const maxTime = history[history.length - 1].t || 1;
  const maxMultiplier = Math.max(...history.map(p => p.m), 2);

  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const filtered = history.filter((_, i) => i % 4 === 0);

return filtered.map(point => {
    const x =
      padding +
      (point.t / maxTime) *
        drawWidth;

    const scaled =
      visualMultiplier(point.m);

    const scaledMax =
      visualMultiplier(maxMultiplier);

    const y =
      height -
      padding -
      (scaled / scaledMax) *
        drawHeight;

    return { x, y };
  });
}

// ------------------------------------------------
// Smooth Catmull-Rom spline
// ------------------------------------------------

export function buildSpline(ctx, points) {

    if (points.length < 2) return;

  for (let i = 0; i < points.length - 1; i++) {

    const p0 =
      points[i - 1] || points[i];

    const p1 =
      points[i];

    const p2 =
      points[i + 1];

    const p3 =
      points[i + 2] || p2;

    const cp1x =
      p1.x +
      (p2.x - p0.x) / 6;

    const cp1y =
      p1.y +
      (p2.y - p0.y) / 6;

    const cp2x =
      p2.x -
      (p3.x - p1.x) / 6;

    const cp2y =
      p2.y -
      (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      p2.x,
      p2.y
    );
  }
}

// ------------------------------------------------
// Plane direction
// ------------------------------------------------

export function calculateAngle(points) {

  if (points.length < 3)
    return -0.35;

  const a =
    points[points.length - 3];

  const b =
    points[points.length - 1];

  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

  let angle =
    Math.atan2(dy, dx);

  angle =
    Math.max(
      -1.0,
      Math.min(-0.05, angle)
    );

  return angle;
}

// ------------------------------------------------
// Smooth angle interpolation
// ------------------------------------------------

export function smoothAngle(current, target) {
  return current + (target - current) * 0.15;
}

// ------------------------------------------------
// Plane floating motion
// ------------------------------------------------

export function planeLift(time) {
  return Math.sin(time * 5) * 2;
}

// ------------------------------------------------
// Smoke trail
// ------------------------------------------------

export function createTrail(points) {

  if (!points.length)
    return [];

  const last =
    points[points.length - 1];

  return Array.from(
    { length: 12 },
    (_, i) => ({
      x: last.x - i * 8,
      y: last.y + i * 2,
      alpha: 1 - i / 12
    })
  );
}