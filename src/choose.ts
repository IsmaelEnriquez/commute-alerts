// Run when I reach the choice station, e.g.: npx tsx src/choose.ts evening
import { loadTrip } from "./config.js";
import { choiceMessage } from "./messages.js";

choiceMessage(loadTrip(process.argv[2]))
  .then((message) => console.log(message))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
