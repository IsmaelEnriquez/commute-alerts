// The choice: my usual route (a first train, then a transfer to another), or the backup?

export type Settings = {
  maxWaitMin: number; // a longer wait than this counts as delayed
  transferMin: number; // riding the first train + walking to the second platform
};

export type Decision =
  | { take: "usual"; firstAt: number; thenAt: number; thenWaitMin: number }
  | { take: "backup"; reason: "no first train" }
  | { take: "backup"; reason: "first train too far"; firstWaitMin: number }
  | { take: "backup"; reason: "no second train" }
  | { take: "backup"; reason: "second train too far"; thenWaitMin: number };

/** `firstTimes` and `thenTimes` are upcoming arrival times in seconds, soonest first. */
export function decide(firstTimes: number[], thenTimes: number[], now: number, settings: Settings): Decision {
  const maxWait = settings.maxWaitMin * 60;

  // 1. Is the first train coming soon enough?
  const firstAt = firstTimes.find((time) => time >= now);
  if (firstAt === undefined) return { take: "backup", reason: "no first train" };
  if (firstAt - now > maxWait) {
    return { take: "backup", reason: "first train too far", firstWaitMin: Math.round((firstAt - now) / 60) };
  }

  // 2. When would I be standing on the second platform?
  const onSecondPlatform = firstAt + settings.transferMin * 60;

  // 3. How long would I wait there?
  const thenAt = thenTimes.find((time) => time >= onSecondPlatform);
  if (thenAt === undefined) return { take: "backup", reason: "no second train" };
  const thenWaitMin = Math.round((thenAt - onSecondPlatform) / 60);
  if (thenAt - onSecondPlatform > maxWait) return { take: "backup", reason: "second train too far", thenWaitMin };

  return { take: "usual", firstAt, thenAt, thenWaitMin };
}
