import { toSeconds } from "./find-arrivals.js";

// Only the parts of the MTA alerts feed we read.
type AlertFeed = {
  entity: {
    alert?: {
      activePeriod?: { start?: unknown; end?: unknown }[] | null;
      informedEntity?: { routeId?: string | null }[] | null;
      headerText?: { translation?: { text?: string | null; language?: string | null }[] | null } | null;
    } | null;
  }[];
};

/** Alert headlines that affect any of `lines` and are happening at `now` (seconds). Each shows once. */
export function findAlerts(feed: AlertFeed, lines: string[], now: number): string[] {
  const headlines = new Set<string>(); // a Set skips repeats
  for (const entity of feed.entity) {
    const alert = entity.alert;
    if (!alert) continue; // not an alert; skip it

    // Does it affect one of my lines? ("6X" counts as a 6.)
    const affectsMyLines = (alert.informedEntity ?? []).some((affected) =>
      lines.includes((affected.routeId ?? "").replace(/X$/, "")),
    );
    if (!affectsMyLines) continue;

    // Is it happening now? No periods listed = always. A missing end = no end yet.
    const periods = alert.activePeriod ?? [];
    const happeningNow =
      periods.length === 0 ||
      periods.some((period) => {
        const end = toSeconds(period.end);
        return toSeconds(period.start) <= now && (end === 0 || now < end);
      });
    if (!happeningNow) continue;

    // Use the plain English headline.
    const translations = alert.headerText?.translation ?? [];
    const headline = (translations.find((t) => t.language === "en") ?? translations[0])?.text;
    if (headline) headlines.add(headline);
  }
  return [...headlines];
}

/** True if an alert should be hidden: it mentions the other direction (a skip word)
 *  and not my direction (a keep word). Anything that mentions my direction always stays. */
export function isOtherDirection(headline: string, skipWords: string[], keepWords: string[]): boolean {
  // shortcut: reads the MTA's wording, so an oddly phrased alert can slip through.
  const text = headline.toLowerCase();
  const mentions = (word: string) => text.includes(word.toLowerCase());
  if (keepWords.some(mentions)) return false;
  return skipWords.some(mentions);
}
