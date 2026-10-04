# Tract: notes for Claude

Tract is an installable web app (PWA) for Virginia residential land work, used on a phone and a laptop. The owner uses it to find sites, underwrite parcels, track competing builders and developers, and prepare for meetings and interviews. Live site: https://thegreatestestatedeveloper.github.io/tract/ (GitHub Pages, branch `main`, repo root). Pushing to `main` deploys.

## Hard rules

- **This repo is public.** Never commit the owner's name, contact details, networking contacts, notes, or anything personal. Private contacts live only in each browser's localStorage (imported from a JSON file the owner keeps). `.gitignore` blocks `contacts*.json` and `*.json.private`; keep it that way.
- **Free data only.** No paid data sources or API keys. County data is read live from public ArcGIS REST services.
- **Writing:** no em dashes anywhere (UI text, firm profiles, commit messages, replies). Plain, human-sounding prose.
- **Firm profiles:** factual and sourced, framed positively. Don't build profile text around weak results (write-offs, lower profit, buyer incentives).
- Ask the owner before big structural changes (frameworks, build steps, a backend). The app is deliberately plain HTML/CSS/JS with no build step.

## Files

- `index.html`: app shell (map, top search bar, bottom sheet on phones and side panel at 900px+, tabs Parcel / Sites / Firms / Saved / More).
- `css/app.css`: design tokens on `:root` (ink #14281F, accent #1E6B47, gold #D99A00, IBM Plex Sans / Condensed / Mono), dark mode, components.
- `js/localities.js`: `window.TRACT_LOCALITIES`, one entry per county or city keyed by FIPS. Each entry maps county field names to logical fields (`f`), and lists `joins`, `nearby`, `zoning`, `plan`, `policy`, `cases`, `links`, `notes`, `stale`, and `depth` (`deep` / `partial` / `basic`). Missing keys mean the county doesn't publish that item, and the app links out instead.
- `js/app.js`: all logic. `ags()` REST wrapper (POST when the URL is long, timeout, retry), `selectParcel` then `loadCountyData` (parcel, joins, zoning/plan layers, cases, nearby home values and land sales), `renderReport`, search (address, coordinates, `pin:`, `owner:`), Sites, Firms, Saved, contacts, coverage table.
- `js/firms.js`: `window.TRACT_FIRMS`, 27 builder, developer and contractor profiles (`key, name, aliases, type, hq, ticker, website, vaOffices, summary, strategy, numbers, people, projects, ownerPatterns, casePatterns, sources`). `ownerPatterns` drive the live "parcels owned" lookups.
- `sw.js`: service worker, network first. **Bump `VERSION` whenever shell files change** so installed phones pick up the update.
- `manifest.webmanifest`, `icons/`.

## Data sources

- Statewide parcel outlines: VGIN `https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0` (FIPS, LOCALITY, PARCELID; max 2000 records; no dynamicLayers).
- County detail: the services listed in `js/localities.js`. Some counties store numbers as text (`textNumbers` / `textFields`, queried with `CAST(field AS FLOAT)`).
- Basemaps: Esri World Street Map and World Imagery. Geocoder: ArcGIS World `findAddressCandidates`.

## Adding or deepening a county

1. Find its public ArcGIS REST services (parcels, zoning, comp plan, land-use cases) and read the real field names from the layer's JSON.
2. Add or extend the entry in `js/localities.js`, matching the shape of an existing deep county (Chesterfield and James City are good models).
3. Test a few real parcels on the live site (owner, acres, values, last sale, zoning, plan, cases, nearby values).
4. Bump `sw.js` `VERSION`, commit, push.

## Testing

- The cloud shell usually can't reach county GIS servers (the proxy returns 403). Use WebFetch for REST queries, and a browser for testing the live site.
- After a push, GitHub Pages takes about a minute to update.
- Good test parcels: Loudoun 155475833000 (20.6 ac, R1), Fairfax Government Center, 25000 Pear Orchard Rd in Chesterfield, `owner: STANLEY MARTIN`.

## Weekly refresh

A scheduled task runs Monday mornings (about 6:56 a.m. Eastern). It checks county case layers and firm news, updates `js/firms.js` (including its `updated` date), pushes to `main`, and emails the owner a digest. **Pull before starting work** so you don't overwrite its changes.

## Known gaps (Oct 2026)

- Fairfax and Loudoun don't publish owner names in GIS; the app links to iCARE and Loudoun's parcel database.
- Henrico's open parcel file is a March 2022 snapshot.
- Hanover and Suffolk are links only; Stafford is partial (no owners or values).
- Counties file cases under project names, so matching cases to builders by name is weak.
- Case layers lag new filings by weeks.
