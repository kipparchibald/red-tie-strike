import assert from "node:assert/strict";
import test from "node:test";
import {
  coinBankAmount,
  coinPickupScore,
  comboClearBonus,
  magnetPullStep,
  missionProgress,
} from "./runnerScoring";

test("comboClearBonus scales with combo", () => {
  assert.equal(comboClearBonus(40, 0), 40);
  assert.equal(comboClearBonus(40, 3), 70);
});

test("coinPickupScore doubles with power-up", () => {
  assert.equal(coinPickupScore(50, false), 50);
  assert.equal(coinPickupScore(50, true), 100);
});

test("coinBankAmount counts pickups", () => {
  assert.equal(coinBankAmount(10, false), 10);
  assert.equal(coinBankAmount(10, true), 20);
});

test("magnetPullStep moves toward target", () => {
  const next = magnetPullStep(0, 0, 100, 0, 0.1, 520);
  assert.ok(next.x > 0 && next.x <= 100);
  assert.equal(next.y, 0);
});

test("missionProgress tracks three goals", () => {
  assert.equal(missionProgress(2, 1, 1), 0);
  assert.equal(missionProgress(3, 3, 2), 2);
  assert.equal(missionProgress(3, 3, 3), 3);
});
