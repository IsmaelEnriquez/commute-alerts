import assert from "node:assert/strict";
import { test } from "node:test";
import { findArrivals } from "../src/find-arrivals.js";

const NOW = 1_800_000_000; // a fixed "now", in seconds

test("keeps only future trains at my platform, soonest first", () => {
  const feed = {
    entity: [
      { tripUpdate: { trip: { routeId: "1" }, stopTimeUpdate: [{ stopId: "120S", arrival: { time: NOW + 600 } }] } },
      {
        tripUpdate: {
          trip: { routeId: "1" },
          stopTimeUpdate: [
            { stopId: "119S", arrival: { time: NOW + 60 } }, // a different station
            { stopId: "120S", arrival: { time: NOW + 120 } },
          ],
        },
      },
      { tripUpdate: { trip: { routeId: "1" }, stopTimeUpdate: [{ stopId: "120S", arrival: { time: NOW - 30 } }] } }, // already left
      {}, // not a train (e.g. an alert)
    ],
  };

  assert.deepEqual(findArrivals(feed, "120S", NOW), [
    { line: "1", time: NOW + 120 },
    { line: "1", time: NOW + 600 },
  ]);
});

test("returns an empty list when no trains are coming", () => {
  assert.deepEqual(findArrivals({ entity: [] }, "120S", NOW), []);
});
