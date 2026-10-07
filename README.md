# 🌍 Planet Pulse

**A live global hazard monitor built on [Corvic](https://corvic.ai).**

Planet Pulse puts earthquakes, wildfires, storms, floods, volcanoes and sea ice on one interactive globe. It uses public data from NASA, USGS, NOAA and the Smithsonian. You can watch what is happening now, replay history on a timeline, and look up a city to see events near it.

👉 **[Try the live app](https://app.corvic.ai/view/app/a57c306d-9d88-46be-a18a-9aeb24ef76e7)**

> ⚠️ **Situational awareness only.** Planet Pulse is not an official warning, evacuation or life-safety system. In an emergency, follow your local authorities and contact your local emergency number.

---

## What you can do

| Tab | What it does |
|---|---|
| **Live** | Shows events that are currently active across the globe. Each hazard type has its own "live window" (see below). |
| **Timeline** | Replays history on the globe. Earthquakes go back 50 years. Other hazards go back as far as a verified source allows. |
| **Sources & method** | Shows the health and freshness of every feed, plus the method and attribution. |

**Place search:** Search any city with 15,000+ people and pick a radius. The app lists the events inside the circle, nearest first, for both live and historical views. Distances are straight-line (great-circle) from the city centre, not travel distances.

---

## Data sources

| Source | Used for |
|---|---|
| [NASA EONET](https://eonet.gsfc.nasa.gov/) (Earth Observatory Natural Event Tracker) | Wildfires, storms, floods, sea ice and historical events |
| [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) | Earthquakes, live and historical |
| [USGS Volcano Hazards Program (HANS)](https://volcanoes.usgs.gov/) | Volcano alert notices |
| [NOAA National Weather Service](https://www.weather.gov/) | Severe and Extreme weather and flood alerts (US) |
| [NOAA National Hurricane Center](https://www.nhc.noaa.gov/) | Tropical cyclone advisories |
| [Smithsonian Global Volcanism Program](https://volcano.si.edu/) | Weekly volcanic activity reports |
| [GeoNames](https://www.geonames.org/) (cities15000, CC BY 4.0) | Place search |
| [Natural Earth](https://www.naturalearthdata.com/) (1:110m, public domain) | Base map, bundled with the app |

Everything on the globe is real data from these feeds. Nothing is simulated.

---

## How it works

Planet Pulse runs on three Corvic data pipelines that feed the app:

1. **Live hazards:** re-checks the live feeds hourly. Each event carries its own live window, so only currently active events reach the Live tab.
2. **History:** rebuilt daily from the USGS earthquake catalog and NASA EONET. Older time slices are fetched once and frozen. Only the most recent slices are re-read.
3. **Places:** checks the GeoNames city list daily and re-reads it only when GeoNames republishes it.

### Normalisation and de-duplication

- All feeds are mapped to **one event schema**: hazard type, source, title, coordinates, severity, magnitude and the source's own timestamps.
- Source coordinates are preserved. Where a source gives an area instead of a point (some NWS alerts and EONET polygons), the marker sits at the centre of the area.
- NWS alerts are de-duplicated by VTEC event key (the latest message wins). Cancelled and expired alerts are dropped.
- EONET storm records already covered by an NHC advisory are merged into the NHC record. EONET quakes near a USGS event in space and time are merged into the USGS event.
- A Smithsonian volcano report for a volcano that also has a USGS alert is shown once, as the USGS alert.
- Every event links back to its source.

### What counts as "live"

| Hazard / source | Live until |
|---|---|
| Earthquakes (USGS) | 7 days after the event |
| Tropical cyclones (NHC, EONET) | 3 days after the latest position |
| Wildfires (EONET) | 30 days after the latest update |
| Sea and lake ice (EONET) | 60 days after the latest update |
| NWS alerts | the alert's own end or expiry time |
| USGS volcano alert notices | 3 days after the notice |
| Smithsonian weekly volcano report | 14 days after the report |

An event drops off the Live tab when its window ends. It stays in the Timeline.

### Severity scale

Severity is Planet Pulse's own **display scale**, calculated from each source's measurements. It is not an official rating, and it is not comparable across hazard types.

- **Earthquakes:** magnitude below 5 is minor, 5–5.9 moderate, 6–6.9 severe, 7 and above extreme. On the Live tab it is raised to match a USGS PAGER alert level when present.
- **Tropical cyclones:** sustained wind below 34 kt is minor, 34–63 kt moderate, 64–95 kt severe, 96 kt and above extreme.
- **Wildfires:** burned area below 1,000 acres is minor, 1,000–9,999 moderate, 10,000–99,999 severe, 100,000 and above extreme.
- **USGS volcano alerts:** ADVISORY is moderate, WATCH severe, WARNING extreme.
- **Everything else** (Smithsonian reports, floods, sea ice, other): the source publishes no rating, so these are shown as unrated.

---

## Known limitations

- **History is not a complete record.** The sources differ in depth and detail. For example, earthquake counts before the last five years include only magnitude 6 and larger. Wildfire history covers only larger fires.
- **Some hazards have no verified history** (drought, landslides, extreme weather). They are greyed out on the Timeline rather than filled with guesses.
- **Place search covers cities of 15,000+ people.** Smaller towns and villages can't be searched, and there is no street-level map.
- **NWS alerts are US-only,** and only Severe and Extreme alerts are pulled.
- **Freshness depends on the source feeds.** The Sources & method tab shows the status and last-pulled time of each one.

---

## Repository layout

```
apps/custom-app-4m5y3h4h/
├── app.yaml            # App manifest: routes, data bindings, refresh
├── pages/
│   ├── home.js         # Live tab
│   ├── timeline.js     # Timeline tab
│   └── sources.js      # Sources & method tab
├── lib/
│   ├── globe.js        # Interactive globe
│   ├── land.js         # Bundled Natural Earth land polygons
│   ├── model.js        # Data loading, hazard and source definitions
│   ├── ui.js           # Event panels and place search UI
│   ├── chrome.js       # Page chrome and freshness indicator
│   └── state.js        # Shared state
├── styles.css
└── .vendor/            # Vendored Corvic client libraries
```

> **Note:** This repository holds the app interface only. The app reads data tables produced by the three Corvic pipelines above, so it won't run standalone outside Corvic.

---

## Attribution

- **NASA EONET:** event records are compiled from the originating agencies named on each event.
- **USGS** (Earthquake Hazards Program and Volcano Hazards Program): public domain.
- **NOAA / National Weather Service / National Hurricane Center:** public domain.
- **Smithsonian Institution Global Volcanism Program** and USGS, Weekly Volcanic Activity Report.
- **GeoNames:** geographical database, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Natural Earth:** public domain.

Planet Pulse is an independent project inspired by the public Terra Watch demo. It is not affiliated with or endorsed by NASA, USGS, NOAA, the Smithsonian or GeoNames.

## Feedback

I'd love your feedback on the app, and I'd like to hear about your experience building dashboards on public data. Open an issue or get in touch.

## License

[GPL-3.0](LICENSE)
