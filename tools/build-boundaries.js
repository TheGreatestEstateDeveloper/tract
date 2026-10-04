/*
 * Builds the static boundary files the map draws at every zoom:
 *   data/va-localities.json  Virginia's 133 counties and cities (VGIN, clipped to shoreline)
 *   data/states.json         Lower 48 state outlines plus a finer Virginia outline (Census TIGERweb)
 *
 * Run with Node 18+ from the repo root:  node tools/build-boundaries.js
 * Only needed when boundaries change (rarely). Not part of the app; the app has no build step.
 */
const fs = require("fs");
const path = require("path");

const VGIN = "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Admin_Boundaries_Clipped/MapServer/1";
const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer";

async function query(url, params) {
  const qs = new URLSearchParams(Object.assign({ f: "geojson", outSR: "4326", returnGeometry: "true" }, params));
  const res = await fetch(url + "/query", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs.toString() });
  const j = await res.json();
  if (j.error) throw new Error(url + ": " + JSON.stringify(j.error));
  return j;
}

function round(coords, d) {
  const k = Math.pow(10, d);
  if (typeof coords[0] === "number") return [Math.round(coords[0] * k) / k, Math.round(coords[1] * k) / k];
  return coords.map((c) => round(c, d));
}

// Drop repeated points that rounding creates, and rings that collapse
function tidy(geom) {
  const ring = (r) => r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
  const poly = (p) => { const rs = p.map(ring); return rs[0] && rs[0].length >= 4 ? rs.filter((r) => r.length >= 4) : []; };
  const parts = (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates).map(poly).filter((p) => p.length);
  return parts.length === 1 ? { type: "Polygon", coordinates: parts[0] } : { type: "MultiPolygon", coordinates: parts };
}

// The state file lists a few localities in more than one record; merge them into one feature per FIPS
function mergeByFips(features) {
  const by = {};
  features.forEach((f) => {
    const k = f.properties.fips, g = f.geometry;
    const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (!parts.length) return;
    if (!by[k]) by[k] = { type: "Feature", properties: f.properties, geometry: { type: "MultiPolygon", coordinates: [] } };
    by[k].geometry.coordinates.push.apply(by[k].geometry.coordinates, parts);
  });
  return Object.keys(by).map((k) => {
    const f = by[k];
    if (f.geometry.coordinates.length === 1) f.geometry = { type: "Polygon", coordinates: f.geometry.coordinates[0] };
    f.properties.lp = labelPoint(f.geometry);
    return f;
  });
}

// Label point: area-weighted centroid of the largest polygon's outer ring
function labelPoint(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let best = null, bestA = 0;
  polys.forEach((p) => {
    const r = p[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
  });
  return best && round(best, 4);
}

(async () => {
  const out = path.join(__dirname, "..", "data");
  fs.mkdirSync(out, { recursive: true });

  const loc = await query(VGIN, { where: "1=1", outFields: "STCOFIPS,NAME,NAMELSAD,JURISTYPE", maxAllowableOffset: "0.004" });
  const localities = {
    type: "FeatureCollection",
    features: mergeByFips(loc.features.filter((f) => f.geometry).map((f) => ({
      type: "Feature",
      properties: { fips: f.properties.STCOFIPS, name: f.properties.NAMELSAD || f.properties.NAME, short: f.properties.NAME, type: f.properties.JURISTYPE },
      geometry: tidy({ type: f.geometry.type, coordinates: round(f.geometry.coordinates, 4) })
    }))).sort((a, b) => a.properties.name.localeCompare(b.properties.name))
  };
  fs.writeFileSync(path.join(out, "va-localities.json"), JSON.stringify(localities));

  const lower48 = "STATE NOT IN ('02','15','60','66','69','72','78')";
  const states = await query(TIGER + "/9", { where: lower48, outFields: "STUSAB,NAME,STATE", maxAllowableOffset: "0.02" });
  const va = await query(TIGER + "/8", { where: "STATE='51'", outFields: "STUSAB,NAME,STATE", maxAllowableOffset: "0.002" });
  const statesFc = {
    type: "FeatureCollection",
    features: states.features.filter((f) => f.properties.STATE !== "51").map((f) => ({
      type: "Feature", properties: { abbr: f.properties.STUSAB, name: f.properties.NAME },
      geometry: tidy({ type: f.geometry.type, coordinates: round(f.geometry.coordinates, 3) })
    })).concat(va.features.map((f) => ({
      type: "Feature", properties: { abbr: "VA", name: "Virginia", focus: true },
      geometry: tidy({ type: f.geometry.type, coordinates: round(f.geometry.coordinates, 4) })
    })))
  };
  fs.writeFileSync(path.join(out, "states.json"), JSON.stringify(statesFc));

  const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + " KB";
  console.log("va-localities.json:", localities.features.length, "features,", size("va-localities.json"));
  console.log("states.json:", statesFc.features.length, "features,", size("states.json"));
})().catch((e) => { console.error(e); process.exit(1); });
