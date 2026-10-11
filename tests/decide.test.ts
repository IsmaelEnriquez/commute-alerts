import assert from "node:assert/strict";
import { test } from "node:test";
import { decide } from "../src/decide.js";

const NOW = 1_800_000_000; // a fixed "now", in seconds
const MIN = 60;
// A first train, then a transfer that takes 6 min to ride and walk to the second platform.
const SETTINGS = { maxWaitMin: 8, transferMin: 6 };

test("good day: first train soon and a short second wait means the usual route", () => {
  // first in 2 min → on the second platform at 8 min → second train at 10 min = 2 min wait
  assert.deepEqual(decide([NOW + 2 * MIN], [NOW + 10 * MIN], NOW, SETTINGS), {
    take: "usual",
    firstAt: NOW + 2 * MIN,
    thenAt: NOW + 10 * MIN,
    thenWaitMin: 2,
  });
});

test("the first train is more than 8 min away: take the backup", () => {
  assert.deepEqual(decide([NOW + 11 * MIN], [NOW + 20 * MIN], NOW, SETTINGS), {
    take: "backup",
    reason: "first train too far",
    firstWaitMin: 11,
  });
});

test("the second wait would be more than 8 min: take the backup", () => {
  // first in 2 min → second platform at 8 min. The train at 5 min is already gone; the next is at 20 = 12 min wait.
  assert.deepEqual(decide([NOW + 2 * MIN], [NOW + 5 * MIN, NOW + 20 * MIN], NOW, SETTINGS), {
    take: "backup",
    reason: "second train too far",
    thenWaitMin: 12,
  });
});

test("exactly 8 min still counts as fine", () => {
  assert.equal(decide([NOW + 8 * MIN], [NOW + 14 * MIN], NOW, SETTINGS).take, "usual");
});

test("no trains coming: take the backup", () => {
  assert.deepEqual(decide([], [NOW + 10 * MIN], NOW, SETTINGS), { take: "backup", reason: "no first train" });
  assert.deepEqual(decide([NOW + 2 * MIN], [], NOW, SETTINGS), { take: "backup", reason: "no second train" });
});
