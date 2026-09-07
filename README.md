# Pokémon GO Perth Calendar

A small, free calendar-feed generator for Pokémon GO events.

It reads event data from **ScrapedDuck** (which sources Leek Duck with permission), excludes
location-specific `live-event` entries, and writes iCalendar feeds with the timezone explicitly
set to:

`Australia/Perth`

That solves the common "6 pm local event appears as 2 am / UTC" problem caused by floating
iCalendar timestamps.

## What is included by default

- Community Day
- General global events
- Pokémon GO Fest
- Pokémon GO Tour
- Raid Day
- Raid Hour
- Raid Weekend
- Elite Raids
- Research events
- Max Mondays
- Max Battles
- Spotlight Hour

Not included by default: seasons, GO Battle League rotations, GO Passes, ordinary raid-boss
rotations, and location-specific live events.

## Easiest setup

1. Create a new **public GitHub repository**, e.g. `pogo-perth-calendar`.
2. Upload everything from this project into the repository.
3. Open the repository's **Actions** tab and enable workflows if GitHub asks.
4. Run **Update Pokémon GO calendars** once using `Run workflow`.
5. Go to **Settings → Pages**.
6. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
7. Save.
8. GitHub will show your Pages address, typically:
   `https://YOUR-USERNAME.github.io/pogo-perth-calendar/`
9. Open that page. Use **Copy subscription URL** for the calendar you want.
10. In Google Calendar on desktop:
    **Other calendars → + → From URL** and paste the URL.

The GitHub Action regenerates the feeds twice per day.

## Main feed

`perth-all.ics`

## Data source

https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json

Please retain attribution to both **LeekDuck.com** and **ScrapedDuck**, as requested by ScrapedDuck.

## Important note about event timing

ScrapedDuck currently supplies event start/end values without timezone offsets. For Pokémon GO
local-time events, this project deliberately treats the wall-clock value as Perth time and emits:

`DTSTART;TZID=Australia/Perth:...`

instead of leaving it floating.

This project is intended for Perth use. If you later want another timezone, change `TZID` and the
VTIMEZONE block in `scripts/generate.mjs`.
