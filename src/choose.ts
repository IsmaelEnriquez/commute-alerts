// Run when I reach the choice station, e.g.: npx tsx src/choose.ts evening
import { loadTrip } from "./config.js";
import { decide } from "./decide.js";
import { arrivalsOn, clockTime, downloadFeedsFor, shortTime } from "./mta.js";

async function main() {
  const trip = loadTrip(process.argv[2]);
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

  // 3. Decide and print.
  const decision = decide(
    firstTrains.map((train) => train.time),
    thenTrains.map((train) => train.time),
    now,
    { maxWaitMin: choice.maxWaitMin, transferMin: choice.usual.transferMin },
  );
  const usualName = `${first.lines.join("/")} → ${then.lines.join("/")}`;
  const backupName = backup.lines.join("/");
  const backupTime = backupTrains.length > 0 ? shortTime(backupTrains[0].time) : "no times listed";
  console.log(`📍 At ${choice.at} · ${clockTime(now)}\n`);

  if (decision.take === "usual") {
    console.log(`👉 Take the ${usualName}`);
    console.log(`   ${first.name}: ${shortTime(decision.firstAt)}`);
    console.log(`   ${then.name}: ${shortTime(decision.thenAt)} (${decision.thenWaitMin} min wait)`);
    console.log(`   ${backupName} backup: ${backupTime}`);
    return;
  }

  console.log(`👉 Take the ${backupName} (${backupTime})`);
  if (decision.reason === "no first train") console.log(`   No trains coming at ${first.name}`);
  if (decision.reason === "first train too far") console.log(`   ${first.name}: next is ${decision.firstWaitMin} min away`);
  if (decision.reason === "no second train") console.log(`   No trains coming at ${then.name}`);
  if (decision.reason === "second train too far") console.log(`   ${then.name}: would be a ${decision.thenWaitMin} min wait`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
