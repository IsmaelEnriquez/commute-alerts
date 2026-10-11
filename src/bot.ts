// The Discord bot: asks which days I want alerts, sends briefings on those days,
// and answers /briefing, /choose and /week from my phone.
// Run it with: npx tsx --env-file=.env src/bot.ts
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  Client,
  Events,
  GatewayIntentBits,
  StringSelectMenuBuilder,
  type GuildTextBasedChannel,
} from "discord.js";
import { loadConfig, type Trip } from "./config.js";
import { briefingMessage, choiceMessage } from "./messages.js";
import { DAYS, dueNow, loadWeek, nyTime, saveWeek, weekOf } from "./schedule.js";

const WEEKLY_QUESTION = { weekday: "Sun", time: "21:00" }; // Sunday at 9 PM

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
if (!token || !channelId) {
  throw new Error("Add DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID to .env");
}

const trips = loadConfig().trips;
const findTrip = (id: string): Trip => trips.find((trip) => trip.id === id) ?? trips[0];

// Discord messages can't be longer than 2,000 characters.
const fit = (text: string) => (text.length > 2000 ? text.slice(0, 1997) + "…" : text);

/** The "which days?" question, with a menu to pick days. */
function weekQuestion() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("week-days")
    .setPlaceholder("Pick the days you want alerts")
    .setMinValues(0)
    .setMaxValues(DAYS.length)
    .addOptions(DAYS.map((day) => ({ label: day, value: day })));
  return {
    content: "📅 Which days do you want commute alerts this week?",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  const found = await client.channels.fetch(channelId);
  if (!found || !found.isTextBased() || found.isDMBased()) {
    throw new Error("DISCORD_CHANNEL_ID isn't a text channel in your server");
  }
  const channel: GuildTextBasedChannel = found;

  // Register the slash commands in my server.
  const tripChoices = trips.map((trip) => ({ name: trip.title, value: trip.id }));
  await channel.guild.commands.set([
    {
      name: "briefing",
      description: "Send a trip's briefing right now",
      options: [{ name: "trip", description: "Which trip", type: ApplicationCommandOptionType.String, required: true, choices: tripChoices }],
    },
    {
      name: "choose",
      description: "Usual route or backup? Run this at the choice station",
      options: [
        {
          name: "trip",
          description: "Which trip",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: trips.filter((trip) => trip.choice).map((trip) => ({ name: trip.title, value: trip.id })),
        },
      ],
    },
    { name: "week", description: "Pick which days you want alerts this week" },
  ]);
  console.log(`Commute Bot is online in #${channel.name}`);

  // Every 20 seconds, check whether something is due this minute.
  // shortcut: what was sent is only remembered in memory, so a restart in the same minute could send twice.
  const sent = new Set<string>();
  setInterval(async () => {
    const now = nyTime(new Date());
    for (const item of dueNow(now, trips, loadWeek(), WEEKLY_QUESTION)) {
      const key = `${now.date} ${item}`;
      if (sent.has(key)) continue;
      sent.add(key);
      try {
        if (item === "week-question") await channel.send(weekQuestion());
        else await channel.send(fit(await briefingMessage(findTrip(item))));
      } catch (error) {
        console.error(`Couldn't send ${item}:`, error);
      }
    }
  }, 20_000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // I picked days from the menu: save them for this week.
    if (interaction.isStringSelectMenu() && interaction.customId === "week-days") {
      const days = DAYS.filter((day) => interaction.values.includes(day));
      saveWeek({ weekOf: weekOf(nyTime(new Date())), days });
      await interaction.update({
        content: days.length > 0 ? `✅ Alerts this week: ${days.join(", ")}` : "✅ No alerts this week",
        components: [],
      });
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "week") {
      await interaction.reply(weekQuestion());
      return;
    }

    // /briefing and /choose download live data, which can take a few seconds.
    await interaction.deferReply();
    const trip = findTrip(interaction.options.getString("trip", true));
    const message = interaction.commandName === "choose" ? await choiceMessage(trip) : await briefingMessage(trip);
    await interaction.editReply(fit(message));
  } catch (error) {
    console.error(error);
    const text = `Something went wrong: ${error instanceof Error ? error.message : error}`;
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.editReply(text);
      else await interaction.reply(text);
    }
  }
});

client.login(token);
