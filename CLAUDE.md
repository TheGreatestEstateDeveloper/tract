# Tract: notes for Claude

Tract is an installable web app (PWA) for Virginia residential land work, used on a phone and a laptop. The owner uses it to find sites, underwrite parcels, track competing builders and developers, and prepare for meetings and interviews. Live site: https://thegreatestestatedeveloper.github.io/tract/ (GitHub Pages, branch `main`, repo root). Pushing to `main` deploys.

## Hard rules

- **This repo is public.** Never commit the owner's name, contact details, networking contacts, notes, or anything personal. Private contacts live only in each browser's localStorage (imported from a JSON file the owner keeps). `.gitignore` blocks `contacts*.json` and `*.json.private`; keep it that way.
- **Free data only.** No paid data sources or API keys. County data is read live from public ArcGIS REST services.
- **Writing:** no em dashes anywhere (UI text, firm profiles, commit messages, replies). Plain, human-sounding prose.
- **Firm profiles:** factual and sourced, framed positively. Don't build profile text around weak results (write-offs, lower profit, buyer incentives).
- Ask the owner before big structural changes (frameworks, build steps, a backend). The app is deliberately plain HTML/CSS/JS with no build step.

## Files

Plain scripts loaded in order by `index.html`; each file is an IIFE that reads and adds to `window.Tract` (`T`). No modules, no build step.

