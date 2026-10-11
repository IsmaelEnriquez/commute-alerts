// Only the parts of the MTA feed we read. The real decoded feed fits this shape,
// and tests can pass a small plain object instead of live data.
type Feed = {
  entity: {
    tripUpdate?: {
      trip: { routeId?: string | null };
      stopTimeUpdate?: {
        stopId?: string | null;
        arrival?: { time?: unknown } | null;
        departure?: { time?: unknown } | null;
      }[] | null;
    } | null;
  }[];
};

export type Arrival = { line: string; time: number };

// The feed stores times as "seconds since 1970", sometimes as a special Long number.
// This turns them into a regular number.
export function toSeconds(value: unknown): number {
  return value == null ? 0 : Number(String(value));
}

/** Upcoming trains at one platform (e.g. "120S"), soonest first. `now` is in seconds. */
export function findArrivals(feed: Feed, stopId: string, now: number): Arrival[] {
  const arrivals: Arrival[] = [];
  for (const entity of feed.entity) {
    const trip = entity.tripUpdate;
    if (!trip) continue; // some entries aren't trains; skip them

    const line = trip.trip.routeId ?? "?";
    for (const stop of trip.stopTimeUpdate ?? []) {
      if (stop.stopId !== stopId) continue;
      const time = toSeconds(stop.arrival?.time ?? stop.departure?.time);
      if (time > now) arrivals.push({ line, time });
    }
  }
  return arrivals.sort((a, b) => a.time - b.time);
}
