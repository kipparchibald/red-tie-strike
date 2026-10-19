/** Pure scoring helpers (unit-tested). */

export function comboClearBonus(base: number, combo: number): number {
  const c = Math.max(0, Math.floor(combo));
  return base + c * 10;
}

export function coinPickupScore(base = 50, doubleStars = false): number {
  return base * (doubleStars ? 2 : 1);
}

export function coinBankAmount(pickups: number, doubleStars = false): number {
  return Math.max(0, pickups) * (doubleStars ? 2 : 1);
}

export function magnetPullStep(
  coinX: number,
  coinY: number,
  targetX: number,
  targetY: number,
  dt: number,
  speed = 520,
): { x: number; y: number } {
  const dx = targetX - coinX;
  const dy = targetY - coinY;
  const dist = Math.hypot(dx, dy) || 1;
  const step = speed * dt;
  if (step >= dist) return { x: targetX, y: targetY };
  return { x: coinX + (dx / dist) * step, y: coinY + (dy / dist) * step };
}

export function missionProgress(hops: number, slides: number, pops: number): number {
  return (hops >= 3 ? 1 : 0) + (slides >= 3 ? 1 : 0) + (pops >= 3 ? 1 : 0);
}
