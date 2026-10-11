import assert from "node:assert/strict";
import { test } from "node:test";
import { dueNow, isAlertDay, nyTime, weekOf } from "../src/schedule.js";

const SUNDAY_9PM = { weekday: "Sun", time: "21:00" };
const TRIPS = [
  { id: "morning", sendAt: "06:45" },
  { id: "evening", sendAt: "18:30" },
];
// Picked on Sunday Oct 11, 2026 for the week of Mon Oct 12 – Sun Oct 18.
const PLAN = { weekOf: "2026-10-11", days: ["Tue", "Thu", "Fri"] };

test("reads New York time, even across daylight saving", () => {
  assert.deepEqual(nyTime(new Date("2026-10-13T22:30:00Z")), { date: "2026-10-13", weekday: "Tue", time: "18:30" });
  assert.deepEqual(nyTime(new Date("2026-12-01T23:30:00Z")), { date: "2026-12-01", weekday: "Tue", time: "18:30" });
});

test("a week starts on the most recent Sunday", () => {
  assert.equal(weekOf({ date: "2026-10-11", weekday: "Sun", time: "21:00" }), "2026-10-11");
  assert.equal(weekOf({ date: "2026-10-14", weekday: "Wed", time: "12:00" }), "2026-10-11");
});

test("alerts only on picked days, and only for that week", () => {
  assert.equal(isAlertDay(PLAN, { date: "2026-10-13", weekday: "Tue", time: "18:30" }), true);
  assert.equal(isAlertDay(PLAN, { date: "2026-10-14", weekday: "Wed", time: "18:30" }), false); // not picked
  assert.equal(isAlertDay(PLAN, { date: "2026-10-20", weekday: "Tue", time: "18:30" }), false); // next week, not asked yet
  assert.equal(isAlertDay(null, { date: "2026-10-13", weekday: "Tue", time: "18:30" }), false); // never picked
});

test("sends each briefing at its time on picked days, and the question on Sunday at 9 PM", () => {
  assert.deepEqual(dueNow({ date: "2026-10-13", weekday: "Tue", time: "06:45" }, TRIPS, PLAN, SUNDAY_9PM), ["morning"]);
  assert.deepEqual(dueNow({ date: "2026-10-13", weekday: "Tue", time: "18:30" }, TRIPS, PLAN, SUNDAY_9PM), ["evening"]);
  assert.deepEqual(dueNow({ date: "2026-10-13", weekday: "Tue", time: "18:31" }, TRIPS, PLAN, SUNDAY_9PM), []);
  assert.deepEqual(dueNow({ date: "2026-10-14", weekday: "Wed", time: "18:30" }, TRIPS, PLAN, SUNDAY_9PM), []);
  assert.deepEqual(dueNow({ date: "2026-10-18", weekday: "Sun", time: "21:00" }, TRIPS, PLAN, SUNDAY_9PM), ["week-question"]);
});
