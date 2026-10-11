import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseConfig } from "../src/config.js";

test("the example commute is filled in correctly", () => {
  const example = JSON.parse(readFileSync("trips.example.json", "utf8"));
  assert.equal(parseConfig(example).trips[0].id, "evening");
});

test("a mistake says exactly what and where", () => {
  const broken = {
    trips: [
      {
        id: "evening",
        title: "Trip home",
        sendAt: "6:30pm",
        stops: [{ name: "2/3 · 96 St", stopId: "120", lines: ["2", "Z9"] }],
        alerts: { keepWords: [], skipWords: [] },
      },
    ],
  };
  assert.throws(() => parseConfig(broken), (error: Error) => {
    assert.match(error.message, /trips\.0\.sendAt: use 24-hour time/);
    assert.match(error.message, /trips\.0\.stops\.0\.stopId: should look like "120S"/);
    assert.match(error.message, /trips\.0\.stops\.0\.lines: has a line the MTA doesn't use/);
    return true;
  });
});
