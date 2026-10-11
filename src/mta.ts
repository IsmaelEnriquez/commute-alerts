import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { findArrivals, type Arrival } from "./find-arrivals.js";

// The MTA splits trains into separate feeds, grouped by line.
const FEED_BASE = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2F";
const FEED_LINES: Record<string, string[]> = {
  gtfs: ["1", "2", "3", "4", "5", "6", "7", "GS"],
  "gtfs-ace": ["A", "C", "E", "H", "FS"],
  "gtfs-bdfm": ["B", "D", "F", "M"],
  "gtfs-g": ["G"],
  "gtfs-jz": ["J", "Z"],
  "gtfs-l": ["L"],
  "gtfs-nqrw": ["N", "Q", "R", "W"],
  "gtfs-si": ["SI"],
};
export const ALL_LINES = Object.values(FEED_LINES).flat();

// Service alerts (delays, track work, skipped stops) for every subway line.
export const ALERTS_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts";

/** The feed address that has a line's trains, e.g. "6" → the 1–7 feed. */
export function feedUrlFor(line: string): string {
  const feed = Object.keys(FEED_LINES).find((name) => FEED_LINES[name].includes(line));
  if (!feed) throw new Error(`Unknown subway line "${line}"`);
  return FEED_BASE + feed;
}

export async function downloadFeed(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MTA feed returned ${response.status}: ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);
}

export type Feed = Awaited<ReturnType<typeof downloadFeed>>;

/** Downloads every feed these lines need, each only once and all at the same time. */
export async function downloadFeedsFor(lines: string[]): Promise<Map<string, Feed>> {
  const urls = [...new Set(lines.map(feedUrlFor))];
  const feeds = await Promise.all(urls.map(downloadFeed));
  return new Map(urls.map((url, index) => [url, feeds[index]]));
}

/** Upcoming trains at one platform, only on the given lines. "6X" (rush-hour express 6) counts as a 6. */
export function arrivalsOn(feeds: Map<string, Feed>, stopId: string, lines: string[], now: number): Arrival[] {
  const trains = [...new Set(lines.map(feedUrlFor))].flatMap((url) => findArrivals(feeds.get(url)!, stopId, now));
  return trains
    .filter((train) => lines.includes(train.line.replace(/X$/, "")))
    .sort((a, b) => a.time - b.time);
}

// Turns seconds into a clock time like "11:05 AM", always in New York time
// (so it stays correct even if this runs on a server in another time zone).
export function clockTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Same, without AM/PM: "11:05".
export function shortTime(seconds: number): string {
  return clockTime(seconds).replace(/\s[AP]M$/, "");
}
