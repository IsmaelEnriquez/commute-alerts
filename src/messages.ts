// Builds the text of each message. Used by the command-line tools and by the Discord bot.
import type { Trip } from "./config.js";
import { decide } from "./decide.js";
import { findAlerts, isOtherDirection } from "./find-alerts.js";
import { ALERTS_URL, arrivalsOn, clockTime, downloadFeed, downloadFeedsFor, shortTime } from "./mta.js";

/** Alerts plus the next trains at every stop on the trip. */
export async function briefingMessage(trip: Trip): Promise<string> {
  const myLines = [...new Set(trip.stops.flatMap((stop) => stop.lines))];

  // 1. Download the train feeds this trip needs and the alerts feed, all at the same time.
  const [feeds, alertsFeed] = await Promise.all([downloadFeedsFor(myLines), downloadFeed(ALERTS_URL)]);
  const now = Date.now() / 1000;
  const lines = [`🚇 ${trip.title} · ${clockTime(now)}`];

  // 2. Alerts first: anything happening now on my lines, in my direction.
  const alerts = findAlerts(alertsFeed, myLines, now).filter(
    (headline) => !isOtherDirection(headline, trip.alerts.skipWords, trip.alerts.keepWords),
  );
  if (alerts.length > 0) {
    lines.push("", "⚠️ Alerts", ...alerts.map((alert) => `• ${alert}`));
  }

  // 3. For each stop on the trip, the next 3 trains on the lines I take there.
  for (const stop of trip.stops) {
    const trains = arrivalsOn(feeds, stop.stopId, stop.lines, now).slice(0, 3);
    lines.push("", stop.name);
    if (trains.length === 0) {
      lines.push("   no trains");
    }
    for (const train of trains) {
      // Only name the line when more than one line stops here (like the 2/3 at 96 St).
      const line = stop.lines.length > 1 ? `${train.line} ` : "";
      const minutes = Math.round((train.time - now) / 60);
      lines.push(`   ${line}in ${minutes} min (${shortTime(train.time)})`);
    }
  }
  return lines.join("\n");
}

/** The decision at the trip's choice station: the usual route or the backup. */
export async function choiceMessage(trip: Trip): Promise<string> {
  const choice = trip.choice;
  if (!choice) throw new Error(`The "${trip.id}" trip has no choice set up in trips.json.`);
  const { first, then } = choice.usual;
  const backup = choice.backup;

  // 1. Download the feeds for every line in the choice.
  const feeds = await downloadFeedsFor([...first.lines, ...then.lines, ...backup.lines]);
  const now = Date.now() / 1000;

  // 2. Upcoming trains at each platform I might use.
  const firstTrains = arrivalsOn(feeds, first.stopId, first.lines, now);
  const thenTrains = arrivalsOn(feeds, then.stopId, then.lines, now);
  const backupTrains = arrivalsOn(feeds, backup.stopId, backup.lines, now);

  // 3. Decide and write the message.
  const decision = decide(
    firstTrains.map((train) => train.time),
    thenTrains.map((train) => train.time),
    now,
    { maxWaitMin: choice.maxWaitMin, transferMin: choice.usual.transferMin },
  );
  const usualName = `${first.lines.join("/")} → ${then.lines.join("/")}`;
  const backupName = backup.lines.join("/");
  const backupTime = backupTrains.length > 0 ? shortTime(backupTrains[0].time) : "no times listed";
  const lines = [`📍 At ${choice.at} · ${clockTime(now)}`, ""];

  if (decision.take === "usual") {
    lines.push(
      `👉 Take the ${usualName}`,
      `   ${first.name}: ${shortTime(decision.firstAt)}`,
      `   ${then.name}: ${shortTime(decision.thenAt)} (${decision.thenWaitMin} min wait)`,
      `   ${backupName} backup: ${backupTime}`,
    );
    return lines.join("\n");
  }

  lines.push(`👉 Take the ${backupName} (${backupTime})`);
  if (decision.reason === "no first train") lines.push(`   No trains coming at ${first.name}`);
  if (decision.reason === "first train too far") lines.push(`   ${first.name}: next is ${decision.firstWaitMin} min away`);
  if (decision.reason === "no second train") lines.push(`   No trains coming at ${then.name}`);
  if (decision.reason === "second train too far") lines.push(`   ${then.name}: would be a ${decision.thenWaitMin} min wait`);
  return lines.join("\n");
}
