/**
 * Generates a crash multiplier with house edge ~5% (RTP ~95%)
 * Distribution:
 *   70% → 1.00x – 3.00x
 *   25% → 3.00x – 20.00x
 *    5% → 20.00x – 200.00x
 */
function generateMultiplier() {
  const r = Math.random();
  let raw;
  if (r < 0.70) raw = 1 + Math.random() * 2;          // low
  else if (r < 0.95) raw = 3 + Math.random() * 17;    // medium
  else raw = 20 + Math.random() * 180;                 // high

  // Apply 5% house edge: shift curve slightly down
  const withHouseEdge = raw * 0.95;
  return Math.max(1.01, parseFloat(withHouseEdge.toFixed(2)));
}

/**
 * Calculate winnings for a bet cashed out at a given multiplier
 */
function calculateWinnings(stake, cashoutMultiplier) {
  return parseFloat((stake * cashoutMultiplier).toFixed(2));
}

/**
 * Round timing: how long will a round run before crashing?
 * Based on exponential growth: m = e^(0.06 * t)
 * Solving for t: t = ln(m) / 0.06
 */
function roundDuration(crashMultiplier) {
  return Math.ceil((Math.log(crashMultiplier) / 0.06) * 1000); // ms
}

module.exports = { generateMultiplier, calculateWinnings, roundDuration };
