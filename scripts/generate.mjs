import fs from "node:fs/promises";
import path from "node:path";

const SOURCE = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json";
const OUT = path.resolve("docs");
const TZID = "Australia/Perth";

// These are the event types most useful for avoiding clashes with community meetups.
// Location-specific Leek Duck events are excluded below via "live-event".
const INCLUDED = new Set([
  "community-day",
  "event",
  "pokemon-go-fest",
  "pokemon-go-tour",
  "raid-day",
  "raid-hour",
  "raid-weekend",
  "elite-raids",
  "research",
  "max-mondays",
  "max-battles",
  "pokemon-spotlight-hour"
]);

const LABELS = {
  "community-day": "Community Day",
  "event": "Events",
  "pokemon-go-fest": "GO Fest",
  "pokemon-go-tour": "GO Tour",
  "raid-day": "Raid Day",
  "raid-hour": "Raid Hour",
  "raid-weekend": "Raid Weekend",
  "elite-raids": "Elite Raids",
  "research": "Research",
  "max-mondays": "Max Monday",
  "max-battles": "Max Battles",
  "pokemon-spotlight-hour": "Spotlight Hour"
};

function pad(n) { return String(n).padStart(2, "0"); }

function parseWallClock(iso) {
  // ScrapedDuck's event timestamps are floating wall-clock values.
  // We intentionally preserve the displayed clock time and attach Australia/Perth.
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) throw new Error(`Unsupported timestamp: ${iso}`);
  return {
    y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6]
  };
}

function icalLocal(iso) {
  const x = parseWallClock(iso);
  return `${x.y}${pad(x.mo)}${pad(x.d)}T${pad(x.h)}${pad(x.mi)}${pad(x.s)}`;
}

function utcStamp() {
  const d = new Date();
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(s = "") {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line) {
  // RFC 5545 recommends 75-octet lines. ASCII-heavy content here, so a
  // conservative character fold is sufficient for our generated fields.
  const out = [];
  let s = line;
  while (s.length > 70) {
    out.push(s.slice(0, 70));
    s = " " + s.slice(70);
  }
  out.push(s);
  return out.join("\r\n");
}

function isLocationSpecific(e) {
  // ScrapedDuck uses live-event for location-based/in-person listings.
  if (e.eventType === "live-event") return true;
  return false;
}

function eventToIcs(e, stamp) {
  const description = [
    e.heading ? `${e.heading}` : "",
    "",
    "Source: Leek Duck via ScrapedDuck",
    e.link || ""
  ].filter((v, i, a) => v || (i > 0 && i < a.length - 1)).join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(e.eventID)}@pogo-perth-calendar`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${TZID}:${icalLocal(e.start)}`,
    `DTEND;TZID=${TZID}:${icalLocal(e.end)}`,
    `SUMMARY:${escapeText(e.name)}`,
    `DESCRIPTION:${escapeText(description)}`,
    e.link ? `URL:${e.link}` : null,
    `CATEGORIES:${escapeText(LABELS[e.eventType] || e.eventType)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT"
  ].filter(Boolean).map(fold).join("\r\n");
}

function calendar(name, events) {
  const stamp = utcStamp();
  const body = events
    .slice()
    .sort((a,b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
    .map(e => eventToIcs(e, stamp))
    .join("\r\n");

  // Perth is UTC+08:00 year-round. Including VTIMEZONE makes the timezone
  // explicit for clients that do not know how to resolve TZID on its own.
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KP Legends//Pokemon GO Perth Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${TZID}`,
    "BEGIN:VTIMEZONE",
    `TZID:${TZID}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:AWST",
    "END:STANDARD",
    "END:VTIMEZONE",
    body,
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const r = await fetch(SOURCE, {
    headers: { "User-Agent": "pogo-perth-calendar/1.0 (personal community calendar)" }
  });
  if (!r.ok) throw new Error(`ScrapedDuck request failed: ${r.status}`);
  const all = await r.json();

  const now = Date.now();
  // Include events that end no earlier than yesterday, so calendar clients
  // don't churn entries right at midnight while feeds refresh.
  const yesterday = now - 24 * 60 * 60 * 1000;

  const relevant = all.filter(e => {
    if (!INCLUDED.has(e.eventType)) return false;
    if (isLocationSpecific(e)) return false;
    if (!e.start || !e.end || !e.eventID || !e.name) return false;

    // For filtering only, interpret Perth wall-clock as +08:00.
    const endMs = Date.parse(`${e.end}+08:00`);
    return Number.isFinite(endMs) ? endMs >= yesterday : true;
  });

  await fs.writeFile(
    path.join(OUT, "perth-all.ics"),
    calendar("Pokémon GO — Perth", relevant),
    "utf8"
  );

  for (const type of INCLUDED) {
    const items = relevant.filter(e => e.eventType === type);
    const filename = `${type}.ics`;
    await fs.writeFile(
      path.join(OUT, filename),
      calendar(`Pokémon GO — ${LABELS[type] || type} — Perth`, items),
      "utf8"
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    timezone: TZID,
    source: SOURCE,
    totalEvents: relevant.length,
    counts: Object.fromEntries(
      [...INCLUDED].map(t => [t, relevant.filter(e => e.eventType === t).length])
    )
  };
  await fs.writeFile(path.join(OUT, "status.json"), JSON.stringify(summary, null, 2) + "\n");

  console.log(`Generated ${relevant.length} Perth-aware events.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
