import assert from "node:assert/strict";
import { test } from "node:test";
import { findAlerts, isOtherDirection } from "../src/find-alerts.js";

const NOW = 1_800_000_000; // a fixed "now", in seconds
const HOUR = 3600;

// Builds a fake alert so each test case stays one line.
function alert(routeId: string, text: string, start?: number, end?: number) {
  return {
    alert: {
      informedEntity: [{ routeId }],
      activePeriod: start === undefined ? [] : [{ start, end }],
      headerText: { translation: [{ text, language: "en" }] },
    },
  };
}

test("keeps alerts on my lines that are happening now, each once", () => {
  const feed = {
    entity: [
      alert("2", "2 trains are delayed", NOW - HOUR, NOW + HOUR), // now, my line
      alert("7X", "Express 7 runs local", NOW - HOUR), // now, no end yet
      alert("Q", "Q trains skip 7 Av"), // no period = always
      alert("L", "No L trains"), // not my line
      alert("2", "Track work next weekend", NOW + 24 * HOUR, NOW + 48 * HOUR), // future
      alert("A", "2 trains are delayed", NOW - HOUR, NOW + HOUR), // same headline again
      {}, // not an alert
    ],
  };

  assert.deepEqual(findAlerts(feed, ["2", "7", "A", "Q"], NOW), [
    "2 trains are delayed",
    "Express 7 runs local",
    "Q trains skip 7 Av",
  ]);
});

test("drops alerts about the other direction, keeps my direction and both-direction ones", () => {
  const skip = ["Uptown", "Woodlawn-bound"];
  const keep = ["Downtown"];
  // Real MTA headlines.
  assert.equal(isOtherDirection("In the Bronx, Woodlawn-bound [4] skips Burnside Av", skip, keep), true);
  assert.equal(isOtherDirection("Uptown [6] trains are running with delays after a door problem", skip, keep), true);
  assert.equal(isOtherDirection("Downtown [A][C][D] trains are running with delays", skip, keep), false);
  assert.equal(isOtherDirection("[5] runs local in both directions between 125 St and Grand Central-42 St", skip, keep), false);
  assert.equal(isOtherDirection("No [6] between Hunts Point Av and 125 St", skip, keep), false);
  assert.equal(isOtherDirection("Uptown and downtown [6] trains skip 116 St", skip, keep), false);
});
