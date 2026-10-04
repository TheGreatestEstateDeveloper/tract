/* Tract: Virginia land development field app. Plain JS, no build step. */
(function () {
  "use strict";

  var REG = window.TRACT_LOCALITIES;
  var FIRMS = window.TRACT_FIRMS || { firms: [], updated: "" };
  var VGIN = REG.VGIN;
  var STORE = "tract:v1:";
  var NOW = new Date();
  var YEAR = NOW.getFullYear();

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v; // only used with static strings
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.append(c.nodeType ? c : String(c));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function store(k, v) { try { if (arguments.length === 1) { var r = localStorage.getItem(STORE + k); return r ? JSON.parse(r) : null; } localStorage.setItem(STORE + k, JSON.stringify(v)); } catch (e) { return null; } }
  function num(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    var n = parseFloat(String(v).replace(/[$,\s]/g, ""));
    return isFinite(n) ? n : null;
  }
  function money(v) {
    var n = num(v); if (n == null) return null;
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "M";
    return "$" + Math.round(n).toLocaleString("en-US");
  }
  function moneyFull(v) { var n = num(v); return n == null ? null : "$" + Math.round(n).toLocaleString("en-US"); }
  function acresFmt(v) { var n = num(v); return n == null ? null : (n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(n >= 10 ? 1 : 2)) + " ac"; }
  function toDate(v) {
    if (v == null || v === "" || v === 0) return null;
    if (typeof v === "number") {
      if (v > 19000000 && v < 21001231) { var s = String(v); return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)); }
      return new Date(v);
    }
    var t = String(v).trim();
    if (!t) return null;
    if (/^\d{8}$/.test(t)) return new Date(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8));
    var iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    var us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) return new Date(+us[3], +us[1] - 1, +us[2]);
    var d = new Date(t);
    return isNaN(d) ? null : d;
  }
  function dateFmt(v) { var d = toDate(v); if (!d || d.getFullYear() < 1901) return null; return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function clean(v) { if (v == null) return ""; var s = String(v).trim(); return /^(null|none|n\/a|0|unassigned|unknown)$/i.test(s) ? "" : s; }
  function sq(s) { return String(s).replace(/'/g, "''"); }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600); }
  function loading(text) { return h("div", { class: "loading" }, text || "Loading"); }
  function kv(rows) {
    var g = h("div", { class: "kv" });
    rows.forEach(function (r) { if (!r || r[1] == null || r[1] === "") return; g.append(h("div", { class: "k" }, r[0]), h("div", { class: "v" + (r[2] ? " mono" : "") }, r[1])); });
    return g.childNodes.length ? g : null;
  }
  function stat(n, l) { return h("div", { class: "stat" }, h("div", { class: "n" }, n == null ? "–" : n), h("div", { class: "l" }, l)); }
  function extLink(href, label) { return h("a", { class: "btn", href: href, target: "_blank", rel: "noopener" }, label, " ↗"); }

  // geodesic polygon area (m²) for GeoJSON ring arrays
  function rad(d) { return d * Math.PI / 180; }
  function ringArea(c) {
    var area = 0, len = c.length, i, lo, mid, up;
    if (len > 2) {
      for (i = 0; i < len; i++) {
        if (i === len - 2) { lo = len - 2; mid = len - 1; up = 0; }
        else if (i === len - 1) { lo = len - 1; mid = 0; up = 1; }
        else { lo = i; mid = i + 1; up = i + 2; }
        area += (rad(c[up][0]) - rad(c[lo][0])) * Math.sin(rad(c[mid][1]));
      }
      area = area * 6378137 * 6378137 / 2;
    }
    return area;
  }
  function geomAcres(g) {
    if (!g) return null;
    var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    var m2 = 0;
    polys.forEach(function (p) { p.forEach(function (ring, i) { var a = Math.abs(ringArea(ring)); m2 += i === 0 ? a : -a; }); });
    return m2 / 4046.8564224;
  }
  function ringsCentroid(rings) {
    if (!rings || !rings.length) return null;
    var r = rings[0], x = 0, y = 0;
    r.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / r.length, y / r.length];
  }
  function pointInRings(pt, rings) {
    var inside = false;
    (rings || []).forEach(function (ring) {
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
      }
    });
    return inside;
  }
  function distMeters(a, b) {
    var R = 6371000, dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function milesFmt(m) { var mi = m / 1609.34; return mi < 0.1 ? "on or next to this parcel" : mi.toFixed(mi < 1 ? 2 : 1) + " mi away"; }

  // ---------------------------------------------------------------- ArcGIS REST
  function layerUrl(cfg) { return cfg.layer != null ? cfg.url + "/" + cfg.layer : cfg.url; }
  function pointGeom(lng, lat) { return { x: lng, y: lat, spatialReference: { wkid: 4326 } }; }
  function envelope(lng, lat, meters) {
    var dLat = meters / 111320, dLng = meters / (111320 * Math.cos(rad(lat)));
    return { xmin: lng - dLng, ymin: lat - dLat, xmax: lng + dLng, ymax: lat + dLat, spatialReference: { wkid: 4326 } };
  }
  async function ags(url, params, opts) {
    var p = Object.assign({ f: "json" }, params);
    var qs = Object.keys(p).map(function (k) { var v = p[k]; return k + "=" + encodeURIComponent(typeof v === "object" ? JSON.stringify(v) : v); }).join("&");
    var full = url + "/query?" + qs;
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, (opts && opts.timeout) || 20000);
    try {
      var res = full.length > 1900
        ? await fetch(url + "/query", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs, signal: ctl.signal })
        : await fetch(full, { signal: ctl.signal });
      var j = await res.json();
      if (j && j.error) {
        if (p.resultRecordCount && !(opts && opts.retried)) { delete p.resultRecordCount; return ags(url, p, Object.assign({}, opts, { retried: true })); }
        throw new Error(j.error.message || "Query failed");
      }
      return j;
    } finally { clearTimeout(timer); }
  }
  function atPoint(url, lng, lat, extra) {
    return ags(url, Object.assign({ geometry: pointGeom(lng, lat), geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: false }, extra || {}));
  }
  function inEnvelope(url, env, extra) {
    return ags(url, Object.assign({ geometry: env, geometryType: "esriGeometryEnvelope", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: false }, extra || {}));
  }
  function mapAttrs(attrs, f) {
    var out = {};
    if (!attrs) return out;
    Object.keys(f || {}).forEach(function (k) { var src = f[k]; if (typeof src === "string" && attrs[src] !== undefined) out[k] = attrs[src]; });
    // Some counties record small lots in square feet in the acreage field; trust the drawn area when they disagree badly.
    var sqft = num(out.areaSqft);
    if (sqft && sqft > 0) { var calc = sqft / 43560, a = num(out.acres); if (a == null || a > calc * 3) out.acres = calc; }
    return out;
  }
  // Numeric field expression for WHERE clauses (some counties store numbers as text).
  function nf(pl, field) {
    var text = pl.textNumbers === true || (pl.textFields && pl.textFields.indexOf(field) >= 0);
    return text ? "CAST(" + field + " AS FLOAT)" : field;
  }

  // ---------------------------------------------------------------- map
  var map = L.map("map", { zoomControl: false, preferCanvas: true, maxZoom: 20 }).setView([38.2, -77.6], 8);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  var esriAttr = "Tiles © Esri";
  var basemaps = {
    streets: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, attribution: esriAttr }),
    imagery: L.layerGroup([
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, attribution: esriAttr + ", Maxar, Earthstar Geographics" }),
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, opacity: 0.8 })
    ])
  };
  var currentBase = store("basemap") === "imagery" ? "imagery" : "streets";
  basemaps[currentBase].addTo(map);

  // State parcel outlines (VGIN). Drawn from the feature service so the lines read on both basemaps.
  var vginLayer = L.esri.featureLayer({
    url: VGIN.feature, minZoom: 16, simplifyFactor: 0.35, precision: 6, fields: ["OBJECTID"], interactive: false,
    style: function () { return { color: "#E6A500", weight: 1.2, opacity: 0.95, fill: false }; },
    attribution: "Parcels: VGIN and Virginia localities"
  }).addTo(map);
  var selectLayer = L.layerGroup().addTo(map);
  var markerLayer = L.layerGroup().addTo(map);
  var overlays = {}; // key -> leaflet layer for the active locality

  function setBase(name) {
    map.removeLayer(basemaps[currentBase]);
    currentBase = name;
    basemaps[name].addTo(map);
    basemaps[name].bringToBack && basemaps[name].bringToBack();
    store("basemap", name);
    $("btn-basemap").setAttribute("aria-label", name === "imagery" ? "Switch to streets" : "Switch to satellite");
  }
  $("btn-basemap").addEventListener("click", function () { setBase(currentBase === "imagery" ? "streets" : "imagery"); });
  $("btn-locate").addEventListener("click", function () {
    if (!navigator.geolocation) { toast("Location isn't available on this device."); return; }
    navigator.geolocation.getCurrentPosition(function (p) { map.setView([p.coords.latitude, p.coords.longitude], 17); },
      function () { toast("Couldn't get your location. Check location permission for this app."); }, { enableHighAccuracy: true, timeout: 10000 });
  });

  map.on("click", function (e) { selectParcel(e.latlng.lng, e.latlng.lat, { fit: false }); });

  function dot(lat, lng, cls, title, onClick) {
    var m = L.marker([lat, lng], { icon: L.divIcon({ className: "", html: '<div class="marker-dot ' + (cls || "") + '"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), title: title || "" });
    if (onClick) m.on("click", onClick);
    return m.addTo(markerLayer);
  }

  // ---------------------------------------------------------------- panel & tabs
  var panel = $("panel");
  $("panel-handle").addEventListener("click", function () {
    var s = panel.getAttribute("data-state");
    panel.setAttribute("data-state", s === "peek" ? "half" : s === "half" ? "full" : "peek");
  });
  function openPanel(state) { if (window.innerWidth < 900) { var s = panel.getAttribute("data-state"); if (s === "peek" || state === "full") panel.setAttribute("data-state", state || "half"); } }
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  function showTab(name) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === name ? "true" : "false"); });
    ["parcel", "sites", "firms", "saved", "more"].forEach(function (n) { $("tab-" + n).hidden = n !== name; });
    if (name === "firms" && !firmsRendered) renderFirms();
    if (name === "saved") renderSaved();
    if (name === "more") renderMore();
    if (name === "sites" && !sitesRendered) renderSites();
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { showTab(t.getAttribute("data-tab")); }); });

  // ---------------------------------------------------------------- layer bar
  var activeFips = null;
  function setActiveLocality(fips) {
    if (fips === activeFips) return;
    Object.keys(overlays).forEach(function (k) { map.removeLayer(overlays[k].layer); });
    overlays = {};
    activeFips = fips;
    var loc = REG.byFips[fips];
    var bar = clear($("layer-bar"));
    var defs = [];
    if (loc && loc.zoning) defs.push(["zoning", "Zoning", loc.zoning]);
    if (loc && loc.plan) defs.push(["plan", "Future land use", loc.plan]);
    if (loc && loc.cases && loc.cases[0]) defs.push(["cases", "Cases", loc.cases[0]]);
    bar.append(toggleChip("parcels", "Parcel lines", true, function (on) { on ? vginLayer.addTo(map) : map.removeLayer(vginLayer); }));
    defs.forEach(function (d) {
      bar.append(toggleChip(d[0], d[1], false, function (on) {
        if (!overlays[d[0]]) overlays[d[0]] = { layer: makeOverlay(d[0], d[2]) };
        on ? overlays[d[0]].layer.addTo(map) : map.removeLayer(overlays[d[0]].layer);
        if (on && map.getZoom() < 13) toast("Zoom in closer to see " + d[1].toLowerCase() + ".");
      }));
    });
    bar.hidden = false;
  }
  function toggleChip(key, label, on, fn) {
    var b = h("button", { type: "button", class: "chip-toggle", "aria-pressed": on ? "true" : "false" }, label);
    b.addEventListener("click", function () { var now = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", now ? "true" : "false"); fn(now); });
    return b;
  }
  function hue(s) { var x = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; }
  function makeOverlay(kind, cfg) {
    if (cfg.kind === "map") {
      return L.esri.dynamicMapLayer({ url: cfg.url, layers: [cfg.layer], opacity: kind === "cases" ? 0.75 : 0.5, minZoom: 12, format: "png32" });
    }
    var codeField = cfg.code && cfg.code !== "*" ? cfg.code : null;
    var fl = L.esri.featureLayer({
      url: cfg.url, minZoom: 13, simplifyFactor: 0.6, precision: 5,
      style: function (f) {
        var c = kind === "cases" ? "#2F7FD8" : "hsl(" + hue(codeField ? f.properties[codeField] : kind) + ",55%,45%)";
        return { color: c, weight: 1, fillOpacity: kind === "cases" ? 0.12 : 0.22 };
      }
    });
    fl.bindPopup(function (layer) {
      var p = layer.feature.properties;
      var label = codeField ? p[codeField] : (cfg.f && (p[cfg.f.number] || p[cfg.f.name])) || "Feature";
      var div = document.createElement("div"); div.textContent = String(label); return div;
    });
    return fl;
  }

  // ---------------------------------------------------------------- parcel report
  var current = null; // { token, lng, lat, ... }
  var token = 0;

  async function selectParcel(lng, lat, opts) {
    opts = opts || {};
    var my = ++token;
    current = { token: my, lng: lng, lat: lat, sections: {} };
    showTab("parcel");
    openPanel("half");
    renderReport();
    selectLayer.clearLayers();
    try {
      var g = await ags(VGIN.feature, { geometry: pointGeom(lng, lat), geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects",
        outFields: "FIPS,LOCALITY,PARCELID,PTM_ID,LASTUPDATE", returnGeometry: true, outSR: 4326, f: "geojson" });
      if (my !== token) return;
      var feat = g.features && g.features[0];
      if (!feat) { current.none = true; renderReport(); return; }
      var p = feat.properties || {};
      current.vgin = { fips: String(p.FIPS || ""), locality: p.LOCALITY, parcelId: p.PARCELID, ptm: p.PTM_ID, updated: p.LASTUPDATE, geometry: feat.geometry, acresCalc: geomAcres(feat.geometry) };
      current.loc = REG.byFips[current.vgin.fips] || null;
      var gj = L.geoJSON(feat.geometry, { style: { color: "#F2B623", weight: 3, fillColor: "#F2B623", fillOpacity: 0.12 } }).addTo(selectLayer);
      if (opts.fit) map.fitBounds(gj.getBounds(), { maxZoom: 18, padding: [40, 40] });
      setActiveLocality(current.vgin.fips);
      try { history.replaceState(null, "", "#p=" + lat.toFixed(6) + "," + lng.toFixed(6)); } catch (e) { /* ignore */ }
      renderReport();
      loadCountyData(my);
    } catch (e) {
      if (my !== token) return;
      current.error = "The state parcel service didn't answer. Check your connection and tap the parcel again.";
      renderReport();
    }
  }

  function sec(name, state) { if (current) current.sections[name] = state; }

  async function loadCountyData(my) {
    var r = current, loc = r.loc;
    if (!loc) { renderReport(); return; }
    var jobs = [];
    if (loc.parcel) jobs.push(loadParcel(my));
    if (loc.zoning) jobs.push(loadLayerAt(my, "zoning", loc.zoning));
    if (loc.plan) jobs.push(loadLayerAt(my, "plan", loc.plan));
    if (loc.policy) jobs.push(loadLayerAt(my, "policy", loc.policy));
    if (loc.cases) jobs.push(loadCases(my));
    await Promise.all(jobs);
  }

  async function loadParcel(my) {
    var r = current, pl = r.loc.parcel;
    sec("parcel", "loading");
    try {
      var j = await atPoint(pl.url, r.lng, r.lat);
      if (my !== token) return;
      var feats = j.features || [];
      r.county = feats.length ? mapAttrs(feats[0].attributes, pl.f) : null;
      r.countyRaw = feats.length ? feats[0].attributes : null;
      sec("parcel", feats.length ? "done" : "none");
      renderReport();
      var id = r.county && r.county.id;
      if (r.loc.joins && id) await loadJoins(my, id);
      if (r.loc.nearby) loadNearby(my);
    } catch (e) {
      if (my !== token) return;
      sec("parcel", "error"); renderReport();
    }
  }

  async function loadJoins(my, id) {
    var r = current;
    r.join = {}; r.joinRows = {};
    await Promise.all(r.loc.joins.map(async function (jn, idx) {
      var fields = Object.keys(jn.f).map(function (k) { return jn.f[k]; });
      var where = jn.key + " = '" + sq(id) + "'";
      var res;
      try { res = await ags(jn.url, { where: where, outFields: fields.join(","), returnGeometry: false }); }
      catch (e) {
        if (/^\d+$/.test(String(id))) { try { res = await ags(jn.url, { where: jn.key + " = " + id, outFields: fields.join(","), returnGeometry: false }); } catch (e2) { return; } }
        else return;
      }
      var rows = (res.features || []).map(function (x) { return mapAttrs(x.attributes, jn.f); });
      var latestField = jn.latest ? Object.keys(jn.f).filter(function (k) { return jn.f[k] === jn.latest; })[0] : null;
      if (latestField) rows.sort(function (a, b) { return (toDate(b[latestField]) || 0) - (toDate(a[latestField]) || 0) || (num(b[latestField]) || 0) - (num(a[latestField]) || 0); });
      r.joinRows[idx] = rows;
      if (rows[0]) Object.keys(rows[0]).forEach(function (k) { if (r.join[k] == null) r.join[k] = rows[0][k]; });
    }));
    if (my !== token) return;
    renderReport();
  }

  async function loadLayerAt(my, key, cfg) {
    var r = current;
    sec(key, "loading");
    try {
      var j = await atPoint(layerUrl(cfg), r.lng, r.lat);
      if (my !== token) return;
      r[key] = (j.features || []).map(function (x) { return x.attributes; });
      sec(key, "done");
    } catch (e) { if (my !== token) return; sec(key, "error"); }
    renderReport();
  }

  async function loadCases(my) {
    var r = current;
    sec("cases", "loading");
    var env = envelope(r.lng, r.lat, 1300);
    var out = [];
    await Promise.all(r.loc.cases.map(async function (cfg) {
      try {
        var j = await inEnvelope(layerUrl(cfg), env, { returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0003, resultRecordCount: 200 });
        (j.features || []).forEach(function (x) {
          var rings = x.geometry && x.geometry.rings;
          var c = ringsCentroid(rings);
          var onParcel = rings ? pointInRings([r.lng, r.lat], rings) : false;
          var wide = false;
          if (rings && rings[0]) { var xs = rings[0].map(function (p) { return p[0]; }); wide = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) > 0.15; }
          var m = mapAttrs(x.attributes, cfg.f);
          if (!clean(m.number) && !clean(m.name) && !clean(m.alt) && !clean(m.desc) && !(cfg.f && cfg.f.any)) return; // blank zoning history rows
          out.push({ cfg: cfg, a: x.attributes, m: m, dist: c ? distMeters([r.lng, r.lat], c) : null, onParcel: onParcel && !wide, wide: wide, center: c });
        });
      } catch (e) { /* one layer failing should not hide the others */ }
    }));
    if (my !== token) return;
    // Merge the same case number reported by two layers (e.g. an application and its approved rezoning)
    var byNum = {}, merged = [];
    out.forEach(function (cs) {
      var n = clean(cs.m.number).toUpperCase();
      if (n && byNum[n]) { var keep = byNum[n]; Object.keys(cs.m).forEach(function (k) { if (!clean(keep.m[k]) && clean(cs.m[k])) keep.m[k] = cs.m[k]; }); keep.onParcel = keep.onParcel || cs.onParcel; return; }
      if (n) byNum[n] = cs;
      merged.push(cs);
    });
    merged.sort(function (a, b) { return (a.wide - b.wide) || (b.onParcel - a.onParcel) || ((a.dist || 1e9) - (b.dist || 1e9)); });
    r.cases = merged;
    sec("cases", "done");
    renderReport();
  }

  // Nearby home values and land sales
  async function loadNearby(my) {
    var r = current, loc = r.loc, mode = loc.nearby.mode;
    sec("nearby", "loading"); renderReport();
    try {
      if (mode === "fields") await nearbyFromFields(my);
      else if (mode === "join") await nearbyFromJoin(my);
      if (my !== token) return;
      sec("nearby", "done");
    } catch (e) { if (my !== token) return; sec("nearby", "error"); }
    renderReport();
  }

  function summarizeHomes(rows) {
    var cutoff = new Date(YEAR - 2, NOW.getMonth(), NOW.getDate());
    var totals = [], newer = [], sales = [], ppsf = [];
    rows.forEach(function (m) {
      var total = num(m.total); if (total == null && num(m.land) != null && num(m.impr) != null) total = num(m.land) + num(m.impr);
      if (total != null && total > 0) totals.push(total);
      var yb = num(m.yearBuilt);
      if (yb && yb >= YEAR - 10 && total) newer.push(total);
      var sd = toDate(m.saleDate), sp = num(m.salePrice);
      if (sd && sd >= cutoff && sp && sp > 75000) { sales.push(sp); var la = num(m.livingArea); if (la && la > 400) ppsf.push(sp / la); }
    });
    return { count: totals.length, medianValue: median(totals), newerCount: newer.length, medianNewer: median(newer), salesCount: sales.length, medianSale: median(sales), medianPpsf: median(ppsf) };
  }

  async function nearbyFromFields(my) {
    var r = current, pl = r.loc.parcel, f = pl.f;
    var want = ["total", "land", "impr", "yearBuilt", "saleDate", "salePrice", "livingArea"].map(function (k) { return f[k]; }).filter(Boolean);
    if (!f.impr || !want.length) { r.nearby = { unavailable: true }; return; }
    var res = await inEnvelope(pl.url, envelope(r.lng, r.lat, 800), { where: nf(pl, f.impr) + " > 50000", outFields: want.join(","), resultRecordCount: 2000 });
    if (my !== token) return;
    r.nearby = summarizeHomes((res.features || []).map(function (x) { return mapAttrs(x.attributes, f); }));
    r.nearby.radius = "half a mile";
    // Land sales: vacant parcels of an acre or more that sold in the last five years, within two miles
    if (f.acres && f.salePrice && f.saleDate) {
      var landFields = ["acres", "areaSqft", "salePrice", "saleDate", "owner", "address", "id", "zoningCode"].map(function (k) { return f[k]; }).filter(Boolean);
      var where = "(" + nf(pl, f.impr) + " = 0 OR " + f.impr + " IS NULL) AND " + nf(pl, f.salePrice) + " > 20000 AND " + nf(pl, f.acres) + " >= 1";
      try {
        var lr = await inEnvelope(pl.url, envelope(r.lng, r.lat, 3200), { where: where, outFields: landFields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0005, resultRecordCount: 500 });
        var cut = new Date(YEAR - 5, NOW.getMonth(), NOW.getDate());
        var land = (lr.features || []).map(function (x) {
          var m = mapAttrs(x.attributes, f); m.center = ringsCentroid(x.geometry && x.geometry.rings); return m;
        }).filter(function (m) { var d = toDate(m.saleDate); return d && d >= cut && num(m.acres) > 0; });
        land.forEach(function (m) { m.perAcre = num(m.salePrice) / num(m.acres); });
        land.sort(function (a, b) { return toDate(b.saleDate) - toDate(a.saleDate); });
        r.landSales = { rows: land.slice(0, 12), count: land.length, medianPerAcre: median(land.map(function (m) { return m.perAcre; })) };
      } catch (e) { r.landSales = { error: true }; }
    }
  }

  async function nearbyFromJoin(my) {
    var r = current, loc = r.loc, pl = loc.parcel;
    var res = await inEnvelope(pl.url, envelope(r.lng, r.lat, 700), { outFields: pl.idField, resultRecordCount: 1000 });
    var ids = (res.features || []).map(function (x) { return x.attributes[pl.idField]; }).filter(Boolean).slice(0, 600);
    if (!ids.length) { r.nearby = { count: 0 }; return; }
    var vj = loc.joins[loc.nearby.values], sj = loc.joins[loc.nearby.sales];
    var byId = {};
    var chunks = []; for (var i = 0; i < ids.length; i += 120) chunks.push(ids.slice(i, i + 120));
    await Promise.all(chunks.map(async function (ch) {
      var inList = ch.map(function (x) { return "'" + sq(x) + "'"; }).join(",");
      var fields = Object.keys(vj.f).map(function (k) { return vj.f[k]; }).concat([vj.key]);
      try {
        var vr = await ags(vj.url, { where: vj.key + " IN (" + inList + ")", outFields: fields.join(","), returnGeometry: false });
        (vr.features || []).forEach(function (x) {
          var id = x.attributes[vj.key], m = mapAttrs(x.attributes, vj.f);
          var prev = byId[id];
          if (!prev || (num(m.taxYear) || 0) > (num(prev.taxYear) || 0) || (toDate(m.saleDate) || 0) > (toDate(prev.saleDate) || 0)) byId[id] = Object.assign({}, prev || {}, m);
        });
      } catch (e) { /* skip chunk */ }
      if (sj && sj !== vj) {
        try {
          var since = new Date(YEAR - 2, NOW.getMonth(), NOW.getDate()).toISOString().slice(0, 10);
          var sfields = Object.keys(sj.f).map(function (k) { return sj.f[k]; }).concat([sj.key]);
          var sr = await ags(sj.url, { where: sj.key + " IN (" + inList + ") AND " + sj.f.saleDate + " >= DATE '" + since + "'", outFields: sfields.join(","), returnGeometry: false });
          (sr.features || []).forEach(function (x) {
            var id = x.attributes[sj.key], m = mapAttrs(x.attributes, sj.f);
            var prev = byId[id] || {};
            if (!prev.saleDate || toDate(m.saleDate) > toDate(prev.saleDate)) { prev.saleDate = m.saleDate; prev.salePrice = m.salePrice; }
            byId[id] = prev;
          });
        } catch (e) { /* skip */ }
      }
    }));
    if (my !== token) return;
    var rows = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (m) { return num(m.impr) > 50000 || num(m.salePrice) > 0; });
    r.nearby = summarizeHomes(rows);
    r.nearby.radius = "about 0.4 miles";
  }

  // ---------------------------------------------------------------- report rendering
  function zoningUpside(zCode, zDesc, planText) {
    var z = (zCode || "") + " " + (zDesc || "");
    var lowZoning = /\b(A-?\d*|AR-?\d*|AG|AE|RA|RR|R-?1|R-?C|RE-?\d*|TR-?\d+|JLMA|CR-?1|RC|AC)\b/i.test(zCode || "") || /agric|rural|estate|conservation/i.test(zDesc || "");
    var denserPlan = /suburban|urban|neighborhood|residential|mixed|town center|transition|compact|village|community|activity center|planned/i.test(planText || "")
      && !/rural|agric|conservation|open space|park|resource/i.test(planText || "");
    return lowZoning && denserPlan;
  }

  function renderReport() {
    var el = clear($("tab-parcel"));
    var r = current;
    if (!r) { el.append(welcome()); return; }
    if (r.error) { el.append(h("div", { class: "callout bad" }, r.error)); return; }
    if (r.none) { el.append(h("div", { class: "callout plain" }, "No parcel at that spot. Tap inside a parcel outline (zoom in to see them).")); return; }
    if (!r.vgin) { el.append(loading("Finding the parcel")); return; }

    var v = r.vgin, loc = r.loc, c = r.county || {}, j = r.join || {};
    var m = Object.assign({}, c, j); // merged county facts
    var address = clean(m.address) || [clean(m.addrNo), clean(m.addrStreet), clean(m.addrSuffix)].filter(Boolean).join(" ");
    var title = address || (clean(m.owner) ? clean(m.owner) : "Parcel " + (v.ptm || v.parcelId));
    var acres = num(m.acres);

    // Header
    el.append(h("div", { class: "block" },
      h("div", { class: "eyebrow" }, (v.locality || "Virginia") + (loc ? " · " + loc.region : "")),
      h("h2", { class: "title" }, title),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn primary small", onclick: saveCurrent }, isSaved() ? "Saved ✓" : "Save to pipeline"),
        h("button", { type: "button", class: "btn small", onclick: copySummary }, "Copy summary"),
        navigator.share ? h("button", { type: "button", class: "btn small", onclick: shareCurrent }, "Share") : null
      )
    ));
    if (loc && loc.stale) el.append(h("div", { class: "callout warn" }, loc.stale));

    // Key numbers
    var total = num(m.total); if (total == null && num(m.land) != null && num(m.impr) != null) total = num(m.land) + num(m.impr);
    var land = num(m.land); if (land == null && total != null && num(m.impr) != null && r.loc && r.loc.parcel && !r.loc.parcel.f.land) land = total - num(m.impr);
    el.append(h("div", { class: "stats" },
      stat(acresFmt(acres != null ? acres : v.acresCalc), acres != null ? "Acres (county)" : "Acres (calculated)"),
      stat(money(land), "Land value"),
      stat(money(total), "Total assessed"),
      stat(m.salePrice && num(m.salePrice) > 0 ? money(m.salePrice) : null, m.saleDate ? "Last sale · " + (dateFmt(m.saleDate) || "") : "Last sale")
    ));

    // Ownership
    var ownerBlock = h("div", { class: "block" }, h("h3", { class: "sec" }, "Ownership and title"));
    if (r.sections.parcel === "loading") ownerBlock.append(loading("Reading county records"));
    var mail = [clean(m.mail1), clean(m.mail2), [clean(m.mailCity), clean(m.mailState), clean(m.mailZip)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    var deed = (clean(m.deedBook) || clean(m.deedPage)) ? "Book " + (clean(m.deedBook) || "?") + ", page " + (clean(m.deedPage) || "?") : (clean(m.deed) || null);
    ownerBlock.append(kv([
      ["Owner", [clean(m.owner), clean(m.owner2)].filter(Boolean).join(" & ") || (loc && loc.parcel ? (r.sections.parcel === "done" ? "Not published in county GIS" : null) : "See county records")],
      ["Mailing address", mail || null],
      ["Parcel ID", v.ptm || v.parcelId, true],
      clean(m.id) && clean(m.id) !== String(v.ptm) ? ["County ID", clean(m.id), true] : null,
      ["Deed", deed, true],
      ["Instrument", clean(m.instrument) || null, true],
      ["Recorded", dateFmt(m.recorded)],
      ["Sold by (grantor)", clean(m.grantor) || null],
      ["Sale type", clean(m.saleType) || null],
      ["Subdivision", clean(m.subdivision) || null],
      ["Legal description", clean(m.legal) || null],
      ["Use", clean(m.use) || null],
      ["Year built", num(m.yearBuilt) > 1700 ? String(num(m.yearBuilt)) : null],
      ["Living area", num(m.livingArea) > 0 ? Math.round(num(m.livingArea)).toLocaleString() + " sq ft" : null],
      ["Dwelling units", num(m.units) > 0 ? String(num(m.units)) : null],
      ["Land use value", num(m.useValue) > 0 ? moneyFull(m.useValue) : null],
      ["Improvements value", moneyFull(m.impr)],
      ["Prior total value", moneyFull(m.priorTotal)],
      ["Tax status", clean(m.exempt) || null],
      ["Water / sewer", [clean(m.water), clean(m.sewer)].filter(Boolean).join(" / ") || null],
      ["Calculated acres", acresFmt(v.acresCalc)]
    ]));
    // JCC sale history
    if (m.sale2Date || m.sale3Date) {
      var hist = [[m.sale2Date, m.sale2Price, m.sale2From], [m.sale3Date, m.sale3Price, m.sale3From]].filter(function (x) { return dateFmt(x[0]); });
      if (hist.length) ownerBlock.append(h("div", { class: "sub" }, "Earlier sales: " + hist.map(function (x) { return dateFmt(x[0]) + (num(x[1]) ? " for " + money(x[1]) : "") + (clean(x[2]) ? " from " + clean(x[2]) : ""); }).join("; ")));
    }
    if (loc && loc.notes) ownerBlock.append(h("div", { class: "sub" }, loc.notes));
    var links = h("div", { class: "btn-row" });
    if (loc && loc.links && loc.links.assessor) links.append(extLink(loc.links.assessor(clean(m.id) || v.ptm || v.parcelId), loc.links.assessorLabel || "County assessment record"));
    if (m.link) links.append(extLink(m.link, "County property card"));
    if (loc && loc.links && loc.links.landRecords) links.append(extLink(loc.links.landRecords, "Land records (title)"));
    if (!loc) links.append(extLink(REG.google((v.locality || "Virginia") + " real estate assessment parcel search"), "Find the county assessment site"));
    ownerBlock.append(links);
    ownerBlock.append(h("div", { class: "sub" }, "Title documents (deeds, liens, easements) live in the circuit court clerk's land records. The deed reference above is what you search there."));
    el.append(ownerBlock);

    // Zoning and plan
    var zb = h("div", { class: "block" }, h("h3", { class: "sec" }, "Zoning and plan"));
    var zRow = r.zoning && r.zoning[0];
    var zCode = clean(m.zoningCode) || (zRow && loc.zoning.code !== "*" ? clean(zRow[loc.zoning.code]) : "") || clean(m.zoningDesc);
    var zName = zRow && loc.zoning.name ? clean(zRow[loc.zoning.name]) : "";
    var pRow = r.plan && r.plan[0];
    var planText = clean(m.compPlan) || (pRow && loc.plan ? clean(pRow[loc.plan.code]) || clean(pRow[loc.plan.alt]) : "");
    var planExtra = [];
    if (pRow && loc.plan && loc.plan.extra) Object.keys(loc.plan.extra).forEach(function (k) { var vv = clean(pRow[loc.plan.extra[k]]); if (vv) planExtra.push(vv); });
    var polRow = r.policy && r.policy[0];
    var zExtra = [];
    if (zRow && loc.zoning && loc.zoning.extra) Object.keys(loc.zoning.extra).forEach(function (k) { var vv = clean(zRow[loc.zoning.extra[k]]); if (vv) zExtra.push(({ proffer: "Proffers: ", rezoningCase: "Rezoning case: ", ordinance: "Ordinance: ", caseName: "Case: ", conditions: "Conditions: ", secondZone: "Also: ", project: "Project: " }[k] || "") + vv); });
    if (r.zoning && r.zoning.length > 1) zExtra.push("Parcel spans " + r.zoning.length + " zoning districts: " + r.zoning.map(function (x) { return clean(x[loc.zoning.code]); }).filter(Boolean).join(", "));
    zb.append(kv([
      ["Zoning", [zCode, zName].filter(Boolean).join(" · ") || (r.sections.zoning === "loading" ? "Loading" : loc && (loc.zoning || (loc.parcel && loc.parcel.f.zoningCode)) ? "Not found at this point" : "See county zoning map")],
      ["Zoning detail", zExtra.join("; ") || null],
      [loc && loc.plan ? loc.plan.label : "Comprehensive plan", planText ? planText + (planExtra.length ? " (" + planExtra.join(", ") + ")" : "") : (r.sections.plan === "loading" ? "Loading" : null)],
      [loc && loc.policy ? loc.policy.label : "Policy area", polRow ? [clean(polRow[loc.policy.code]), clean(polRow[loc.policy.sub])].filter(Boolean).join(" · ") : null],
      ["Flood zone", clean(m.flood) || (num(m.floodAcres) > 0 ? acresFmt(m.floodAcres) + " in floodplain" : null)],
      ["Resource protection area", clean(m.rpa) || (num(m.rpaAcres) > 0 ? acresFmt(m.rpaAcres) + " in RPA" : null)],
      ["Wetlands", clean(m.wetland) || null],
      ["Easements", num(m.easementAcres) > 0 ? acresFmt(m.easementAcres) : null],
      ["Noise / AICUZ", [clean(m.noise), clean(m.aicuz)].filter(Boolean).join(" / ") || null]
    ]));
    if (zoningUpside(zCode, zName, planText)) zb.append(h("div", { class: "callout gold" }, h("strong", null, "Possible rezoning upside. "), "Current zoning reads low-density while the plan reads " + planText + ". Read the plan text and check nearby approvals below."));
    var zlinks = h("div", { class: "btn-row" });
    if (pRow && loc.plan && loc.plan.link && clean(pRow[loc.plan.link])) zlinks.append(extLink(clean(pRow[loc.plan.link]), "Plan text for this area"));
    if (zRow && loc.zoning && loc.zoning.link && clean(zRow[loc.zoning.link])) zlinks.append(extLink(clean(zRow[loc.zoning.link]), "Zoning ordinance"));
    if (loc && loc.links && loc.links.planning) zlinks.append(extLink(loc.links.planning, "Planning department"));
    if (zlinks.childNodes.length) zb.append(zlinks);
    el.append(zb);

    // Cases
    if (loc && loc.cases) {
      var cb = h("div", { class: "block" }, h("h3", { class: "sec" }, "Rezoning and land use cases nearby"));
      if (r.sections.cases !== "done") cb.append(loading("Checking county case files"));
      else if (!r.cases.length) cb.append(h("div", { class: "empty" }, "No cases within about three quarters of a mile."));
      else {
        var list = h("div", { class: "list" });
        r.cases.slice(0, 14).forEach(function (cs) { list.append(caseItem(cs)); });
        cb.append(list);
        if (r.cases.length > 14) cb.append(h("div", { class: "sub" }, (r.cases.length - 14) + " more within the search area. Turn on the Cases layer to see them on the map."));
      }
      el.append(cb);
    }

    // Nearby values
    if (loc && loc.nearby) {
      var nb = h("div", { class: "block" }, h("h3", { class: "sec" }, "Home values and land sales around it"));
      var n = r.nearby;
      if (r.sections.nearby === "loading" || (!n && r.sections.parcel !== "none")) nb.append(loading("Reading assessments around this parcel"));
      else if (r.sections.nearby === "error") nb.append(h("div", { class: "callout plain" }, "Couldn't read nearby assessments just now."));
      else if (n && !n.unavailable) {
        nb.append(h("div", { class: "stats" },
          stat(money(n.medianValue), "Median home assessment (" + (n.count || 0) + " homes)"),
          stat(money(n.medianNewer), "Homes built since " + (YEAR - 10) + " (" + (n.newerCount || 0) + ")"),
          stat(money(n.medianSale), "Median sale, last 2 yrs (" + (n.salesCount || 0) + ")"),
          stat(n.medianPpsf ? "$" + Math.round(n.medianPpsf) : null, "Sale $ per finished sq ft")
        ));
        nb.append(h("div", { class: "sub" }, "Homes with improvements over $50,000 within " + (n.radius || "half a mile") + ", from the county's assessment data."));
        var ls = r.landSales;
        if (ls && ls.rows) {
          nb.append(h("div", { class: "eyebrow" }, "Vacant land sales within 2 miles, last 5 years"));
          if (!ls.rows.length) nb.append(h("div", { class: "empty" }, "No vacant sales of an acre or more found."));
          else {
            nb.append(h("div", { class: "stats" }, stat(money(ls.medianPerAcre), "Median price per acre"), stat(String(ls.count), "Sales found")));
            var ll = h("div", { class: "list" });
            ls.rows.forEach(function (s) {
              ll.append(h("button", { type: "button", class: "item", onclick: function () { if (s.center) { map.setView([s.center[1], s.center[0]], 17); selectParcel(s.center[0], s.center[1], { fit: true }); } } },
                h("div", { class: "t" }, money(s.salePrice) + " · " + acresFmt(s.acres), h("span", { class: "pill gray" }, money(s.perAcre) + "/ac")),
                h("div", { class: "d" }, [dateFmt(s.saleDate), clean(s.zoningCode), clean(s.address), clean(s.owner) ? "now " + clean(s.owner) : ""].filter(Boolean).join(" · "))));
            });
            nb.append(ll);
          }
        }
      }
      el.append(nb);
    } else if (loc) {
      el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Home values around it"),
        h("div", { class: "callout plain" }, (loc.name || "This county") + " doesn't publish assessed values in its GIS, so nearby values come from the county assessment site."),
        loc.links && loc.links.assessor ? h("div", { class: "btn-row" }, extLink(loc.links.assessor(clean(m.id) || v.ptm), "Open the assessment record (neighborhood sales)")) : null));
    } else {
      el.append(h("div", { class: "callout plain" }, (v.locality || "This locality") + " shows the parcel outline and acreage from the state parcel layer. Owner, value and zoning connections for it haven't been added yet."));
    }

    // Field links
    el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Look closer"),
      h("div", { class: "btn-row" },
        extLink("https://www.google.com/maps/search/?api=1&query=" + r.lat + "," + r.lng, "Google Maps"),
        extLink("https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" + r.lat + "," + r.lng, "Street View"),
        loc && loc.links && loc.links.gis ? extLink(loc.links.gis, "County GIS") : null),
      h("div", { class: "sub mono" }, r.lat.toFixed(6) + ", " + r.lng.toFixed(6) + (v.updated ? " · state layer updated " + (dateFmt(v.updated) || "") : ""))
    ));
  }

  function caseItem(cs) {
    var m = cs.m, a = cs.a, f = cs.cfg.f || {};
    var number = clean(m.number), name = clean(m.name) || clean(m.alt);
    var units = [];
    if (num(m.units) > 0) units.push(num(m.units) + " units");
    ["sfd", "th", "condo", "apt"].forEach(function (k) { if (num(m[k]) > 0) units.push(num(m[k]) + " " + { sfd: "single-family", th: "townhouse", condo: "condo", apt: "apartment" }[k]); });
    var meta = [clean(m.type), clean(m.status), dateFmt(m.date), clean(m.fromZone) || clean(m.toZone) ? (clean(m.fromZone) ? clean(m.fromZone) + " → " : "to ") + clean(m.toZone) : "", num(m.acres) > 0 ? acresFmt(m.acres) : "", units.join(", "), num(m.cashProffer) > 0 ? "cash proffer " + moneyFull(m.cashProffer) : "", clean(m.proffer) && clean(m.proffer) !== "N" ? "proffered" : ""].filter(Boolean);
    var desc = clean(m.desc);
    if (!number && !name && f.any) { var ks = Object.keys(a).filter(function (k) { return !/objectid|shape|globalid|created|edited/i.test(k) && clean(a[k]); }).slice(0, 4); name = ks.map(function (k) { return clean(a[k]); }).join(" · "); }
    var link = clean(m.link);
    return h("div", { class: "item static" },
      h("div", { class: "t" }, number || "Case", name ? h("span", null, name) : null, cs.onParcel ? h("span", { class: "pill gold" }, "On this parcel") : null),
      clean(m.applicant) ? h("div", { class: "d" }, "Applicant: " + clean(m.applicant)) : null,
      meta.length ? h("div", { class: "m" }, meta.join(" · ")) : null,
      desc ? h("div", { class: "d" }, desc.length > 260 ? desc.slice(0, 257) + "…" : desc) : null,
      h("div", { class: "d" }, cs.cfg.label + (cs.wide ? " · covers a large area (countywide or district-wide)" : cs.dist != null && !cs.onParcel ? " · " + milesFmt(cs.dist) : "")),
      link && /^https?:/i.test(link) ? h("div", null, h("a", { href: link, target: "_blank", rel: "noopener" }, "Open case file ↗")) : null
    );
  }

  function welcome() {
    return h("div", { class: "block" },
      h("div", { class: "eyebrow" }, "Virginia land"),
      h("h2", { class: "title" }, "Tap any parcel"),
      h("p", { class: "lede" }, "Zoom in until parcel lines appear, then tap one to see the owner, acreage, assessed values, last sale and deed reference, zoning against the comprehensive plan, rezoning cases nearby, and home values and land sales around it."),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn", onclick: function () { map.setView([39.0438, -77.4874], 16); } }, "Ashburn"),
        h("button", { type: "button", class: "btn", onclick: function () { map.setView([37.4049, -77.6612], 16); } }, "Chesterfield"),
        h("button", { type: "button", class: "btn", onclick: function () { map.setView([38.2105, -77.5868], 15); } }, "Spotsylvania"),
        h("button", { type: "button", class: "btn", onclick: function () { map.setView([36.7682, -76.5843], 15); } }, "Suffolk")
      ),
      h("p", { class: "sub" }, "Search by address, by owner (owner: NVR), or by parcel ID (pin: 155475833000).")
    );
  }

  // ---------------------------------------------------------------- save / share
  function savedList() { return store("saved") || []; }
  function currentKey() { return current && current.vgin ? current.vgin.fips + ":" + (current.vgin.ptm || current.vgin.parcelId) : null; }
  function isSaved() { var k = currentKey(); return !!(k && savedList().some(function (s) { return s.key === k; })); }
  function summaryText() {
    var r = current; if (!r || !r.vgin) return "";
    var m = Object.assign({}, r.county || {}, r.join || {});
    var lines = [
      (clean(m.address) || "Parcel " + (r.vgin.ptm || r.vgin.parcelId)) + ", " + r.vgin.locality,
      "Parcel ID: " + (r.vgin.ptm || r.vgin.parcelId),
      clean(m.owner) ? "Owner: " + clean(m.owner) : null,
      "Acres: " + (acresFmt(num(m.acres) != null ? m.acres : r.vgin.acresCalc) || "?"),
      money(m.total) ? "Assessed: " + money(m.total) : null,
      num(m.salePrice) ? "Last sale: " + money(m.salePrice) + (dateFmt(m.saleDate) ? " (" + dateFmt(m.saleDate) + ")" : "") : null,
      location.origin + location.pathname + "#p=" + r.lat.toFixed(6) + "," + r.lng.toFixed(6)
    ];
    return lines.filter(Boolean).join("\n");
  }
  function copySummary() {
    var t = summaryText();
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Copied"); }, function () { toast("Copy isn't allowed here."); });
  }
  function shareCurrent() { navigator.share({ title: "Parcel", text: summaryText() }).catch(function () {}); }
  function saveCurrent() {
    var r = current; if (!r || !r.vgin) return;
    var k = currentKey(), list = savedList();
    if (list.some(function (s) { return s.key === k; })) { showTab("saved"); return; }
    var m = Object.assign({}, r.county || {}, r.join || {});
    list.unshift({ key: k, fips: r.vgin.fips, locality: r.vgin.locality, pin: r.vgin.ptm || r.vgin.parcelId, lat: r.lat, lng: r.lng,
      label: clean(m.address) || "Parcel " + (r.vgin.ptm || r.vgin.parcelId), owner: clean(m.owner), acres: num(m.acres) != null ? num(m.acres) : r.vgin.acresCalc,
      total: num(m.total), status: "Screening", note: "", savedAt: Date.now() });
    store("saved", list);
    toast("Saved to your pipeline");
    renderReport();
  }

  // ---------------------------------------------------------------- search
  var searchBox = $("search"), results = $("search-results");
  $("search-form").addEventListener("submit", function (e) { e.preventDefault(); runSearch(searchBox.value.trim()); });
  document.addEventListener("click", function (e) { if (!e.target.closest(".topbar")) results.hidden = true; });

  async function runSearch(q) {
    if (!q) return;
    clear(results); results.hidden = false; results.append(h("div", { class: "result" }, loading("Searching")));
    var coord = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coord) {
      var a = +coord[1], b = +coord[2], lat = Math.abs(a) < 45 ? a : b, lng = Math.abs(a) < 45 ? b : a;
      results.hidden = true; map.setView([lat, lng], 18); selectParcel(lng, lat, { fit: true }); return;
    }
    var pinM = q.match(/^(pin|gpin|parcel|id)\s*[:#]\s*(.+)$/i);
    if (pinM) return searchPin(pinM[2].trim());
    var ownM = q.match(/^owner\s*[:#]\s*(.+)$/i);
    if (ownM) { results.hidden = true; return ownerSearch([ownM[1].trim().toUpperCase()], $("tab-sites"), "Owner search: " + ownM[1].trim()); }
    try {
      var url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=6&outFields=Match_addr,Addr_type&countryCode=USA" +
        "&searchExtent=" + encodeURIComponent(JSON.stringify({ xmin: -83.7, ymin: 36.5, xmax: -75.2, ymax: 39.5, spatialReference: { wkid: 4326 } })) +
        "&SingleLine=" + encodeURIComponent(q + (/virginia|\bva\b/i.test(q) ? "" : ", Virginia"));
      var j = await (await fetch(url)).json();
      clear(results);
      var cands = (j.candidates || []).filter(function (c) { return c.score > 70; });
      if (!cands.length) { results.append(h("div", { class: "result" }, "No match. Try a street address, a place name, or owner: NAME.")); return; }
      cands.forEach(function (c) {
        results.append(h("button", { type: "button", class: "result", onclick: function () {
          results.hidden = true; var ll = c.location; map.setView([ll.y, ll.x], 18); selectParcel(ll.x, ll.y, { fit: true });
        } }, c.address, h("small", null, c.attributes && c.attributes.Addr_type ? c.attributes.Addr_type.replace(/([a-z])([A-Z])/g, "$1 $2") : "")));
      });
    } catch (e) { clear(results).append(h("div", { class: "result" }, "Search isn't reachable right now. Check your connection.")); }
  }

  async function searchPin(pin) {
    try {
      var j = await ags(VGIN.feature, { where: "PTM_ID = '" + sq(pin) + "' OR PARCELID = '" + sq(pin) + "'", outFields: "FIPS,LOCALITY,PTM_ID", returnGeometry: true, outSR: 4326, f: "geojson", resultRecordCount: 10 });
      clear(results);
      var fs = j.features || [];
      if (!fs.length) { results.append(h("div", { class: "result" }, "No parcel with that ID. Use the ID exactly as the county writes it, spaces included.")); return; }
      fs.forEach(function (f) {
        var b = L.geoJSON(f.geometry).getBounds(), c = b.getCenter();
        results.append(h("button", { type: "button", class: "result", onclick: function () { results.hidden = true; map.fitBounds(b, { maxZoom: 18 }); selectParcel(c.lng, c.lat, { fit: false }); } },
          f.properties.PTM_ID, h("small", null, f.properties.LOCALITY)));
      });
    } catch (e) { clear(results).append(h("div", { class: "result" }, "The state parcel service didn't answer. Try again.")); }
  }

  // Owner search across counties that publish owners
  function ownerFips() { return REG.order.filter(function (f) { var l = REG.byFips[f]; return l && l.ownerSearch && l.parcel && l.parcel.f.owner; }); }
  async function ownerSearch(patterns, target, heading) {
    showTab("sites"); openPanel("half");
    markerLayer.clearLayers();
    var el = clear(target);
    el.append(h("div", { class: "block" }, h("div", { class: "eyebrow" }, "Owner records"), h("h2", { class: "title" }, heading || "Owner search"),
      h("p", { class: "sub" }, "Searching owner names in " + ownerFips().map(function (f) { return REG.byFips[f].name; }).join(", ") + ". Fairfax and Loudoun don't publish owners in GIS, and land held in project LLCs won't match a company name.")));
    var box = h("div", { class: "block" }, loading("Searching county owner records"));
    el.append(box);
    var found = await findOwned(patterns);
    clear(box);
    if (!found.length) { box.append(h("div", { class: "empty" }, "No parcels found under those names.")); return; }
    var totalAc = found.reduce(function (s, x) { return s + (num(x.acres) || 0); }, 0);
    box.append(h("div", { class: "stats" }, stat(String(found.length), "Parcels"), stat(acresFmt(totalAc), "Total acres")));
    var byCounty = {};
    found.forEach(function (x) { (byCounty[x.county] = byCounty[x.county] || []).push(x); });
    Object.keys(byCounty).forEach(function (cn) {
      box.append(h("div", { class: "eyebrow" }, cn + " · " + byCounty[cn].length));
      var l = h("div", { class: "list" });
      byCounty[cn].sort(function (a, b) { return (num(b.acres) || 0) - (num(a.acres) || 0); }).slice(0, 60).forEach(function (x) { l.append(parcelItem(x)); });
      box.append(l);
    });
    fitMarkers();
  }
  async function findOwned(patterns) {
    var out = [];
    await Promise.all(ownerFips().map(async function (fips) {
      var loc = REG.byFips[fips], f = loc.parcel.f;
      var where = patterns.map(function (p) { return "UPPER(" + f.owner + ") LIKE '%" + sq(p.toUpperCase()) + "%'"; }).join(" OR ");
      var fields = ["owner", "acres", "areaSqft", "address", "id", "total", "zoningCode"].map(function (k) { return f[k]; }).filter(Boolean);
      try {
        var j = await ags(loc.parcel.url, { where: where, outFields: fields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0005, resultRecordCount: 300 }, { timeout: 30000 });
        (j.features || []).forEach(function (x) {
          var m = mapAttrs(x.attributes, f); m.county = loc.name; m.center = ringsCentroid(x.geometry && x.geometry.rings); out.push(m);
        });
      } catch (e) { /* county offline: skip */ }
    }));
    return out;
  }
  function parcelItem(x) {
    var it = h("button", { type: "button", class: "item", onclick: function () { if (x.center) { map.setView([x.center[1], x.center[0]], 17); selectParcel(x.center[0], x.center[1], { fit: true }); } } },
      h("div", { class: "t" }, clean(x.owner) || clean(x.address) || clean(x.id) || "Parcel", num(x.acres) ? h("span", { class: "pill gray" }, acresFmt(x.acres)) : null),
      h("div", { class: "d" }, [clean(x.address), clean(x.zoningCode), money(x.total) ? "assessed " + money(x.total) : "", x.county].filter(Boolean).join(" · ")));
    if (x.center) dot(x.center[1], x.center[0], "", clean(x.owner), function () { selectParcel(x.center[0], x.center[1], { fit: true }); });
    return it;
  }
  function fitMarkers() {
    var ls = markerLayer.getLayers(); if (!ls.length) return;
    var b = L.featureGroup(ls).getBounds(); if (b.isValid()) map.fitBounds(b, { maxZoom: 15, padding: [40, 40] });
  }

  // ---------------------------------------------------------------- Sites tab
  var sitesRendered = false;
  function renderSites() {
    sitesRendered = true;
    var el = clear($("tab-sites"));
    var minAc = h("input", { id: "site-min", type: "number", min: "1", step: "1", value: String(store("siteMin") || 10), inputmode: "numeric" });
    var vacant = h("input", { id: "site-vacant", type: "checkbox", checked: store("siteVacant") !== false });
    var out = h("div", { class: "block" });
    el.append(h("div", { class: "block" },
      h("div", { class: "eyebrow" }, "Find sites"),
      h("h2", { class: "title" }, "Large parcels in this view"),
      h("p", { class: "lede" }, "Move the map to an area you're screening, then search. Where the county publishes values, you can limit it to land with no buildings and see owner and zoning for each one."),
      h("div", { class: "form-row" },
        h("div", { class: "field" }, h("label", { for: "site-min" }, "Minimum acres"), minAc),
        h("div", { class: "field" }, h("label", { for: "site-vacant" }, "Vacant land only"), h("div", null, vacant))),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn primary", onclick: function () { store("siteMin", num(minAc.value) || 10); store("siteVacant", vacant.checked); findSites(num(minAc.value) || 10, vacant.checked, out); } }, "Search this view"),
        h("button", { type: "button", class: "btn", onclick: function () { markerLayer.clearLayers(); clear(out); } }, "Clear"))),
      out);
  }
  async function findSites(minAcres, vacantOnly, out) {
    clear(out); markerLayer.clearLayers();
    if (map.getZoom() < 13) { out.append(h("div", { class: "callout plain" }, "Zoom in to a town or corridor first (the search covers what's on screen).")); return; }
    out.append(loading("Searching parcels in view"));
    var c = map.getCenter(), b = map.getBounds();
    var env = { xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth(), spatialReference: { wkid: 4326 } };
    var fips = null;
    try { var g = await atPoint(VGIN.feature, c.lng, c.lat, { outFields: "FIPS" }); fips = g.features && g.features[0] && String(g.features[0].attributes.FIPS); } catch (e) { /* ignore */ }
    var loc = fips && REG.byFips[fips];
    var rows = [];
    try {
      if (loc && loc.parcel && loc.parcel.f.acres) {
        var f = loc.parcel.f;
        var pl = loc.parcel;
        var where = nf(pl, f.acres) + " >= " + minAcres + (vacantOnly && f.impr ? " AND (" + nf(pl, f.impr) + " = 0 OR " + f.impr + " IS NULL)" : "");
        var fields = ["owner", "acres", "areaSqft", "address", "id", "total", "land", "zoningCode", "compPlan", "use"].map(function (k) { return f[k]; }).filter(Boolean);
        var j = await inEnvelope(loc.parcel.url, env, { where: where, outFields: fields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0004, resultRecordCount: 400 });
        rows = (j.features || []).map(function (x) { var m = mapAttrs(x.attributes, f); m.center = ringsCentroid(x.geometry && x.geometry.rings); m.county = loc.name; return m; })
          .filter(function (m) { return num(m.acres) >= minAcres; });
      } else {
        // State layer: filter by area. Web Mercator area overstates true area by about 1/cos²(lat).
        var k = Math.pow(Math.cos(rad(c.lat)), 2);
        var minMerc = Math.round(minAcres * 4046.86 / k * 0.9);
        var j2 = await inEnvelope(VGIN.feature, env, { where: "Shape__Area >= " + minMerc, outFields: "FIPS,LOCALITY,PTM_ID", returnGeometry: true, outSR: 4326, f: "geojson", resultRecordCount: 400 });
        rows = (j2.features || []).map(function (ft) {
          var a = geomAcres(ft.geometry), bb = L.geoJSON(ft.geometry).getBounds().getCenter();
          return { id: ft.properties.PTM_ID, acres: a, county: ft.properties.LOCALITY, center: [bb.lng, bb.lat] };
        }).filter(function (m) { return m.acres >= minAcres; });
      }
    } catch (e) { clear(out).append(h("div", { class: "callout bad" }, "The parcel search didn't finish. Zoom in a little and try again.")); return; }
    clear(out);
    rows.sort(function (a, b) { return (num(b.acres) || 0) - (num(a.acres) || 0); });
    out.append(h("div", { class: "stats" }, stat(String(rows.length), "Parcels of " + minAcres + "+ acres"), stat(acresFmt(rows.reduce(function (s, x) { return s + (num(x.acres) || 0); }, 0)), "Combined acres")));
    if (loc && !(loc.parcel && loc.parcel.f.acres)) out.append(h("div", { class: "sub" }, loc.name + " doesn't publish acreage with owners in GIS, so this list uses the state outlines. Tap one for details."));
    if (!loc) out.append(h("div", { class: "sub" }, "Using the state parcel outlines here. Tap one for details."));
    if (vacantOnly && loc && loc.parcel && !loc.parcel.f.impr) out.append(h("div", { class: "sub" }, "This county doesn't publish building values in GIS, so the list includes improved parcels."));
    var l = h("div", { class: "list" });
    rows.slice(0, 150).forEach(function (x) { l.append(parcelItem(x)); });
    out.append(l);
  }

  // ---------------------------------------------------------------- Firms
  var firmsRendered = false, firmFilter = "all";
  var FIRM_TYPES = { all: "All", public: "Public builders", regional: "Regional builders", developer: "Land developers", contractor: "Contractors & engineers" };
  function renderFirms() {
    firmsRendered = true;
    var el = clear($("tab-firms"));
    var seg = h("div", { class: "segmented" });
    Object.keys(FIRM_TYPES).forEach(function (k) {
      seg.append(h("button", { type: "button", "aria-pressed": firmFilter === k ? "true" : "false", onclick: function () { firmFilter = k; renderFirms(); } }, FIRM_TYPES[k]));
    });
    el.append(h("div", { class: "block" }, h("div", { class: "eyebrow" }, "Competitors" + (FIRMS.updated ? " · updated " + FIRMS.updated : "")), h("h2", { class: "title" }, "Builders, developers and site firms"), seg));
    var list = h("div", { class: "list" });
    var contacts = contactsList();
    FIRMS.firms.filter(function (f) { return firmFilter === "all" || f.type === firmFilter; }).forEach(function (f) {
      var n = contacts.filter(function (c) { return contactMatchesFirm(c, f); }).length;
      list.append(h("button", { type: "button", class: "item", onclick: function () { renderFirm(f); } },
        h("div", { class: "t" }, f.name, n ? h("span", { class: "pill green" }, n + " contact" + (n > 1 ? "s" : "")) : null),
        h("div", { class: "d" }, f.tagline || ""),
        h("div", { class: "m" }, FIRM_TYPES[f.type] || "")));
    });
    if (!FIRMS.firms.length) list.append(h("div", { class: "empty" }, "Firm profiles are loading in the next update."));
    el.append(list);
  }
  function renderFirm(f) {
    var el = clear($("tab-firms"));
    $("tab-firms").parentNode.scrollTop = 0;
    el.append(h("button", { type: "button", class: "btn small", onclick: renderFirms }, "← All firms"));
    el.append(h("div", { class: "firm-head" }, h("div", { class: "firm-type" }, FIRM_TYPES[f.type] || ""), h("h2", { class: "title" }, f.name),
      f.tagline ? h("div", { class: "sub" }, f.tagline) : null,
      kv([["Headquarters", f.hq], ["Virginia offices", f.vaOffices], ["Ticker", f.ticker, true], ["Website", f.website ? h("a", { href: f.website, target: "_blank", rel: "noopener" }, f.website.replace(/^https?:\/\//, "")) : null]])));
    if (f.summary) el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "What they do in Virginia"), prose(f.summary)));
    if (f.strategy) el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Strategy and how they buy land"), prose(f.strategy)));
    if (f.numbers && f.numbers.length) el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Key numbers"), kv(f.numbers.map(function (x) { return [x[0], x[1]]; }))));
    if (f.people && f.people.length) {
      var pl = h("div", { class: "list" });
      f.people.forEach(function (p) { pl.append(h("div", { class: "item static" }, h("div", { class: "t" }, p.name), h("div", { class: "d" }, p.title))); });
      el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Leadership (public sources)"), pl));
    }
    if (f.projects && f.projects.length) {
      var prj = h("div", { class: "list" });
      f.projects.forEach(function (p) {
        prj.append(h("div", { class: "item static" }, h("div", { class: "t" }, p.name, p.status ? h("span", { class: "pill gray" }, p.status) : null), h("div", { class: "d" }, [p.locality, p.detail].filter(Boolean).join(" · "))));
      });
      el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Virginia communities and pipeline"), prj));
    }
    // Private contacts
    var mine = contactsList().filter(function (c) { return contactMatchesFirm(c, f); });
    var cb = h("div", { class: "block" }, h("h3", { class: "sec" }, "Your contacts"), h("div", { class: "sub" }, "Stored only on this device."));
    if (mine.length) {
      var cl = h("div", { class: "list" });
      mine.forEach(function (c) { cl.append(contactItem(c)); });
      cb.append(cl);
    } else cb.append(h("div", { class: "empty" }, "None yet. Import your contacts file or add one under More."));
    el.append(cb);
    // Live checks
    var live = h("div", { class: "block" });
    el.append(h("div", { class: "block" }, h("h3", { class: "sec" }, "Live checks against county records"),
      h("div", { class: "btn-row" },
        f.ownerPatterns && f.ownerPatterns.length ? h("button", { type: "button", class: "btn", onclick: function () { liveOwned(f, live); } }, "Land in their name") : null,
        f.casePatterns && f.casePatterns.length ? h("button", { type: "button", class: "btn", onclick: function () { liveCases(f, live); } }, "Cases naming them") : null),
      h("div", { class: "sub" }, "Owner names searched: " + (f.ownerPatterns || []).join(", ") + ". Builders often hold land in project LLCs or under option, so treat this as a floor."),
      live));
    if (f.sources && f.sources.length) {
      var ol = h("ol");
      f.sources.forEach(function (s) { ol.append(h("li", null, h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label))); });
      el.append(h("div", { class: "sources" }, h("strong", null, "Sources"), ol));
    }
  }
  function prose(text) { var d = h("div", { class: "prose" }); String(text).split(/\n\n+/).forEach(function (p) { d.append(h("p", null, p)); }); return d; }
  async function liveOwned(f, box) {
    clear(box).append(loading("Searching owner records"));
    markerLayer.clearLayers();
    var found = await findOwned(f.ownerPatterns);
    clear(box);
    if (!found.length) { box.append(h("div", { class: "empty" }, "Nothing under those names in the counties that publish owners.")); return; }
    var totalAc = found.reduce(function (s, x) { return s + (num(x.acres) || 0); }, 0);
    box.append(h("div", { class: "stats" }, stat(String(found.length), "Parcels"), stat(acresFmt(totalAc), "Acres")));
    var l = h("div", { class: "list" });
    found.sort(function (a, b) { return (num(b.acres) || 0) - (num(a.acres) || 0); }).slice(0, 80).forEach(function (x) { l.append(parcelItem(x)); });
    box.append(l);
    fitMarkers();
  }
  async function liveCases(f, box) {
    clear(box).append(loading("Searching case files"));
    markerLayer.clearLayers();
    var out = [];
    await Promise.all(REG.order.map(async function (fips) {
      var loc = REG.byFips[fips];
      if (!loc || !loc.cases) return;
      await Promise.all(loc.cases.map(async function (cfg) {
        var textFields = ["name", "alt", "applicant", "desc"].map(function (k) { return cfg.f && cfg.f[k]; }).filter(Boolean);
        if (!textFields.length) return;
        var where = [];
        textFields.forEach(function (tf) { f.casePatterns.forEach(function (p) { where.push("UPPER(" + tf + ") LIKE '%" + sq(p.toUpperCase()) + "%'"); }); });
        try {
          var j = await ags(layerUrl(cfg), { where: where.join(" OR "), outFields: "*", returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0005, resultRecordCount: 60 }, { timeout: 25000 });
          (j.features || []).forEach(function (x) { out.push({ cfg: cfg, a: x.attributes, m: mapAttrs(x.attributes, cfg.f), center: ringsCentroid(x.geometry && x.geometry.rings), county: loc.name }); });
        } catch (e) { /* skip */ }
      }));
    }));
    clear(box);
    if (!out.length) { box.append(h("div", { class: "empty" }, "No case records name them in the counties with searchable case files.")); return; }
    out.sort(function (a, b) { return (toDate(b.m.date) || 0) - (toDate(a.m.date) || 0); });
    var l = h("div", { class: "list" });
    out.slice(0, 60).forEach(function (cs) {
      var item = caseItem(cs);
      item.insertBefore(h("div", { class: "m" }, cs.county), item.firstChild);
      if (cs.center) { item.classList.remove("static"); item.style.cursor = "pointer"; item.addEventListener("click", function () { map.setView([cs.center[1], cs.center[0]], 16); }); dot(cs.center[1], cs.center[0], "case", clean(cs.m.number)); }
      l.append(item);
    });
    box.append(l);
    fitMarkers();
  }

  // ---------------------------------------------------------------- Contacts (device only)
  function contactsList() { return store("contacts") || []; }
  function firmByKey(k) { return FIRMS.firms.filter(function (f) { return f.key === k; })[0]; }
  function contactMatchesFirm(c, f) {
    if (c.firmKey && c.firmKey === f.key) return true;
    var name = String(c.firm || "").toLowerCase();
    if (!name) return false;
    return [f.name].concat(f.aliases || []).some(function (a) { a = String(a).toLowerCase(); return name.indexOf(a) >= 0 || a.indexOf(name) >= 0; });
  }
  function contactItem(c) {
    return h("div", { class: "item static" },
      h("div", { class: "t" }, c.name, c.title ? h("span", { class: "sub" }, c.title) : null),
      c.firm ? h("div", { class: "m" }, c.firm) : null,
      c.met ? h("div", { class: "d" }, c.met) : null,
      c.notes ? h("div", { class: "d" }, c.notes) : null);
  }

  // ---------------------------------------------------------------- Saved tab
  var STATUSES = ["Screening", "Researching", "Underwriting", "Contacted owner", "Passed"];
  function renderSaved() {
    var el = clear($("tab-saved"));
    var list = savedList();
    el.append(h("div", { class: "block" }, h("div", { class: "eyebrow" }, "Your pipeline"), h("h2", { class: "title" }, list.length ? list.length + " saved parcel" + (list.length > 1 ? "s" : "") : "No saved parcels yet"),
      h("p", { class: "sub" }, "Saved on this device. Export to a spreadsheet anytime."),
      list.length ? h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn", onclick: exportSaved }, "Export CSV")) : null));
    list.forEach(function (s, i) {
      var status = h("select", { id: "st-" + i, "aria-label": "Status" });
      STATUSES.forEach(function (x) { status.append(h("option", { value: x, selected: s.status === x }, x)); });
      status.addEventListener("change", function () { var l = savedList(); l[i].status = status.value; store("saved", l); });
      var note = h("textarea", { id: "nt-" + i, "aria-label": "Notes", placeholder: "Notes: owner outreach, constraints, next step" });
      note.value = s.note || "";
      note.addEventListener("change", function () { var l = savedList(); l[i].note = note.value; store("saved", l); });
      el.append(h("div", { class: "block", style: "border-top:1px solid var(--line);padding-top:12px" },
        h("button", { type: "button", class: "item", style: "border:0;padding:0", onclick: function () { map.setView([s.lat, s.lng], 17); selectParcel(s.lng, s.lat, { fit: true }); } },
          h("div", { class: "t" }, s.label, h("span", { class: "pill gray" }, acresFmt(s.acres) || "")),
          h("div", { class: "d" }, [s.locality, s.owner, money(s.total) ? "assessed " + money(s.total) : ""].filter(Boolean).join(" · "))),
        h("div", { class: "form-row" }, h("div", { class: "field" }, h("label", { for: "st-" + i }, "Status"), status)),
        h("div", { class: "field" }, note),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: function () { var l = savedList(); l.splice(i, 1); store("saved", l); renderSaved(); } }, "Remove"))));
    });
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportSaved() {
    var rows = [["Parcel", "Locality", "Parcel ID", "Owner", "Acres", "Assessed", "Status", "Notes", "Latitude", "Longitude", "Saved"]];
    savedList().forEach(function (s) { rows.push([s.label, s.locality, s.pin, s.owner, s.acres != null ? (+s.acres).toFixed(2) : "", s.total || "", s.status, s.note, s.lat, s.lng, new Date(s.savedAt).toISOString().slice(0, 10)]); });
    download("tract-pipeline.csv", rows.map(function (r) { return r.map(function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n"), "text/csv");
  }

  // ---------------------------------------------------------------- More tab
  function renderMore() {
    var el = clear($("tab-more"));
    // Contacts
    var fileIn = h("input", { id: "contacts-file", type: "file", accept: ".json,application/json" });
    fileIn.addEventListener("change", function () {
      var file = fileIn.files && fileIn.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = JSON.parse(rd.result); var arr = Array.isArray(data) ? data : data.contacts;
          if (!Array.isArray(arr)) throw new Error("bad");
          var existing = contactsList(), seen = {};
          existing.forEach(function (c) { seen[(c.name || "") + "|" + (c.firm || "")] = true; });
          var added = 0;
          arr.forEach(function (c) { if (c && c.name && !seen[c.name + "|" + (c.firm || "")]) { existing.push({ name: String(c.name), firm: c.firm ? String(c.firm) : "", firmKey: c.firmKey || "", title: c.title || "", met: c.met || "", notes: c.notes || "" }); added++; } });
          store("contacts", existing); toast(added + " contacts imported"); renderMore(); firmsRendered = false;
        } catch (e) { toast("That file isn't a Tract contacts file."); }
      };
      rd.readAsText(file);
    });
    var cName = h("input", { id: "c-name", type: "text", placeholder: "Name" }), cFirm = h("input", { id: "c-firm", type: "text", placeholder: "Company" }),
        cTitle = h("input", { id: "c-title", type: "text", placeholder: "Title" }), cNotes = h("textarea", { id: "c-notes", placeholder: "Where you met, what they said, next step" });
    var contacts = contactsList();
    var cList = h("div", { class: "list" });
    contacts.slice().sort(function (a, b) { return String(a.firm).localeCompare(String(b.firm)); }).forEach(function (c) { cList.append(contactItem(c)); });
    el.append(h("div", { class: "block" }, h("div", { class: "eyebrow" }, "Private"), h("h2", { class: "title" }, "Your contacts"),
      h("p", { class: "sub" }, "Kept in this browser only and never sent anywhere. They show up on each firm's page. Import the contacts file on each device you use."),
      h("div", { class: "field" }, h("label", { for: "contacts-file" }, "Import contacts file (.json)"), fileIn),
      h("div", { class: "form-row" }, h("div", { class: "field" }, cName), h("div", { class: "field" }, cFirm), h("div", { class: "field" }, cTitle)),
      h("div", { class: "field" }, cNotes),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn primary small", onclick: function () {
          if (!cName.value.trim()) { toast("Add a name first."); return; }
          var l = contactsList(); l.push({ name: cName.value.trim(), firm: cFirm.value.trim(), title: cTitle.value.trim(), notes: cNotes.value.trim() }); store("contacts", l); firmsRendered = false; renderMore(); toast("Contact added");
        } }, "Add contact"),
        contacts.length ? h("button", { type: "button", class: "btn small", onclick: function () { download("tract-contacts.json", JSON.stringify({ contacts: contactsList() }, null, 1), "application/json"); } }, "Export contacts") : null),
      h("div", { class: "eyebrow" }, contacts.length + " contacts on this device"), cList));

    // Coverage
    var cov = h("div", { class: "list" });
    REG.order.forEach(function (fips) {
      var l = REG.byFips[fips]; if (!l) return;
      var has = [];
      if (l.parcel && l.parcel.f.owner) has.push("owner");
      if (l.parcel && (l.parcel.f.total || l.parcel.f.land) || (l.joins && l.joins.length)) has.push("values");
      if (l.parcel && (l.parcel.f.salePrice) || (l.joins && l.joins.some(function (j) { return j.f.salePrice; }))) has.push("sales");
      if (l.zoning || (l.parcel && l.parcel.f.zoningCode)) has.push("zoning");
      if (l.plan || (l.parcel && l.parcel.f.compPlan)) has.push("comp plan");
      if (l.cases) has.push("cases");
      if (l.nearby) has.push("nearby values");
      cov.append(h("div", { class: "coverage-row" }, h("strong", null, l.name), h("span", { class: "pill " + (l.depth === "deep" ? "green" : l.depth === "partial" ? "gold" : "gray") }, l.depth === "deep" ? "Full" : l.depth === "partial" ? "Partial" : "Outline"),
        h("div", { class: "d" }, (has.length ? has.join(", ") : "parcel outline and links") + (l.stale ? ". " + l.stale : ""))));
    });
    el.append(h("div", { class: "block" }, h("div", { class: "eyebrow" }, "Data coverage"), h("h2", { class: "title" }, "What each county publishes"),
      h("p", { class: "sub" }, "Every parcel in Virginia has an outline and acreage from the state layer (VGIN). These counties add more, read live from their own GIS servers each time you tap."), cov));

    el.append(h("div", { class: "block" }, h("div", { class: "eyebrow" }, "About"),
      h("p", { class: "sub" }, "Tract reads public county and state data at the moment you look. Assessment data isn't a survey or a title search; confirm anything you'll rely on with the county and the land records. Firm profiles come from public sources listed on each page."),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: function () { if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); location.reload(); }); else location.reload(); } }, "Reload latest version"))));
  }

  // ---------------------------------------------------------------- start
  renderReport();
  var mh = location.hash.match(/#p=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (mh) { var lat0 = +mh[1], lng0 = +mh[2]; map.setView([lat0, lng0], 17); selectParcel(lng0, lat0, { fit: true }); }
  var tabFromHash = location.hash.match(/^#(sites|firms|saved|more)$/);
  if (tabFromHash) showTab(tabFromHash[1]);
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== searchBox && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); searchBox.focus(); }
  });
})();