- `index.html`: app shell. Icon rail on laptops (bottom bar under 900px), side panel (bottom sheet on phones), map stage with search and map tools, and the parcel card (`#identify`, right side on laptops, bottom sheet on phones, X to close).
- `css/app.css`: navy and brass design tokens on `:root` with a dark mode, layout for both sizes, components, and map styling (Virginia mask, state and county lines, labels).
- `js/core.js`: shared helpers (`T.u`), geometry (`T.geo`), the ArcGIS REST wrapper and `layerMeta` (code labels and colors read from each layer's renderer) (`T.gis`), icons, and a tiny event bus (`T.on`, `T.emit`).
- `js/map.js`: Leaflet map, basemaps (Clean, Streets, Satellite, VA aerial 2025 from VGIN, Topo), boundaries from `data/`, layers panel with legends (county zoning, future land use and cases follow the county in view; FEMA flood and NWI wetlands statewide), measuring, and helpers other views use (`T.map.dot`, `fitLayer`, `localityAt`, `activeFips`).
- `js/parcel.js`: tap a parcel, load everything the county publishes, render the report, owner signals (estate, trust, long-held, $0 transfer, out of state, farm program), save and share.
- `js/search.js`: one search box for addresses, coordinates, `pin:`, `owner:`, plus instant matches from companies, people and counties.
- `js/sites.js`: Sites view. Filters and presets (inherited farmland with upside, plan upside, long-held, absentee), scoring with reasons, and owner search results.
- `js/network.js`: Network view. Companies and Counties, each with Map and List. People (localStorage key `contacts`) with role, counties, phone, email, relationship and an interaction log; `T.firmForText` matches names in records to firms.
- `js/activity.js`: Activity view. Recent filings from every dated county case layer and recent land purchases by builder names (lots rolled up by subdivision), matched to firms; Map and List.
- `js/saved.js`, `js/settings.js`: pipeline, contacts import/export (JSON or CSV), coverage, about.
- `js/app.js`: section switching, phone sheet, laptop panel collapse, map tools, start-up from `#p=lat,lng` or `#section`.
- `js/localities.js`: `window.TRACT_LOCALITIES`, one entry per county or city keyed by FIPS. Each entry maps county field names to logical fields (`f`), and lists `joins`, `nearby`, `zoning`, `plan`, `policy`, `areas`, `cases`, `links`, `notes`, `stale`, and `depth` (`deep` / `partial` / `basic`). Missing keys mean the county doesn't publish that item, and the app links out instead. `areas` are point checks shown under Zoning and plan (`show(attrs)` returns the text, `none` is the text when nothing is there). `HRPDC_PLAN` is the regional Hampton Roads future land use layer.
- `js/firms.js`: `window.TRACT_FIRMS`, 27 builder, developer and contractor profiles (`key, name, aliases, type, hq, ticker, website, vaOffices, summary, strategy, numbers, people, projects, ownerPatterns, casePatterns, sources`). `ownerPatterns` and `casePatterns` drive matching in Activity and the parcel report.
- `data/states.json`, `data/va-localities.json`: simplified boundaries, built by `node tools/build-boundaries.js` (rarely needed).
- `tools/build-icons.js`: draws the PNG icons from the parcel-and-pin mark. `icons/icon.svg` is the vector version.
- `sw.js`: service worker, network first (boundary files cache first). **Bump `VERSION` and update `SHELL` whenever shell files change** so installed phones pick up the update.
- `.claude/launch.json`: local static server on port 8765 for previewing before a push.

## Data sources

- Statewide parcel outlines: VGIN `https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0` (FIPS, LOCALITY, PARCELID; max 2000 records; no dynamicLayers).
- County detail: the services listed in `js/localities.js`. Some counties store numbers as text (`textNumbers` / `textFields`, queried with `CAST(field AS FLOAT)`).
- Basemaps: Esri World Street Map (the "Clean" style is the same tiles with a CSS filter), World Imagery and World Topo; VGIN's VBMP most recent orthoimagery. Geocoder: ArcGIS World `findAddressCandidates`.
- Boundaries: VGIN `VA_Admin_Boundaries_Clipped` (localities) and Census TIGERweb generalized states, saved to `data/`.
- Statewide overlays: FEMA NFHL flood hazard zones (layer 28) and USFWS National Wetlands Inventory.

## Adding or deepening a county

1. Find its public ArcGIS REST services (parcels, zoning, comp plan, land-use cases) and read the real field names from the layer's JSON.
2. Add or extend the entry in `js/localities.js`, matching the shape of an existing deep county (Chesterfield and James City are good models).
3. Test a few real parcels on the live site (owner, acres, values, last sale, zoning, plan, cases, nearby values).
4. Bump `sw.js` `VERSION`, commit, push.

## Testing

- The cloud shell usually can't reach county GIS servers (the proxy returns 403). Use WebFetch for REST queries, and a browser for testing the live site.
- On the owner's Windows laptop, county servers are reachable directly and the browser pane can open the local preview (`.claude/launch.json`, port 8765). Unregister the service worker in the preview if old files seem to stick. Run `node --check` on every JS file before pushing.
- Work goes through a pull request into `main` (the owner merges or approves the merge), then test on the live site.
- After a push, GitHub Pages takes about a minute to update.
- Good test parcels: Loudoun 155475833000 (20.6 ac, R1), Fairfax Government Center, 25000 Pear Orchard Rd in Chesterfield, `owner: STANLEY MARTIN`.

## Weekly refresh

A scheduled task runs Monday mornings (about 6:56 a.m. Eastern). It checks county case layers and firm news, updates `js/firms.js` (including its `updated` date), pushes to `main`, and emails the owner a digest. **Pull before starting work** so you don't overwrite its changes.

## Known gaps (Oct 2026)

- Fairfax and Loudoun don't publish owner names anywhere as open data (checked every Fairfax open data layer, Loudoun's land record services, and ArcGIS Online). Their owner sites (iCARE, Loudoun's parcel database) block cross-site reads and framing, so showing owners inside Tract would need a small relay server. That is a structural change the owner hasn't approved.
- Loudoun publishes no assessed values or sale prices in GIS. Prince William publishes owners and deeds but no values.
- Henrico publishes current values, sales and deeds but no owner names. The old "0322" open file holds only about 735 county-owned parcels, so it isn't used. The report shows the mailing address, which often names the owner's company.
- Hanover publishes no sale prices in GIS. Suffolk publishes no values or sale prices. Stafford publishes neither owners nor values, and its comp plan layer dates from 2019.
- Fauquier's land development application layer was last updated June 2023.
- Eleven Hampton Roads localities have only the regional HRPDC future land use (2023); their owner and value records aren't connected yet. Most other Virginia localities have outlines only.
- Counties file cases under project names, so matching cases to builders by name is weak. Hanover (developer name), Fairfax PLUS, Henrico agendas and Virginia Beach (applicant name) do name the people behind cases.
- Case layers lag new filings by weeks.
- Activity only sees counties whose case layers have a date field; Henrico's case points and Fauquier's 2023 file add little. Land purchases need owner and sale date fields, so Fairfax, Loudoun, Henrico, Stafford, Suffolk and Hanover purchases don't appear. Builders who buy through project LLCs aren't matched unless the LLC name contains the firm's name.
- Lot prices in Activity: counties record a multi-lot deed's full price on every lot (checked in Chesterfield). Tract splits each deed (by book and page, else instrument, else date and price) across the lots the builder still owns. Lots already resold drop off the record, so per-lot prices are an upper bound.
- Activity firm matches carry a strength: strong (applicant, developer, owner or representative), medium (case name), weak (description or a community name from a firm profile). Weak ones are hidden unless "Include weak matches" is on.
- Nearby cases default to residential rezonings, plans and subdivisions from the last 10 years, chosen by keywords in each county's case types and descriptions; "Show all" lists everything.
- Some county map servers are slow to draw (Prince William's zoning export has taken 9+ seconds); the map shows a "Drawing ..." note meanwhile.
- The app name and logo are still provisional (the owner chose to decide later).
