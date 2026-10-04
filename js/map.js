/*
 * Tract map: basemaps, Virginia and county boundaries, GIS layers with legends, measuring, and shared
 * map helpers (result markers, highlight, locality lookup). Everything here is free public data.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, gis = T.gis, geo = T.geo, REG = T.REG, h = u.h;

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // ---------------------------------------------------------------- map
  var saved = u.store("mapView");
  var map = L.map("map", { zoomControl: false, preferCanvas: true, maxZoom: 20, zoomSnap: 0.5, wheelPxPerZoomLevel: 90 })
    .setView(saved ? [saved.lat, saved.lng] : [37.95, -78.75], saved ? saved.z : 7);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.scale({ position: "bottomleft", imperial: true, metric: false, maxWidth: 140 }).addTo(map);
  map.on("moveend", function () { var c = map.getCenter(); u.store("mapView", { lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), z: map.getZoom() }); });

  map.createPane("mask").style.zIndex = 350;
  map.createPane("bounds").style.zIndex = 390;
  var labelPane = map.createPane("labels");
  labelPane.style.zIndex = 640;
  labelPane.style.pointerEvents = "none";
  var svgMask = L.svg({ pane: "mask" }), svgBounds = L.svg({ pane: "bounds" });

  // ---------------------------------------------------------------- basemaps
  var ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  function esri(name, opts) {
    return L.tileLayer(ESRI + name + "/MapServer/tile/{z}/{y}/{x}", Object.assign({ maxZoom: 20, maxNativeZoom: 19, attribution: "Tiles © Esri" }, opts || {}));
  }
  var VBMP = "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VBMP_Imagery/MostRecentImagery_WGS/MapServer/tile/{z}/{y}/{x}";
  var BASEMAPS = [
    { key: "clean", label: "Clean", thumb: ESRI + "World_Street_Map/MapServer/tile/12/1586/1167", make: function () { return esri("World_Street_Map", { className: "tile-clean" }); } },
    { key: "streets", label: "Streets", thumb: ESRI + "World_Street_Map/MapServer/tile/12/1586/1167", make: function () { return esri("World_Street_Map"); } },
    { key: "satellite", label: "Satellite", thumb: ESRI + "World_Imagery/MapServer/tile/12/1586/1167",
      make: function () { return L.layerGroup([esri("World_Imagery", { attribution: "Tiles © Esri, Maxar, Earthstar Geographics" }), esri("Reference/World_Transportation", { opacity: 0.85 })]); } },
    { key: "vaerial", label: "VA aerial 2025", thumb: VBMP.replace("{z}/{y}/{x}", "12/1586/1167"),
      make: function () { return L.layerGroup([L.tileLayer(VBMP, { maxZoom: 20, maxNativeZoom: 20, attribution: "Imagery: VGIN Virginia Base Mapping Program" }), esri("Reference/World_Transportation", { opacity: 0.85 })]); } },
    { key: "topo", label: "Topo", thumb: ESRI + "World_Topo_Map/MapServer/tile/12/1586/1167", make: function () { return esri("World_Topo_Map"); } }
  ];
  var baseLayers = {};
  var currentBase = BASEMAPS.some(function (b) { return b.key === u.store("basemap"); }) ? u.store("basemap") : "clean";
  function setBase(key) {
    if (baseLayers[currentBase]) map.removeLayer(baseLayers[currentBase]);
    currentBase = key;
    if (!baseLayers[key]) baseLayers[key] = BASEMAPS.filter(function (b) { return b.key === key; })[0].make();
    baseLayers[key].addTo(map);
    if (baseLayers[key].bringToBack) baseLayers[key].bringToBack();
    document.documentElement.setAttribute("data-base", key);
    u.store("basemap", key);
    T.emit("basemap", key);
  }
  setBase(currentBase);

  // ---------------------------------------------------------------- layer state
  var DEFAULTS = { parcels: true, counties: true, states: true };
  var layerState = Object.assign({}, DEFAULTS, u.store("layers") || {});
  var opacity = u.store("layerOpacity") || {};
  function isOn(k) { return !!layerState[k]; }
  function saveLayers() { u.store("layers", layerState); u.store("layerOpacity", opacity); }

  // ---------------------------------------------------------------- boundaries
  var localities = null, statesLayer = null, vaLine = null, maskLayer = null, countyLayer = null, labelLayer = L.layerGroup();
  function ll(ring) { return ring.map(function (p) { return [p[1], p[0]]; }); }
  function bbox(g) {
    var b = [180, 90, -180, -90];
    geo.polysOf(g).forEach(function (p) { p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); });
    return b;
  }
  function localityAt(lng, lat) {
    if (!localities) return null;
    for (var i = 0; i < localities.features.length; i++) {
      var f = localities.features[i], b = f.bbox;
      if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      if (geo.pointInGeom([lng, lat], f.geometry)) return f.properties;
    }
    return null;
  }
  function updateLabels() {
    var z = map.getZoom(), show = isOn("counties") && z >= 8 && z < 13;
    if (show && !map.hasLayer(labelLayer)) labelLayer.addTo(map);
    if (!show && map.hasLayer(labelLayer)) map.removeLayer(labelLayer);
    map.getContainer().classList.toggle("labels-small", z < 9);
  }
  function applyBoundaryToggles() {
    if (statesLayer) { if (isOn("states")) statesLayer.addTo(map); else map.removeLayer(statesLayer); }
    if (countyLayer) { if (isOn("counties")) countyLayer.addTo(map); else map.removeLayer(countyLayer); }
    updateLabels();
  }
  var boundariesReady = Promise.all([
    fetch("data/states.json").then(function (r) { return r.json(); }),
    fetch("data/va-localities.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    var states = res[0];
    localities = res[1];
    localities.features.forEach(function (f) { f.bbox = bbox(f.geometry); });
    var others = { type: "FeatureCollection", features: states.features.filter(function (f) { return !f.properties.focus; }) };
    var va = states.features.filter(function (f) { return f.properties.focus; })[0];
    statesLayer = L.geoJSON(others, { renderer: svgBounds, pane: "bounds", interactive: false, style: { className: "state-line", weight: 1, fill: false } });
    if (va) {
      var holes = geo.polysOf(va.geometry).map(function (p) { return ll(p[0]); });
      maskLayer = L.polygon([[[85, -180], [85, 180], [-85, 180], [-85, -180]]].concat(holes), { renderer: svgMask, pane: "mask", className: "va-mask", stroke: false, interactive: false }).addTo(map);
      vaLine = L.geoJSON(va, { renderer: svgBounds, pane: "bounds", interactive: false, style: { className: "va-line", weight: 2.6, fill: false } }).addTo(map);
    }
    countyLayer = L.geoJSON(localities, { renderer: svgBounds, pane: "bounds", interactive: false, style: { className: "county-line", weight: 1.3, fill: false } });
    localities.features.forEach(function (f) {
      var p = f.properties;
      if (!p.lp) return;
      var city = /city/i.test(p.type || "") || / city$/i.test(p.name);
      labelLayer.addLayer(L.marker([p.lp[1], p.lp[0]], { pane: "labels", interactive: false, keyboard: false,
        icon: L.divIcon({ className: "county-label" + (city ? " city" : ""), html: "<span>" + p.short.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>", iconSize: null }) }));
    });
    applyBoundaryToggles();
    trackLocality();
    T.emit("boundaries", localities);
    return localities;
  }).catch(function (e) { console.error("Boundaries failed", e); });
  map.on("zoomend", updateLabels);

  // ---------------------------------------------------------------- parcel outlines (VGIN)
  var VGIN = REG.VGIN;
  var vginLayer = L.esri.featureLayer({
    url: VGIN.feature, minZoom: 16, simplifyFactor: 0.35, precision: 6, fields: ["OBJECTID"], interactive: false,
    style: function () { return { color: cssVar("--parcel-line") || "#D4A24C", weight: 1.1, opacity: 0.95, fill: false }; },
    attribution: "Parcels: VGIN and Virginia localities"
  });
  if (isOn("parcels")) vginLayer.addTo(map);
  var selectLayer = L.layerGroup().addTo(map);
  var results = L.layerGroup().addTo(map);

  function restyle() { vginLayer.setStyle({ color: cssVar("--parcel-line") || "#D4A24C" }); }
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", restyle);
  T.on("theme", restyle);

  // ---------------------------------------------------------------- planning and environment overlays
  var activeFips = null;
  var localOverlays = {}; // fips -> { zoning, plan, cases } leaflet layers
  var ENV = {
    flood: { label: "FEMA flood zones", url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer", layer: 28, minZoom: 11, opacity: 0.55,
      note: "Official FEMA flood hazard map. Zoom to a town or closer." },
    wetlands: { label: "Wetlands (National Wetlands Inventory)", url: "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer", layer: 0, minZoom: 12, opacity: 0.6,
      note: "U.S. Fish and Wildlife Service mapping, a screening tool rather than a delineation." }
  };
  var envLayers = {};

  function hue(s) { var x = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 360; return x; }
  function makeLocalOverlay(kind, cfg) {
    var op = opacity[kind] != null ? opacity[kind] : kind === "cases" ? 0.75 : 0.55;
    if (cfg.kind === "map") return L.esri.dynamicMapLayer({ url: cfg.url, layers: [cfg.layer], opacity: op, minZoom: 11, format: "png32" });
    var codeField = cfg.code && cfg.code !== "*" ? cfg.code : null;
    var meta = { colors: {} };
    var fl = L.esri.featureLayer({
      url: gis.layerUrl(cfg), minZoom: 12, simplifyFactor: 0.6, precision: 5, bubblingMouseEvents: true,
      style: function (f) {
        if (kind === "cases") return { color: cssVar("--case") || "#2F5D9E", weight: 1.2, fillOpacity: 0.12 * op / 0.75, opacity: op };
        var v = codeField ? String(f.properties[codeField] || "").toUpperCase() : "";
        var c = meta.colors[v] || "hsl(" + hue(v || kind) + ",50%,48%)";
        return { color: c, weight: 0.8, fillColor: c, fillOpacity: 0.45 * op, opacity: Math.min(1, op + 0.2) };
      }
    });
    gis.layerMeta(cfg).then(function (m) { meta = m; fl.setStyle(fl.options.style); });
    fl.tractOpacity = function (o) { op = o; fl.setStyle(fl.options.style); };
    return fl;
  }
  function localCfg(fips, kind) {
    var loc = REG.byFips[fips];
    if (!loc) return null;
    if (kind === "cases") return loc.cases && loc.cases.length ? loc.cases : null;
    return loc[kind] || null;
  }
  function getLocal(fips, kind) {
    localOverlays[fips] = localOverlays[fips] || {};
    if (!localOverlays[fips][kind]) {
      var cfg = localCfg(fips, kind);
      if (!cfg) return null;
      localOverlays[fips][kind] = trackLoading(kind === "cases" ? L.layerGroup(cfg.map(function (c) { return makeLocalOverlay("cases", c); })) : makeLocalOverlay(kind, cfg),
        { zoning: "Zoning", plan: "Future land use", cases: "Cases" }[kind]);
    }
    return localOverlays[fips][kind];
  }
  // Esri image layers only request a picture on the next map move; ask for one right away
  // (the first request can be dropped while the map is still settling, so ask once more shortly after)
  function addAndDraw(layer) {
    layer.addTo(map);
    setTimeout(function () {
      (layer.eachLayer ? layer.getLayers() : [layer]).forEach(function (l) { if (l.redraw && l._map && !l._currentImage && !l._tractBusy) l.redraw(); });
    }, 400);
  }

  // "Drawing zoning" note while a county server works (some take several seconds to draw a map)
  var busy = {};
  function showBusy() {
    var names = Object.keys(busy).filter(function (k) { return busy[k] > 0; });
    var chip = u.$("layer-busy");
    if (!chip) return;
    chip.hidden = !names.length;
    chip.textContent = names.length ? "Drawing " + names.join(", ").toLowerCase() : "";
  }
  function trackLoading(layer, label) {
    (layer.eachLayer ? layer.getLayers() : [layer]).forEach(function (l) {
      if (!l.on) return;
      l.on("loading", function () { if (!l._tractBusy) { l._tractBusy = true; busy[label] = (busy[label] || 0) + 1; showBusy(); } });
      l.on("load", function () { if (l._tractBusy) { l._tractBusy = false; busy[label] = Math.max(0, (busy[label] || 1) - 1); showBusy(); } });
      l.on("remove", function () { if (l._tractBusy) { l._tractBusy = false; busy[label] = Math.max(0, (busy[label] || 1) - 1); showBusy(); } });
    });
    return layer;
  }
  function setLayerOpacity(layer, o) {
    if (!layer) return;
    if (layer.tractOpacity) layer.tractOpacity(o);
    else if (layer.setOpacity) layer.setOpacity(o);
    else if (layer.eachLayer) layer.eachLayer(function (l) { setLayerOpacity(l, o); });
  }
  function applyLocalOverlays() {
    Object.keys(localOverlays).forEach(function (f) {
      ["zoning", "plan", "cases"].forEach(function (k) {
        var l = localOverlays[f][k];
        var want = f === activeFips && isOn(k);
        if (l && !want && map.hasLayer(l)) map.removeLayer(l);
      });
    });
    if (!activeFips) return;
    ["zoning", "plan", "cases"].forEach(function (k) {
      if (!isOn(k)) return;
      var l = getLocal(activeFips, k);
      if (l && !map.hasLayer(l)) addAndDraw(l);
    });
  }
  function applyEnv() {
    Object.keys(ENV).forEach(function (k) {
      var on = isOn(k);
      if (on && !envLayers[k]) envLayers[k] = trackLoading(L.esri.dynamicMapLayer({ url: ENV[k].url, layers: [ENV[k].layer], opacity: opacity[k] != null ? opacity[k] : ENV[k].opacity, minZoom: ENV[k].minZoom, format: "png32" }), k === "flood" ? "Flood zones" : "Wetlands");
      if (!envLayers[k]) return;
      if (on && !map.hasLayer(envLayers[k])) addAndDraw(envLayers[k]);
      if (!on && map.hasLayer(envLayers[k])) map.removeLayer(envLayers[k]);
    });
  }
  function toggle(key, on) {
    layerState[key] = on;
    saveLayers();
    if (key === "parcels") { if (on) vginLayer.addTo(map); else map.removeLayer(vginLayer); }
    else if (key === "states" || key === "counties") applyBoundaryToggles();
    else if (ENV[key]) applyEnv();
    else applyLocalOverlays();
    if (on && map.getZoom() < 11 && (ENV[key] || key === "zoning" || key === "plan" || key === "cases")) u.toast("Zoom in to a town or closer to see this layer.");
    if (on && key === "parcels" && map.getZoom() < 16) u.toast("Parcel lines appear when you zoom in close.");
    T.emit("layers", layerState);
  }

  // Which supported county is in the middle of the map (no network call: uses the boundary file)
  function trackLocality() {
    var c = map.getCenter();
    var p = map.getZoom() >= 9 ? localityAt(c.lng, c.lat) : null;
    var fips = p ? p.fips : null;
    if (fips !== activeFips) {
      activeFips = fips;
      applyLocalOverlays();
      T.emit("locality", fips);
    }
  }
  map.on("moveend", trackLocality);
  applyEnv();

  // ---------------------------------------------------------------- legends
  var legendCache = {};
  function serverLegend(url, layerId) {
    var k = url + "|" + layerId;
    if (!legendCache[k]) {
      legendCache[k] = fetch(url + "/legend?f=json").then(function (r) { return r.json(); }).then(function (j) {
        var lyr = (j.layers || []).filter(function (l) { return l.layerId === layerId; })[0];
        return lyr ? lyr.legend.map(function (e) { return { label: e.label || lyr.layerName, img: "data:" + (e.contentType || "image/png") + ";base64," + e.imageData }; }) : [];
      }).catch(function () { return []; });
    }
    return legendCache[k];
  }
  function legendFor(kind, cfg) {
    if (ENV[kind]) return serverLegend(ENV[kind].url, ENV[kind].layer);
    if (!cfg) return Promise.resolve([]);
    if (kind === "cases") return Promise.resolve([{ label: "Case areas", color: cssVar("--case") || "#2F5D9E", outline: true }]);
    if (cfg.kind === "map") return serverLegend(cfg.url, cfg.layer);
    return gis.layerMeta(cfg).then(function (m) {
      return Object.keys(m.colors).map(function (k) { return { label: m.labels[k] ? k + " · " + m.labels[k] : k, color: m.colors[k] }; });
    });
  }
  function legendEl(kind, cfg) {
    var box = h("div", { class: "legend" }, u.loading("Loading legend"));
    legendFor(kind, cfg).then(function (items) {
      u.clear(box);
      if (!items.length) { box.append(h("div", { class: "sub" }, "Colors come from the county's own map.")); return; }
      var shown = items.slice(0, 14);
      shown.forEach(function (it) {
        box.append(h("div", { class: "legend-row" },
          it.img ? h("img", { src: it.img, alt: "", width: "16", height: "16" }) : h("span", { class: "swatch" + (it.outline ? " outline" : ""), style: "--sw:" + it.color }),
          h("span", null, it.label)));
      });
      if (items.length > shown.length) box.append(h("div", { class: "sub" }, (items.length - shown.length) + " more categories on the map"));
    });
    return box;
  }

  // ---------------------------------------------------------------- layers panel (Map view)
  function layerRow(key, label, opts) {
    opts = opts || {};
    var on = isOn(key) && !opts.disabled;
    var cb = h("input", { type: "checkbox", id: "lyr-" + key, checked: on, disabled: opts.disabled });
    cb.addEventListener("change", function () { toggle(key, cb.checked); renderInto(); });
    var row = h("div", { class: "layer-row" + (opts.disabled ? " disabled" : "") },
      h("label", { for: "lyr-" + key, class: "layer-label" }, cb, h("span", { class: "check" }), h("span", null, label, opts.sub ? h("small", null, opts.sub) : null)));
    if (on && opts.opacity) {
      var current = opacity[key] != null ? opacity[key] : opts.opacity;
      var slider = h("input", { type: "range", min: "0.1", max: "1", step: "0.05", value: String(current), "aria-label": label + " opacity" });
      slider.addEventListener("input", function () {
        opacity[key] = +slider.value; saveLayers();
        if (ENV[key]) setLayerOpacity(envLayers[key], +slider.value);
        else if (activeFips && localOverlays[activeFips]) setLayerOpacity(localOverlays[activeFips][key], +slider.value);
      });
      row.append(h("div", { class: "opacity" }, h("span", null, "Opacity"), slider));
    }
    if (on && opts.legend) row.append(legendEl(key, opts.cfg));
    return row;
  }
  var panelEl = null;
  function renderLayers(el) { panelEl = el; renderInto(); }
  function renderInto() {
    if (!panelEl) return;
    var el = u.clear(panelEl);
    el.append(h("div", { class: "view-head" }, h("div", { class: "eyebrow" }, "Map"), h("h2", { class: "title" }, "Layers")));

    var bm = h("div", { class: "basemaps" });
    BASEMAPS.forEach(function (b) {
      bm.append(h("button", { type: "button", class: "basemap", "aria-pressed": b.key === currentBase ? "true" : "false", onclick: function () { setBase(b.key); renderInto(); } },
        h("img", { src: b.thumb, alt: "", loading: "lazy", class: b.key === "clean" ? "tile-clean" : "" }), h("span", null, b.label)));
    });
    el.append(h("section", { class: "layer-group" }, h("h3", { class: "group-title" }, "Base map"), bm));

    el.append(h("section", { class: "layer-group" }, h("h3", { class: "group-title" }, "Boundaries"),
      layerRow("states", "State lines"),
      layerRow("counties", "County and city lines", { sub: "Names show from region to town zoom" }),
      layerRow("parcels", "Parcel lines", { sub: "Statewide (VGIN). Zoom in close to see them." })));

    var loc = activeFips && REG.byFips[activeFips];
    var p = activeFips && localityAt(map.getCenter().lng, map.getCenter().lat);
    var name = loc ? loc.name : p ? p.name : null;
    var plan = h("section", { class: "layer-group" }, h("h3", { class: "group-title" }, "Planning", name ? h("span", { class: "group-sub" }, name) : null));
    if (!activeFips) plan.append(h("div", { class: "sub" }, "Zoom in to a county to see its zoning, future land use and cases."));
    else if (!loc) plan.append(h("div", { class: "sub" }, name + " isn't connected in Tract yet, so its planning layers aren't available here."));
    [["zoning", "Zoning"], ["plan", "Future land use"], ["cases", "Rezoning and land use cases"]].forEach(function (x) {
      var cfg = activeFips ? localCfg(activeFips, x[0]) : null;
      if (activeFips && loc) plan.append(layerRow(x[0], x[1], { disabled: !cfg, sub: cfg ? null : "Not published by this county", opacity: x[0] === "cases" ? 0.75 : 0.55, legend: true, cfg: x[0] === "cases" ? cfg && cfg[0] : cfg }));
    });
    el.append(plan);

    var env = h("section", { class: "layer-group" }, h("h3", { class: "group-title" }, "Environment", h("span", { class: "group-sub" }, "Statewide")));
    Object.keys(ENV).forEach(function (k) { env.append(layerRow(k, ENV[k].label, { sub: ENV[k].note, opacity: ENV[k].opacity, legend: true })); });
    el.append(env);

    el.append(h("section", { class: "layer-group" }, h("h3", { class: "group-title" }, "Tools"),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn", onclick: startMeasure }, u.icon("ruler"), "Measure distance and area"),
        h("button", { type: "button", class: "btn", onclick: function () { map.flyTo([37.95, -78.75], 7); } }, u.icon("map"), "All of Virginia"))));
  }
  T.on("locality", function () { renderInto(); });
  T.on("boundaries", function () { renderInto(); });

  // ---------------------------------------------------------------- measuring
  var measure = { on: false, pts: [], layer: L.layerGroup().addTo(map), box: null };
  function fmtDist(m) { var ft = m * 3.28084; return ft < 2000 ? Math.round(ft).toLocaleString() + " ft" : (m / 1609.34).toFixed(2) + " mi"; }
  function drawMeasure() {
    measure.layer.clearLayers();
    var lls = measure.pts.map(function (p) { return [p[1], p[0]]; });
    var color = cssVar("--brass") || "#D4A24C";
    lls.forEach(function (x) { L.circleMarker(x, { radius: 4, color: color, weight: 2, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(measure.layer); });
    if (lls.length >= 3) L.polygon(lls, { color: color, weight: 2, dashArray: "6 5", fillOpacity: 0.12, interactive: false }).addTo(measure.layer);
    else if (lls.length === 2) L.polyline(lls, { color: color, weight: 2, dashArray: "6 5", interactive: false }).addTo(measure.layer);
    var d = 0;
    for (var i = 1; i < measure.pts.length; i++) d += geo.distMeters(measure.pts[i - 1], measure.pts[i]);
    var ring = measure.pts.length >= 3 ? measure.pts.concat([measure.pts[0]]) : null;
    var area = ring ? geo.geomAcres({ type: "Polygon", coordinates: [ring] }) : null;
    var perimeter = ring ? d + geo.distMeters(measure.pts[measure.pts.length - 1], measure.pts[0]) : null;
    var out = u.$("measure-out");
    if (out) out.textContent = measure.pts.length < 2 ? "Tap the map to add points." :
      (area != null ? u.acresFmt(area) + " · perimeter " + fmtDist(perimeter) : fmtDist(d));
  }
  function startMeasure() {
    stopMeasure();
    measure.on = true; measure.pts = [];
    map.getContainer().classList.add("measuring");
    measure.box = h("div", { class: "measure-box", role: "status" },
      h("strong", null, "Measure"), h("span", { id: "measure-out" }, "Tap the map to add points."),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn small", onclick: function () { measure.pts.pop(); drawMeasure(); } }, "Undo"),
        h("button", { type: "button", class: "btn small primary", onclick: stopMeasure }, "Done")));
    u.$("stage").append(measure.box);
    T.emit("measure", true);
  }
  function stopMeasure() {
    measure.on = false; measure.pts = [];
    measure.layer.clearLayers();
    map.getContainer().classList.remove("measuring");
    if (measure.box) { measure.box.remove(); measure.box = null; }
    T.emit("measure", false);
  }

  // Clicks: measuring first, then whatever the app wants (parcel identify)
  map.on("click", function (e) {
    if (measure.on) { measure.pts.push([e.latlng.lng, e.latlng.lat]); drawMeasure(); return; }
    T.emit("mapclick", e.latlng);
  });

  // ---------------------------------------------------------------- coordinates readout
  var status = u.$("map-status");
  var lastMove = 0;
  map.on("mousemove", function (e) {
    var now = Date.now(); if (now - lastMove < 80 || !status) return; lastMove = now;
    var p = localityAt(e.latlng.lng, e.latlng.lat);
    status.textContent = e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5) + (p ? " · " + p.name : "");
  });

  // ---------------------------------------------------------------- shared helpers for other views
  function dot(lat, lng, opts) {
    opts = opts || {};
    var m = L.marker([lat, lng], { title: opts.title || "", riseOnHover: true,
      icon: L.divIcon({ className: "", html: '<div class="marker-dot ' + (opts.cls || "") + '"' + (opts.color ? ' style="--dot:' + opts.color + '"' : "") + "></div>", iconSize: [16, 16], iconAnchor: [8, 8] }) });
    if (opts.onClick) m.on("click", function (ev) { L.DomEvent.stopPropagation(ev); opts.onClick(); });
    if (opts.tip) m.bindTooltip(opts.tip, { direction: "top", offset: [0, -8] });
    return m.addTo(opts.layer || results);
  }
  function fitLayer(layer, maxZoom) {
    var ls = layer.getLayers ? layer.getLayers() : [];
    if (!ls.length) return;
    var b = L.featureGroup(ls).getBounds();
    if (b.isValid()) map.fitBounds(b, { maxZoom: maxZoom || 15, padding: [50, 50] });
  }

  T.map = {
    map: map,
    setBase: setBase,
    BASEMAPS: BASEMAPS,
    renderLayers: renderLayers,
    toggle: toggle,
    isOn: isOn,
    localityAt: localityAt,
    localities: function () { return localities; },
    boundariesReady: boundariesReady,
    activeFips: function () { return activeFips; },
    selectLayer: selectLayer,
    results: results,
    clearResults: function () { results.clearLayers(); },
    fitResults: function (z) { fitLayer(results, z); },
    fitLayer: fitLayer,
    dot: dot,
    startMeasure: startMeasure,
    stopMeasure: stopMeasure,
    measuring: function () { return measure.on; },
    cssVar: cssVar
  };
})();
