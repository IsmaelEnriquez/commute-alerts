// Reads my commute from trips.json (private, never on GitHub) and checks it is filled in correctly.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { ALL_LINES } from "./mta.js";

const Stop = z.object({
  name: z.string(), // shown in the message, e.g. "2/3 · 96 St"
  stopId: z.string().regex(/^[A-Z0-9]{3}[NS]$/, 'should look like "120S": a station code from stops.txt plus N or S'),
  lines: z
    .array(z.string())
    .min(1)
    .refine((lines) => lines.every((line) => ALL_LINES.includes(line)), "has a line the MTA doesn't use"),
});

const Trip = z.object({
  id: z.string(), // what you type to run it, e.g. "evening"
  title: z.string(), // the message header, e.g. "Trip home"
  sendAt: z.string().regex(/^\d{2}:\d{2}$/, 'use 24-hour time like "18:30"'),
  stops: z.array(Stop).min(1),
  alerts: z.object({
    keepWords: z.array(z.string()), // always show alerts that mention these (my direction)
    skipWords: z.array(z.string()), // otherwise skip alerts that mention these (the other direction)
  }),
  // Optional: a station where I choose between my usual route and a backup.
  choice: z
    .object({
      at: z.string(), // e.g. "96 St"
      maxWaitMin: z.number().positive(), // a longer wait than this counts as delayed
      usual: z.object({ first: Stop, transferMin: z.number().min(0), then: Stop }),
      backup: Stop,
    })
    .optional(),
});

const Config = z.object({ trips: z.array(Trip).min(1) });

export type Stop = z.infer<typeof Stop>;
export type Trip = z.infer<typeof Trip>;
export type Config = z.infer<typeof Config>;

/** Checks the settings. Throws an error that names every mistake and where it is. */
export function parseConfig(data: unknown): Config {
  const result = Config.safeParse(data);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`trips.json has a problem:\n${problems.join("\n")}`);
  }
  return result.data;
}

/** Loads trips.json and finds one trip by its id. */
export function loadTrip(id: string | undefined, path = "trips.json"): Trip {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Can't find ${path}. Copy trips.example.json to ${path} and fill in your commute.`);
  }
  const config = parseConfig(JSON.parse(text));
  const trip = config.trips.find((candidate) => candidate.id === id);
  if (!trip) {
    const ids = config.trips.map((candidate) => candidate.id).join(", ");
    throw new Error(`Pick a trip: ${ids}`);
  }
  return trip;
}
