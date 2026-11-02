# Lakefront Weather Stations

A small React dashboard over a public dataset with a device dimension: the Chicago Park District's
three automated beach weather stations (63rd Street, Foster, Oak Street), published hourly on the
[Chicago Data Portal](https://data.cityofchicago.org/Parks-Recreation/Beach-Weather-Stations-Automated-Sensors/k7hf-8y75).

What it shows, all scoped by one station filter over the last 14 days:

- **Four metric tiles**: latest air temperature with a 24-hour delta, total rainfall, lowest battery
  voltage with a health status, and reporting completeness (readings received vs. expected hourly readings).
- **One time-series chart**: hourly readings per station, switchable between air temperature,
  humidity, wind speed and barometric pressure. Hours with no reading show as gaps.
- **One breakdown**: share of windy hours by compass sector.
- **A per-station table** with the latest reading and a reporting / stale / silent status.

## Run it

```sh
npm install
npm run dev
```

The app queries the Socrata API directly from the browser (no key needed). If the request fails,
it falls back to `public/data/snapshot.json`. Refresh that snapshot with:

```sh
node scripts/fetch-snapshot.mjs 14
```

## Structure

```
src/
  data/types.ts       station registry (fixed palette slot per station), reading and metric types
  data/socrata.ts     SoQL query, row parsing, live fetch with snapshot fallback
  data/compute.ts     window, tiles, hourly series, wind sectors, station health
  data/format.ts      number and date formatting
  hooks/useReadings.ts
  components/         StatTiles, TimeSeries, WindBreakdown, StationFilter, StationTable, ChartTooltip
  styles.css          design tokens (light and dark), layout, chart chrome
```

## Notes on the data

- Timestamps in the dataset are Chicago wall-clock times without a zone. They are parsed as
  browser-local time, so the hour labels are exact only when viewed in Central time.
- The 14-day window is anchored to the newest reading in the data, not to the clock, so the
  snapshot renders identically to live data.
- Station colors are fixed by station, not by position, so changing the filter never recolors a line.
