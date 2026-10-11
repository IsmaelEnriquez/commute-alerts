// When to send what: the weekly question, and each trip's briefing on the days I picked.
import { readFileSync, writeFileSync } from "node:fs";

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The current date, weekday and time in New York, e.g. { date: "2026-10-12", weekday: "Mon", time: "18:30" }. */
export type NyTime = { date: string; weekday: string; time: string };

export function nyTime(now: Date): NyTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, time: `${parts.hour}:${parts.minute}` };
}

/** The days I picked, for the week that starts after the Sunday in `weekOf`. */
export type WeekPlan = { weekOf: string; days: string[] };

/** The most recent Sunday on or before this date. */
export function weekOf(now: NyTime): string {
  const sunday = Date.parse(now.date) - DAYS.indexOf(now.weekday) * DAY_MS;
  return new Date(sunday).toISOString().slice(0, 10);
}

/** True if today is one of the days I picked, and the picks are for this week (not an old week). */
export function isAlertDay(plan: WeekPlan | null, now: NyTime): boolean {
  if (!plan) return false;
  const daysAfterSunday = (Date.parse(now.date) - Date.parse(plan.weekOf)) / DAY_MS;
  return daysAfterSunday >= 1 && daysAfterSunday <= 7 && plan.days.includes(now.weekday);
}

/** Everything due at this exact minute: "week-question" and/or the ids of trips whose briefing is due. */
export function dueNow(
  now: NyTime,
  trips: { id: string; sendAt: string }[],
  plan: WeekPlan | null,
  weeklyQuestion: { weekday: string; time: string },
): string[] {
  const due: string[] = [];
  if (now.weekday === weeklyQuestion.weekday && now.time === weeklyQuestion.time) due.push("week-question");
  if (isAlertDay(plan, now)) {
    due.push(...trips.filter((trip) => trip.sendAt === now.time).map((trip) => trip.id));
  }
  return due;
}

// shortcut: my picks live in a small file; move them to a database when this runs on a server.
const WEEK_FILE = "week.json";

export function loadWeek(): WeekPlan | null {
  try {
    return JSON.parse(readFileSync(WEEK_FILE, "utf8")) as WeekPlan;
  } catch {
    return null; // no picks saved yet
  }
}

export function saveWeek(plan: WeekPlan): void {
  writeFileSync(WEEK_FILE, JSON.stringify(plan, null, 2));
}
