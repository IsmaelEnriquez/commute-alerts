// Prints the briefing for one trip, e.g.: npx tsx src/briefing.ts evening
import { loadTrip } from "./config.js";
import { briefingMessage } from "./messages.js";

briefingMessage(loadTrip(process.argv[2]))
  .then((message) => console.log(message))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
