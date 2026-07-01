// ======================================================
// Canvas Utilities
// ======================================================

export function resizeCanvas(canvas) {
  if (!canvas) return;

  const ratio = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();

  const width = Math.floor(rect.width * ratio);
  const height = Math.floor(rect.height * ratio);

  if (
    canvas.width !== width ||
    canvas.height !== height
  ) {
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );
  }
}

// ======================================================
// Rounded Rectangle
// ======================================================

export function roundRect(
  ctx,
  x,
  y,
  width,
  height,
  radius = 8
) {
  ctx.beginPath();

  ctx.moveTo(x + radius, y);

  ctx.lineTo(x + width - radius, y);

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );

  ctx.lineTo(
    x + width,
    y + height - radius
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );

  ctx.lineTo(
    x + radius,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );

  ctx.lineTo(
    x,
    y + radius
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  );

  ctx.closePath();
}

// ======================================================
// Clamp
// ======================================================

export function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

// ======================================================
// Lerp
// ======================================================

export function lerp(
  start,
  end,
  amount
) {
  return start + (end - start) * amount;
}
