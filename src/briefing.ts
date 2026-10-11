// Prints the briefing for one trip, e.g.: npx tsx src/briefing.ts evening
import { loadTrip } from "./config.js";
import { findAlerts, isOtherDirection } from "./find-alerts.js";
import { ALERTS_URL, arrivalsOn, clockTime, downloadFeed, downloadFeedsFor, shortTime } from "./mta.js";

async function main() {
  const trip = loadTrip(process.argv[2]);
  const myLines = [...new Set(trip.stops.flatMap((stop) => stop.lines))];

  // 1. Download the train feeds this trip needs and the alerts feed, all at the same time.
  const [feeds, alertsFeed] = await Promise.all([downloadFeedsFor(myLines), downloadFeed(ALERTS_URL)]);
  const now = Date.now() / 1000;

  console.log(`🚇 ${trip.title} · ${clockTime(now)}`);

  // 2. Alerts first: anything happening now on my lines, in my direction.
  const alerts = findAlerts(alertsFeed, myLines, now).filter(
    (headline) => !isOtherDirection(headline, trip.alerts.skipWords, trip.alerts.keepWords),
  );
  if (alerts.length > 0) {
    console.log("\n⚠️ Alerts");
    for (const alert of alerts) {
      console.log(`• ${alert}`);
    }
  }

  // 3. For each stop on the trip, the next 3 trains on the lines I take there.
  for (const stop of trip.stops) {
    const trains = arrivalsOn(feeds, stop.stopId, stop.lines, now).slice(0, 3);

    console.log(`\n${stop.name}`);
    if (trains.length === 0) {
      console.log("   no trains");
    }
    for (const train of trains) {
      // Only name the line when more than one line stops here (like the 2/3 at 96 St).
      const line = stop.lines.length > 1 ? `${train.line} ` : "";
      const minutes = Math.round((train.time - now) / 60);
      console.log(`   ${line}in ${minutes} min (${shortTime(train.time)})`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
