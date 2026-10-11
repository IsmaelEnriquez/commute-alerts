import assert from "node:assert/strict";
import { test } from "node:test";
import { arrivalsOn, feedUrlFor, type Feed } from "../src/mta.js";

const NOW = 1_800_000_000; // a fixed "now", in seconds

// A fake feed with one train per [line, seconds from now] at a platform.
function feed(stopId: string, trains: [string, number][]) {
  return {
    entity: trains.map(([routeId, inSeconds]) => ({
      tripUpdate: { trip: { routeId }, stopTimeUpdate: [{ stopId, arrival: { time: NOW + inSeconds } }] },
    })),
  } as unknown as Feed;
}

test("each line maps to the MTA feed that has its trains", () => {
  assert.match(feedUrlFor("6"), /nyct%2Fgtfs$/);
  assert.match(feedUrlFor("N"), /gtfs-nqrw$/);
  assert.match(feedUrlFor("D"), /gtfs-bdfm$/);
  assert.throws(() => feedUrlFor("Z9"), /Unknown subway line "Z9"/);
});

test("keeps only my lines at a platform, counts 6X as a 6, soonest first", () => {
  const feeds = new Map([[feedUrlFor("6"), feed("631S", [["4", 60], ["6X", 300], ["6", 120]])]]);
  assert.deepEqual(
    arrivalsOn(feeds, "631S", ["6"], NOW).map((train) => train.line),
    ["6", "6X"],
  );
});
