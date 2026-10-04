/*
 * Tract parcel report: tap a parcel, read the state outline, then everything the county publishes
 * (owner, values, sale, zoning, plan, service areas, cases, nearby values and land sales).
 * Shows in the identify card (right side on laptops, bottom sheet on phones) with an X to close.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, gis = T.gis, geo = T.geo, REG = T.REG, h = u.h;
  var clean = u.clean, num = u.num, money = u.money, moneyFull = u.moneyFull, acresFmt = u.acresFmt, dateFmt = u.dateFmt, toDate = u.toDate;
  var VGIN = REG.VGIN;
  var M = T.map;

  var current = null;
  var token = 0;
  var card = u.$("identify"), body = u.$("identify-body");

  // Render at most once per frame: county answers arrive in bursts and phones redraw slowly
  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    var done = false;
    function go() { if (done) return; done = true; pending = false; renderReport(); }
    requestAnimationFrame(go);
    setTimeout(go, 120); // animation frames pause in background tabs
  }

  function openCard() {
    card.hidden = false;
    document.documentElement.classList.add("has-identify");
    if (window.innerWidth < 900) card.setAttribute("data-state", card.getAttribute("data-state") === "full" ? "full" : "half");
  }
  function closeParcel() {
    token++;
    current = null;
    M.selectLayer.clearLayers();
    card.hidden = true;
    document.documentElement.classList.remove("has-identify");
    try { history.replaceState(null, "", location.pathname + (T.view ? "#" + T.view : "")); } catch (e) { /* ignore */ }
    T.emit("parcel", null);
  }
  u.$("identify-close").addEventListener("click", closeParcel);
  u.$("identify-handle").addEventListener("click", function () {
    var s = card.getAttribute("data-state");
    card.setAttribute("data-state", s === "half" ? "full" : "half");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && current && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !M.measuring()) closeParcel();
  });

  async function selectParcel(lng, lat, opts) {
    opts = opts || {};
    var my = ++token;
    current = { token: my, lng: lng, lat: lat, sections: {} };
    openCard();
    body.scrollTop = 0;
    render();
    M.selectLayer.clearLayers();
    try {
      var g = await gis.ags(VGIN.feature, { geometry: gis.pointGeom(lng, lat), geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects",
        outFields: "FIPS,LOCALITY,PARCELID,PTM_ID,LASTUPDATE", returnGeometry: true, outSR: 4326, f: "geojson" });
      if (my !== token) return;
      var feat = g.features && g.features[0];
      if (!feat) { current.none = true; render(); return; }
      var p = feat.properties || {};
      current.vgin = { fips: String(p.FIPS || ""), locality: p.LOCALITY, parcelId: p.PARCELID, ptm: p.PTM_ID, updated: p.LASTUPDATE, geometry: feat.geometry, acresCalc: geo.geomAcres(feat.geometry) };
      current.loc = REG.byFips[current.vgin.fips] || null;
      var brass = M.cssVar("--brass") || "#D4A24C";
      var gj = L.geoJSON(feat.geometry, { interactive: false, style: { color: brass, weight: 3, fillColor: brass, fillOpacity: 0.16 } }).addTo(M.selectLayer);
      keepVisible(gj.getBounds(), lat, lng, opts.fit);
      try { history.replaceState(null, "", "#p=" + lat.toFixed(6) + "," + lng.toFixed(6)); } catch (e) { /* ignore */ }
      T.emit("parcel", current);
      render();
      loadCountyData(my);
      loadConstraints(my);
    } catch (e) {
      if (my !== token) return;
      current.error = "The state parcel service didn't answer. Check your connection and tap the parcel again.";
      render();
    }
  }

  // The card covers part of the map (bottom on phones, right side on laptops); keep the parcel in the open part
  function keepVisible(bounds, lat, lng, fit) {
    var phone = window.innerWidth < 900;
    var padTL = phone ? [20, 70] : [60, 80];
    var padBR = phone ? [20, card.offsetHeight + 20] : [card.offsetWidth + 40, 40];
    if (fit) { M.map.fitBounds(bounds, { maxZoom: 18, paddingTopLeft: padTL, paddingBottomRight: padBR }); return; }
    var size = M.map.getSize(), pt = M.map.latLngToContainerPoint([lat, lng]);
    var dx = 0, dy = 0;
    if (pt.x > size.x - padBR[0]) dx = pt.x - (size.x - padBR[0]) + 40;
    if (pt.y > size.y - padBR[1]) dy = pt.y - (size.y - padBR[1]) + 40;
    if (dx || dy) M.map.panBy([dx, dy]);
  }

  function sec(name, state) { if (current) current.sections[name] = state; }

  // ---------------------------------------------------------------- net developable acres
  // Floodplain (FEMA, statewide), wetlands (USFWS NWI, statewide) and the county RPA where published.
  // Overlaps are counted once by sampling a grid of points across the parcel: a point in any constraint is
  // constrained, so each acre is subtracted once no matter how many layers cover it.
  var CONSTRAINTS = [
    { key: "flood", label: "Floodplain", url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28", where: "SFHA_TF = 'T'" },
    { key: "wetland", label: "Wetlands", url: "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0", where: "1=1" }
  ];
  function geoBbox(g) {
    var b = [180, 90, -180, -90];
    geo.polysOf(g).forEach(function (p) { p.forEach(function (ring) { ring.forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); });
    return b;
  }
  async function loadConstraints(my) {
    var r = current, g = r.vgin.geometry, b = geoBbox(g);
    var env = { xmin: b[0], ymin: b[1], xmax: b[2], ymax: b[3], spatialReference: { wkid: 4326 } };
    var layers = CONSTRAINTS.slice();
    if (r.loc && r.loc.rpa) layers.push({ key: "rpa", label: "Resource protection area", url: gis.layerUrl(r.loc.rpa), where: "1=1" });
    sec("net", "loading");
    var polys = await Promise.all(layers.map(function (c) {
      return gis.inEnvelope(c.url, env, { where: c.where, outFields: "*", returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.00003, resultRecordCount: 500 }, { timeout: 25000 })
        .then(function (j) { return (j.features || []).filter(function (x) { return x.geometry && x.geometry.rings; }).map(function (x) { return { rings: x.geometry.rings, bb: ringsBbox(x.geometry.rings) }; }); })
        .catch(function () { return null; });
    }));
    if (my !== token) return;
    // Grid of about 900 points over the bounding box, kept where they fall inside the parcel
    var steps = 30, dx = (b[2] - b[0]) / steps, dy = (b[3] - b[1]) / steps, inside = 0, any = 0, per = layers.map(function () { return 0; });
    for (var i = 0; i < steps; i++) for (var j = 0; j < steps; j++) {
      var pt = [b[0] + (i + 0.5) * dx, b[1] + (j + 0.5) * dy];
      if (!geo.pointInGeom(pt, g)) continue;
      inside++;
      var hitAny = false;
      polys.forEach(function (list, k) {
        if (!list) return;
        for (var q = 0; q < list.length; q++) {
          var bb = list[q].bb;
          if (pt[0] < bb[0] || pt[0] > bb[2] || pt[1] < bb[1] || pt[1] > bb[3]) continue;
          if (geo.pointInRings(pt, list[q].rings)) { per[k]++; hitAny = true; break; }
        }
      });
      if (hitAny) any++;
    }
    // Fractions only; acres are applied when the report draws, once the county acreage has arrived
    r.net = inside ? {
      parts: layers.map(function (c, k) { return { label: c.label, frac: polys[k] ? per[k] / inside : null }; }),
      anyFrac: any / inside,
      missing: layers.filter(function (c, k) { return !polys[k]; }).map(function (c) { return c.label; }),
      noRpa: !(r.loc && r.loc.rpa)
    } : null;
    sec("net", "done");
    render();
  }
  function ringsBbox(rings) {
    var b = [180, 90, -180, -90];
    rings.forEach(function (ring) { ring.forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); });
    return b;
  }

  // Rough homes-per-acre ranges. Counties named in R-number style (Fairfax, Loudoun, Prince William) put the
  // density in the code (R-4 = 4 per acre, PDH-3 = 3); elsewhere the district or plan name decides the range.
  function zoningDensity(code, name, loc) {
    var c = String(code || "").toUpperCase().trim(), t = (c + " " + (name || "")).toLowerCase();
    if (loc && loc.zoningDensity === "rn") {
      var m = c.match(/^(?:R|PDH|PD-H|PRC|RM)-?(\d+(?:\.\d+)?)/);
      if (m && +m[1] <= 40) return { lo: +m[1] * 0.7, hi: +m[1], basis: c + " allows up to " + m[1] + " per acre" };
    }
    if (/commercial|business|industrial|office|^B-?\d|^M-?\d|^I-?\d|^C-?\d|employment|data center/.test(t) && !/residential|mixed/.test(t)) return { none: true, basis: "not a residential district" };
    if (/agric|^a-?\d|^ar|^ra\b|^a\b|farm/.test(t)) return { lo: 0.05, hi: 0.2, basis: "farm zoning, about 1 home per 5 to 20 acres" };
    if (/conservation|^r-?c\b/.test(t)) return { lo: 0.05, hi: 0.2, basis: "conservation zoning" };
    if (/rural|estate|^rr|^re\b|^r-?e\b/.test(t)) return { lo: 0.2, hi: 0.5, basis: "rural or estate lots" };
    if (/townho|attached|\bth\b/.test(t)) return { lo: 6, hi: 12, basis: "townhouse district" };
    if (/multi|apartment|^rm|^r-?m\b|^mf/.test(t)) return { lo: 12, hi: 24, basis: "multifamily district" };
    if (/residential|one-family|single|^r-?\d|^rs|^sr|^pd/.test(t)) return { lo: 1, hi: 4, basis: "single-family district" };
    return null;
  }
  function planDensity(text) {
    var t = String(text || "").toLowerCase();
    var range = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(?:du|units|dwelling)/);
    if (range) return { lo: +range[1], hi: +range[2], basis: "plan range " + range[1] + " to " + range[2] + " per acre" };
    var one = t.match(/(\d+(?:\.\d+)?)\s*(?:du|units)\s*(?:\/|per)\s*ac/);
    if (one) return { lo: +one[1] * 0.6, hi: +one[1], basis: "plan up to " + one[1] + " per acre" };
    var rn = t.match(/residential(?: neighborhood)?\s+(\d+(?:\.\d+)?)\b/);
    if (rn && +rn[1] <= 40) return { lo: +rn[1] * 0.5, hi: +rn[1], basis: "plan category number read as up to " + rn[1] + " per acre" };
    if (/commercial|industrial|office|employment|business|government|park|open space|semi-public/.test(t) && !/residential|mixed/.test(t)) return { none: true, basis: "not a residential plan category" };
    if (/rural residential/.test(t)) return { lo: 0.2, hi: 1, basis: "rural residential" };
    if (/rural|agric|conservation|preserv/.test(t)) return { lo: 0.05, hi: 0.2, basis: "rural or agricultural plan" };
    if (/suburban residential 1|\bsr1\b/.test(t)) return { lo: 1, hi: 2.4, basis: "Suburban Residential 1" };
    if (/suburban residential 2|\bsr2\b/.test(t)) return { lo: 2.4, hi: 3.4, basis: "Suburban Residential 2" };
    if (/urban residential|\bur\b/.test(t)) return { lo: 3.4, hi: 6.8, basis: "urban residential" };
    if (/high density|multi-family|multifamily|\bmfr\b/.test(t)) return { lo: 12, hi: 20, basis: "high density or multifamily" };
    if (/medium.high|medium-high/.test(t)) return { lo: 8, hi: 12, basis: "medium-high density" };
    if (/medium/.test(t)) return { lo: 4, hi: 8, basis: "medium density" };
    if (/low density|low-density/.test(t)) return { lo: 1, hi: 2.5, basis: "low density" };
    if (/mixed|town center|village|traditional neighborhood|tnd/.test(t)) return { lo: 4, hi: 12, basis: "mixed use or village" };
    if (/suburban|neighborhood|residential|transition/.test(t)) return { lo: 2, hi: 4, basis: "suburban residential" };
    return null;
  }
  function unitsText(d, acres) {
    if (!d) return null;
    if (d.none) return "None (" + d.basis + ")";
    var lo = Math.floor(acres * d.lo), hi = Math.floor(acres * d.hi);
    return (lo === hi ? "About " + hi : "About " + lo + " to " + hi) + " homes (" + d.basis + ")";
  }

  async function loadCountyData(my) {
    var r = current, loc = r.loc;
    if (!loc) { render(); return; }
    var jobs = [];
    if (loc.parcel) jobs.push(loadParcel(my));
    if (loc.zoning) jobs.push(loadLayerAt(my, "zoning", loc.zoning));
    if (loc.plan) jobs.push(loadLayerAt(my, "plan", loc.plan));
    if (loc.policy) jobs.push(loadLayerAt(my, "policy", loc.policy));
    if (loc.areas) jobs.push(loadAreas(my));
    if (loc.cases) jobs.push(loadCases(my));
    await Promise.all(jobs);
  }

  // Yes/no and value checks at the point: service districts, growth areas, county build-out estimates
  async function loadAreas(my) {
    var r = current;
    r.areas = [];
    sec("areas", "loading");
    await Promise.all(r.loc.areas.map(async function (cfg, i) {
      try {
        var j = await gis.atPoint(gis.layerUrl(cfg), r.lng, r.lat);
        var a = j.features && j.features[0] && j.features[0].attributes;
        var text = a ? cfg.show(a) : cfg.none || null;
        if (text) r.areas[i] = [cfg.label, text];
      } catch (e) { /* skip one that fails */ }
    }));
    if (my !== token) return;
    sec("areas", "done");
    render();
  }

  async function loadParcel(my) {
    var r = current, pl = r.loc.parcel;
    sec("parcel", "loading");
    try {
      var j = await gis.atPoint(pl.url, r.lng, r.lat);
      if (my !== token) return;
      var feats = j.features || [];
      r.county = feats.length ? gis.mapAttrs(feats[0].attributes, pl.f) : null;
      sec("parcel", feats.length ? "done" : "none");
      render();
      var id = r.county && r.county.id;
      if (r.loc.joins && id) await loadJoins(my, id);
      if (r.loc.nearby) loadNearby(my);
    } catch (e) {
      if (my !== token) return;
      sec("parcel", "error"); render();
    }
  }

  async function loadJoins(my, id) {
    var r = current;
    r.join = {};
    await Promise.all(r.loc.joins.map(async function (jn) {
      var fields = Object.keys(jn.f).map(function (k) { return jn.f[k]; });
      var res;
      try { res = await gis.ags(jn.url, { where: jn.key + " = '" + u.sq(id) + "'", outFields: fields.join(","), returnGeometry: false }); }
      catch (e) {
        if (/^\d+$/.test(String(id))) { try { res = await gis.ags(jn.url, { where: jn.key + " = " + id, outFields: fields.join(","), returnGeometry: false }); } catch (e2) { return; } }
        else return;
      }
      var rows = (res.features || []).map(function (x) { return gis.mapAttrs(x.attributes, jn.f); });
      var latestField = jn.latest ? Object.keys(jn.f).filter(function (k) { return jn.f[k] === jn.latest; })[0] : null;
      if (latestField) rows.sort(function (a, b) { return (toDate(b[latestField]) || 0) - (toDate(a[latestField]) || 0) || (num(b[latestField]) || 0) - (num(a[latestField]) || 0); });
      if (rows[0]) Object.keys(rows[0]).forEach(function (k) { if (r.join[k] == null) r.join[k] = rows[0][k]; });
    }));
    if (my !== token) return;
    render();
  }

  async function loadLayerAt(my, key, cfg) {
    var r = current;
    sec(key, "loading");
    try {
      var res = await Promise.all([gis.atPoint(gis.layerUrl(cfg), r.lng, r.lat), gis.layerLabels(cfg)]);
      if (my !== token) return;
      r[key] = (res[0].features || []).map(function (x) { return x.attributes; });
      r.labels = r.labels || {};
      r.labels[key] = res[1];
      sec(key, "done");
    } catch (e) { if (my !== token) return; sec(key, "error"); }
    render();
  }

  function pointInParcel(pt) { return !!(current && current.vgin && geo.pointInGeom(pt, current.vgin.geometry)); }

  async function loadCases(my) {
    var r = current;
    sec("cases", "loading");
    var env = gis.envelope(r.lng, r.lat, 1300);
    var out = [];
    await Promise.all(r.loc.cases.map(async function (cfg) {
      try {
        var j = await gis.inEnvelope(gis.layerUrl(cfg), env, { returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0003, resultRecordCount: 200 });
        (j.features || []).forEach(function (x) {
          var rings = x.geometry && x.geometry.rings;
          var pt = x.geometry && x.geometry.x != null ? [x.geometry.x, x.geometry.y] : null;
          var c = pt || geo.ringsCentroid(rings);
          // Polygon cases: does the case cover the tapped point? Point cases: is the point inside this parcel?
          var onParcel = rings ? geo.pointInRings([r.lng, r.lat], rings) : pt ? pointInParcel(pt) : false;
          var wide = false;
          if (rings && rings[0]) { var xs = rings[0].map(function (p) { return p[0]; }); wide = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) > 0.15; }
          var m = gis.mapAttrs(x.attributes, cfg.f);
          if (!clean(m.number) && !clean(m.name) && !clean(m.alt) && !clean(m.desc) && !(cfg.f && cfg.f.any)) return; // blank zoning history rows
          out.push({ cfg: cfg, a: x.attributes, m: m, dist: c ? geo.distMeters([r.lng, r.lat], c) : null, onParcel: onParcel && !wide, wide: wide, center: c });
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
    render();
  }

  // ---------------------------------------------------------------- nearby values and land sales
  async function loadNearby(my) {
    var r = current, mode = r.loc.nearby.mode;
    sec("nearby", "loading"); render();
    try {
      if (mode === "fields") await nearbyFromFields(my);
      else if (mode === "join") await nearbyFromJoin(my);
      if (my !== token) return;
      sec("nearby", "done");
    } catch (e) { if (my !== token) return; sec("nearby", "error"); }
    render();
  }

  function summarizeHomes(rows) {
    var cutoff = new Date(T.YEAR - 2, T.NOW.getMonth(), T.NOW.getDate());
    var totals = [], newer = [], sales = [], ppsf = [];
    rows.forEach(function (m) {
      var total = num(m.total); if (total == null && num(m.land) != null && num(m.impr) != null) total = num(m.land) + num(m.impr);
      if (total != null && total > 0) totals.push(total);
      var yb = num(m.yearBuilt);
      if (yb && yb >= T.YEAR - 10 && total) newer.push(total);
      var sd = toDate(m.saleDate), sp = num(m.salePrice);
      if (sd && sd >= cutoff && sp && sp > 75000) { sales.push(sp); var la = num(m.livingArea); if (la && la > 400) ppsf.push(sp / la); }
    });
    return { count: totals.length, medianValue: u.median(totals), newerCount: newer.length, medianNewer: u.median(newer), salesCount: sales.length, medianSale: u.median(sales), medianPpsf: u.median(ppsf) };
  }

  async function nearbyFromFields(my) {
    var r = current, pl = r.loc.parcel, f = pl.f;
    var want = ["total", "land", "impr", "yearBuilt", "saleDate", "salePrice", "livingArea"].map(function (k) { return f[k]; }).filter(Boolean);
    if (!f.impr || !want.length) { r.nearby = { unavailable: true }; return; }
    var res = await gis.inEnvelope(pl.url, gis.envelope(r.lng, r.lat, 800), { where: gis.nf(pl, f.impr) + " > 50000", outFields: want.join(","), resultRecordCount: 2000 });
    if (my !== token) return;
    r.nearby = summarizeHomes((res.features || []).map(function (x) { return gis.mapAttrs(x.attributes, f); }));
    r.nearby.radius = "half a mile";
    // Land sales: vacant parcels of an acre or more that sold in the last five years, within two miles
    if (f.acres && f.salePrice && f.saleDate) {
      var landFields = ["acres", "areaSqft", "salePrice", "saleDate", "owner", "address", "id", "zoningCode"].map(function (k) { return f[k]; }).filter(Boolean);
      var where = "(" + gis.nf(pl, f.impr) + " = 0 OR " + f.impr + " IS NULL) AND " + gis.nf(pl, f.salePrice) + " > 20000 AND " + gis.nf(pl, f.acres) + " >= 1";
      try {
        var lr = await gis.inEnvelope(pl.url, gis.envelope(r.lng, r.lat, 3200), { where: where, outFields: landFields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0005, resultRecordCount: 500 });
        var cut = new Date(T.YEAR - 5, T.NOW.getMonth(), T.NOW.getDate());
        var land = (lr.features || []).map(function (x) {
          var m = gis.mapAttrs(x.attributes, f); m.center = geo.ringsCentroid(x.geometry && x.geometry.rings); return m;
        }).filter(function (m) { var d = toDate(m.saleDate); return d && d >= cut && num(m.acres) > 0; });
        land.forEach(function (m) { m.perAcre = num(m.salePrice) / num(m.acres); });
        land.sort(function (a, b) { return toDate(b.saleDate) - toDate(a.saleDate); });
        r.landSales = { rows: land.slice(0, 12), count: land.length, medianPerAcre: u.median(land.map(function (m) { return m.perAcre; })) };
      } catch (e) { r.landSales = { error: true }; }
    }
  }

  async function nearbyFromJoin(my) {
    var r = current, loc = r.loc, pl = loc.parcel;
    var res = await gis.inEnvelope(pl.url, gis.envelope(r.lng, r.lat, 700), { outFields: pl.idField, resultRecordCount: 1000 });
    var ids = (res.features || []).map(function (x) { return x.attributes[pl.idField]; }).filter(Boolean).slice(0, 600);
    if (!ids.length) { r.nearby = { count: 0 }; return; }
    var vj = loc.joins[loc.nearby.values], sj = loc.joins[loc.nearby.sales];
    var byId = {};
    var chunks = []; for (var i = 0; i < ids.length; i += 120) chunks.push(ids.slice(i, i + 120));
    await Promise.all(chunks.map(async function (ch) {
      var inList = ch.map(function (x) { return "'" + u.sq(x) + "'"; }).join(",");
      var fields = Object.keys(vj.f).map(function (k) { return vj.f[k]; }).concat([vj.key]);
      try {
        var vr = await gis.ags(vj.url, { where: vj.key + " IN (" + inList + ")", outFields: fields.join(","), returnGeometry: false });
        (vr.features || []).forEach(function (x) {
          var id = x.attributes[vj.key], m = gis.mapAttrs(x.attributes, vj.f);
          var prev = byId[id];
          if (!prev || (num(m.taxYear) || 0) > (num(prev.taxYear) || 0) || (toDate(m.saleDate) || 0) > (toDate(prev.saleDate) || 0)) byId[id] = Object.assign({}, prev || {}, m);
        });
      } catch (e) { /* skip chunk */ }
      if (sj && sj !== vj) {
        try {
          var since = new Date(T.YEAR - 2, T.NOW.getMonth(), T.NOW.getDate()).toISOString().slice(0, 10);
          var sfields = Object.keys(sj.f).map(function (k) { return sj.f[k]; }).concat([sj.key]);
          var sr = await gis.ags(sj.url, { where: sj.key + " IN (" + inList + ") AND " + sj.f.saleDate + " >= DATE '" + since + "'", outFields: sfields.join(","), returnGeometry: false });
          (sr.features || []).forEach(function (x) {
            var id = x.attributes[sj.key], m = gis.mapAttrs(x.attributes, sj.f);
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

  // ---------------------------------------------------------------- signals
  // Plain flags a land buyer looks for. Each is read from what the county publishes; none is a guess about a person.
  var ESTATE_RE = /\b(ESTATE|EST OF|EST\b|HEIRS?|ET\s?ALS?|DECEASED|DEC'?D|LIFE ESTATE|L\/E|LIFE TENANT)\b/i;
  var TRUST_RE = /\b(TRUST|TRUSTEES?|TRS?|REV TR|LIV(ING)? TR)\b/i;
  var ENTITY_RE = /\b(LLC|L\.L\.C|INC|CORP|COMPANY|CO\b|LP|L\.P|LTD|PARTNERS|HOLDINGS|PROPERTIES|INVESTMENTS?|DEVELOPMENT|HOMES|BUILDERS?|REALTY|LAND)\b/i;
  function signalsFor(m, r) {
    var out = [];
    var owner = [clean(m.owner), clean(m.owner2)].join(" ").trim();
    if (ESTATE_RE.test(owner)) out.push({ t: "Estate or heirs", d: "Owner name reads as an estate, heirs or life estate. Often a family deciding what to do with the land.", cls: "gold" });
    else if (TRUST_RE.test(owner)) out.push({ t: "Held in trust", d: "Owner is a trust, often estate planning by an older owner.", cls: "gray" });
    var sd = toDate(m.saleDate);
    if (sd && sd.getFullYear() > 1900 && T.YEAR - sd.getFullYear() >= 20) out.push({ t: "Owned " + (T.YEAR - sd.getFullYear()) + " years", d: "Last sale in " + sd.getFullYear() + ".", cls: "gray" });
    if (sd && num(m.salePrice) === 0 && T.YEAR - sd.getFullYear() <= 5) out.push({ t: "Recent $0 transfer", d: "Changed hands without a sale price on " + dateFmt(sd) + ", which is typical of inheritance or family transfers.", cls: "gold" });
    if (u.yesNo(m.familyTransfer) === "Yes") out.push({ t: "Family transfer", d: "The county marks this parcel as part of a family transfer.", cls: "gold" });
    var st = clean(m.mailState) || (clean(m.mailCity).match(/\b([A-Z]{2})\s*$/) || [])[1] || "";
    if (st && st.toUpperCase() !== "VA") out.push({ t: "Owner out of state", d: "Tax bills go to " + st.toUpperCase() + ".", cls: "gray" });
    if (num(m.useValue) > 0 && num(m.total) > 0 && num(m.useValue) < num(m.total) * 0.8) out.push({ t: "Farm or forest tax program", d: "Taxed at land use value (" + money(m.useValue) + "), so it's being farmed or timbered.", cls: "gray" });
    if (owner && !ENTITY_RE.test(owner) && !TRUST_RE.test(owner) && !ESTATE_RE.test(owner) && num(m.acres) >= 10) out.push({ t: "Individual owner", d: "Held by a person rather than a company.", cls: "gray" });
    return out;
  }

  // ---------------------------------------------------------------- report rendering
  function zoningUpside(zCode, zDesc, planText) {
    var lowZoning = /\b(A-?\d*|AR-?\d*|AG|AE|RA|RR|R-?1|R-?C|RE-?\d*|TR-?\d+|JLMA|CR-?1|RC|AC)\b/i.test(zCode || "") || /agric|rural|estate|conservation/i.test(zDesc || "");
    var denserPlan = /suburban|urban|neighborhood|residential|mixed|town center|transition|compact|village|community|activity center|planned/i.test(planText || "")
      && !/rural|agric|conservation|open space|park|resource/i.test(planText || "");
    return lowZoning && denserPlan;
  }
  function addrOf(m) {
    if (clean(m.address) && !/^\d+$/.test(clean(m.address))) return clean(m.address);
    var no = num(m.addrNo) > 0 ? String(num(m.addrNo)) : "";
    var street = [clean(m.addrPre), clean(m.addrStreet), clean(m.addrSuffix), clean(m.addrPost)].filter(Boolean).join(" ").replace(/\s+/g, " ");
    return street ? [no, street].filter(Boolean).join(" ") : "";
  }
  function waterSewerRow(m) {
    var w = clean(m.water), s = clean(m.sewer);
    if (!w && !s) return null;
    var yw = u.yesNo(w), ys = u.yesNo(s), yn = /^(Yes|No)$/;
    if (yn.test(yw) && (!s || yn.test(ys))) return ["Public water / sewer", "Water " + yw.toLowerCase() + (s ? ", sewer " + ys.toLowerCase() : "")];
    return ["Water / sewer", [w, s].filter(Boolean).join(" / ")];
  }
  function merged(r) { return Object.assign({}, r.county || {}, r.join || {}); }
  function section(title, icon) { return h("section", { class: "block" }, h("h3", { class: "sec" }, title)); }

  function renderReport() {
    var el = u.clear(body);
    var r = current;
    if (!r) return;
    if (r.error) { el.append(h("div", { class: "callout bad" }, r.error)); return; }
    if (r.none) { el.append(h("div", { class: "callout plain" }, "No parcel at that spot. Tap inside a parcel outline (zoom in to see them).")); return; }
    if (!r.vgin) { el.append(u.loading("Finding the parcel")); return; }

    var v = r.vgin, loc = r.loc, m = merged(r);
    var address = addrOf(m);
    var title = address || (clean(m.owner) ? clean(m.owner) : "Parcel " + (v.ptm || v.parcelId));
    var acres = num(m.acres);

    // Header
    el.append(h("div", { class: "block report-head" },
      h("div", { class: "eyebrow" }, (v.locality || "Virginia") + (loc ? " · " + loc.region : "")),
      h("h2", { class: "title" }, title),
      h("div", { class: "btn-row" },
        h("button", { type: "button", class: "btn primary small", onclick: function () { T.emit("save-parcel", snapshot()); render(); } }, T.saved && T.saved.has(currentKey()) ? "Saved" : "Save to pipeline"),
        h("button", { type: "button", class: "btn small", onclick: copySummary }, "Copy summary"),
        navigator.share ? h("button", { type: "button", class: "btn small", onclick: shareCurrent }, "Share") : null,
        h("a", { class: "btn small", href: "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=" + r.lat + "," + r.lng, target: "_blank", rel: "noopener" }, "Street View ↗"))
    ));
    if (loc && loc.stale) el.append(h("div", { class: "callout warn" }, loc.stale));

    // Key numbers
    var total = num(m.total); if (total == null && num(m.land) != null && num(m.impr) != null) total = num(m.land) + num(m.impr);
    var land = num(m.land); if (land == null && total != null && num(m.impr) != null && loc && loc.parcel && !loc.parcel.f.land) land = total - num(m.impr);
    var perAcre = land && (acres || v.acresCalc) ? land / (acres || v.acresCalc) : null;
    el.append(h("div", { class: "stats" },
      u.stat(acresFmt(acres != null ? acres : v.acresCalc), acres != null ? "Acres (county)" : "Acres (calculated)"),
      u.stat(money(land), "Land value" + (perAcre && (acres || v.acresCalc) >= 1 ? " · " + money(perAcre) + "/ac" : "")),
      u.stat(money(total), "Total assessed"),
      u.stat(m.salePrice && num(m.salePrice) > 0 ? money(m.salePrice) : (dateFmt(m.saleDate) ? "$0 transfer" : null), dateFmt(m.saleDate) ? "Last sale · " + dateFmt(m.saleDate) : "Last sale")
    ));

    // Signals
    if (r.sections.parcel === "done") {
      var sig = signalsFor(m, r);
      if (sig.length) {
        var sg = h("div", { class: "signals" });
        sig.forEach(function (s) { sg.append(h("span", { class: "pill " + s.cls, title: s.d }, s.t)); });
        el.append(h("div", { class: "block" }, sg));
      }
    }

    // Ownership
    var ownerBlock = section("Ownership and title");
    if (r.sections.parcel === "loading") ownerBlock.append(u.loading("Reading county records"));
    var mail = [clean(m.mail1), clean(m.mail2), clean(m.mail3), [clean(m.mailCity), clean(m.mailState), clean(m.mailZip)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    var deed = (clean(m.deedBook) || clean(m.deedPage)) ? "Book " + (clean(m.deedBook) || "?") + ", page " + (clean(m.deedPage) || "?") : (clean(m.deed) || null);
    var ownerText = [clean(m.owner), clean(m.owner2)].filter(Boolean).join(" & ");
    ownerBlock.append(u.kv([
      ["Owner", ownerText || (loc && loc.parcel ? (r.sections.parcel === "done" ? "Not published in county GIS" : null) : "See county records")],
      ["Mailing address", mail || null],
      ["Parcel ID", v.ptm || v.parcelId, true],
      clean(m.id) && clean(m.id) !== String(v.ptm) ? ["County ID", clean(m.id), true] : null,
      ["Deed", deed, true],
      ["Instrument", clean(m.instrument) || null, true],
      ["Recorded", dateFmt(m.recorded)],
      ["Sold by (grantor)", clean(m.grantor) || null],
      ["Sale type", clean(m.saleType) || null],
      ["Subdivision", /^acreage$/i.test(clean(m.subdivision)) ? null : clean(m.subdivision) || null],
      ["Legal description", clean(m.legal) || null],
      ["Use", clean(m.use) || null],
      ["Year built", num(m.yearBuilt) > 1700 ? String(num(m.yearBuilt)) : null],
      ["Living area", num(m.livingArea) > 0 ? Math.round(num(m.livingArea)).toLocaleString() + " sq ft" : null],
      ["Dwelling units", num(m.units) > 0 ? String(num(m.units)) : null],
      ["Land use value", num(m.useValue) > 0 ? moneyFull(m.useValue) : null],
      ["Taxable assessment", num(m.taxable) > 0 && total != null && Math.abs(num(m.taxable) - total) > 1 ? moneyFull(m.taxable) + " (farm or forest program)" : null],
      ["Improvements value", moneyFull(m.impr)],
      ["Prior year value", moneyFull(m.priorTotal) || (num(m.priorLand) != null ? moneyFull((num(m.priorLand) || 0) + (num(m.priorImpr) || 0)) : null)],
      ["Tax year", clean(m.taxYear) || null],
      ["Tax status", clean(m.exempt) || null],
      ["Family transfer", u.yesNo(m.familyTransfer) === "Yes" ? "Yes, part of a family transfer" : null],
      ["Assessor class", clean(m.useClass) === "VAC" ? "Vacant" : clean(m.useClass) || null],
      ["District", clean(m.district) || null],
      ["Calculated acres", acresFmt(v.acresCalc)]
    ]));
    // JCC sale history
    if (m.sale2Date || m.sale3Date) {
      var hist = [[m.sale2Date, m.sale2Price, m.sale2From], [m.sale3Date, m.sale3Price, m.sale3From]].filter(function (x) { return dateFmt(x[0]); });
      if (hist.length) ownerBlock.append(h("div", { class: "sub" }, "Earlier sales: " + hist.map(function (x) { return dateFmt(x[0]) + (num(x[1]) ? " for " + money(x[1]) : "") + (clean(x[2]) ? " from " + clean(x[2]) : ""); }).join("; ")));
    }
    if (loc && loc.notes) ownerBlock.append(h("div", { class: "sub" }, loc.notes));
    var links = h("div", { class: "btn-row" });
    if (loc && loc.links && loc.links.assessor) links.append(u.extLink(loc.links.assessor(clean(m.id) || v.ptm || v.parcelId), loc.links.assessorLabel || "County assessment record"));
    if (m.link) links.append(u.extLink(m.link, "County property card"));
    if (loc && loc.links && loc.links.landRecords) links.append(u.extLink(loc.links.landRecords, "Land records (title)"));
    if (!loc) links.append(u.extLink(REG.google((v.locality || "Virginia") + " real estate assessment parcel search"), "Find the county assessment site"));
    ownerBlock.append(links);
    el.append(ownerBlock);

    // Zoning and plan
    var zb = section("Zoning and plan");
    var labels = r.labels || {};
    var zRow = r.zoning && r.zoning[0];
    var zCode = clean(m.zoningCode) || (zRow && loc.zoning.code !== "*" ? clean(zRow[loc.zoning.code]) : "") || clean(m.zoningDesc);
    var zName = zRow && loc.zoning.name ? clean(zRow[loc.zoning.name]) : "";
    if (!zName && labels.zoning && zCode) zName = labels.zoning[zCode.toUpperCase()] || "";
    var pRow = r.plan && r.plan[0];
    var planCode = pRow && loc.plan ? clean(pRow[loc.plan.code]) || clean(pRow[loc.plan.alt]) : "";
    var planText = clean(m.compPlan) || gis.withLabel(planCode, labels.plan);
    if (pRow && loc.plan && loc.plan.alt && planText && clean(pRow[loc.plan.alt]) && planText.indexOf(clean(pRow[loc.plan.alt])) < 0) planText += " (" + clean(pRow[loc.plan.alt]) + ")";
    var planExtra = [];
    if (pRow && loc.plan && loc.plan.extra) Object.keys(loc.plan.extra).forEach(function (k) { var vv = clean(pRow[loc.plan.extra[k]]); if (vv) planExtra.push(vv); });
    var polRow = r.policy && r.policy[0];
    var zExtra = [];
    if (zRow && loc.zoning && loc.zoning.extra) Object.keys(loc.zoning.extra).forEach(function (k) { var vv = clean(zRow[loc.zoning.extra[k]]); if (vv) zExtra.push(({ proffer: "Proffers: ", rezoningCase: "Rezoning case: ", ordinance: "Ordinance: ", caseName: "Case: ", conditions: "Conditions: ", secondZone: "Also: ", project: "Project: " }[k] || "") + vv); });
    if (r.zoning && r.zoning.length > 1) zExtra.push("Parcel spans " + r.zoning.length + " zoning districts: " + r.zoning.map(function (x) { return clean(x[loc.zoning.code]); }).filter(Boolean).join(", "));
    zb.append(u.kv([
      ["Zoning", [zCode, zName].filter(Boolean).join(" · ") || (r.sections.zoning === "loading" ? "Loading" : loc && (loc.zoning || (loc.parcel && loc.parcel.f.zoningCode)) ? "Not found at this point" : "Not connected for this locality yet")],
      ["Zoning detail", zExtra.join("; ") || null],
      [loc && loc.plan ? loc.plan.label : "Comprehensive plan", planText ? planText + (planExtra.length ? " (" + planExtra.join(", ") + ")" : "") : (r.sections.plan === "loading" ? "Loading" : null)],
      [loc && loc.policy ? loc.policy.label : "Policy area", polRow ? [clean(polRow[loc.policy.code]), clean(polRow[loc.policy.sub])].filter(Boolean).join(" · ") : null],
      waterSewerRow(m),
      ["Flood zone", clean(m.flood) || (num(m.floodAcres) > 0 ? acresFmt(m.floodAcres) + " in floodplain" : null)],
      ["Resource protection area", clean(m.rpa) || (num(m.rpaAcres) > 0 ? acresFmt(m.rpaAcres) + " in RPA" : null)],
      ["Wetlands", clean(m.wetland) || null],
      ["Easements", num(m.easementAcres) > 0 ? acresFmt(m.easementAcres) : null],
      ["Noise / AICUZ", [clean(m.noise), clean(m.aicuz)].filter(Boolean).join(" / ") || null]
    ].concat(r.areas ? r.areas.filter(Boolean) : [])));
    if (loc && loc.areas && r.sections.areas === "loading") zb.append(u.loading("Checking service areas and county estimates"));
    if (zoningUpside(zCode, zName, planText)) zb.append(h("div", { class: "callout gold" }, h("strong", null, "Possible rezoning upside. "), "Current zoning reads low-density while the plan reads " + planText + ". Read the plan text and check nearby approvals below."));
    var zlinks = h("div", { class: "btn-row" });
    if (pRow && loc.plan && loc.plan.link && clean(pRow[loc.plan.link])) zlinks.append(u.extLink(clean(pRow[loc.plan.link]), "Plan text for this area"));
    if (zRow && loc.zoning && loc.zoning.link && clean(zRow[loc.zoning.link])) zlinks.append(u.extLink(clean(zRow[loc.zoning.link]), "Zoning ordinance"));
    if (loc && loc.links && loc.links.planning) zlinks.append(u.extLink(loc.links.planning, "Planning department"));
    zlinks.append(h("button", { type: "button", class: "btn", onclick: function () { T.map.toggle("flood", true); T.map.toggle("wetlands", true); u.toast("Flood zones and wetlands are on. Open Layers to change them."); } }, "Show flood and wetlands"));
    zb.append(zlinks);
    el.append(zb);

    // Development potential: net developable acres and rough unit counts
    var dp = section("Development potential");
    var gross = acres || v.acresCalc;
    if (r.sections.net === "loading" || !r.sections.net) dp.append(u.loading("Measuring floodplain, wetlands and RPA on this parcel"));
    else if (!r.net) dp.append(h("div", { class: "empty" }, "Couldn't measure constraints for this parcel."));
    else {
      var netAc = gross * (1 - r.net.anyFrac);
      dp.append(h("div", { class: "stats" }, u.stat(acresFmt(gross), "Gross acres"), u.stat(acresFmt(gross * r.net.anyFrac), "Constrained"), u.stat(acresFmt(netAc), "Net developable")));
      dp.append(u.kv(r.net.parts.map(function (p) { return [p.label, p.frac == null ? "Couldn't load" : p.frac > 0 ? acresFmt(gross * p.frac) + " (" + Math.round(p.frac * 100) + "%)" : "None"]; })
        .concat([
          ["Homes at current zoning", unitsText(zoningDensity(zCode, zName, loc), netAc)],
          ["Homes at plan density", unitsText(planDensity(planText + " " + planExtra.join(" ")), netAc)]
        ])));
      dp.append(h("div", { class: "sub" }, "Overlaps count once. Measured by sampling the parcel against FEMA flood zones, USFWS wetlands" + (r.net.noRpa ? "" : " and the county RPA map") + "." +
        (r.net.noRpa ? " This county's RPA isn't connected, so RPA isn't subtracted." : "") +
        " Home counts are rough ranges from the district and plan names applied to net acres; confirm in the ordinance and plan text."));
    }
    el.append(dp);

    // Cases
    if (loc && loc.cases) {
      var cb = section("Rezoning and land use cases nearby");
      if (r.sections.cases !== "done") cb.append(u.loading("Checking county case files"));
      else if (!r.cases.length) cb.append(h("div", { class: "empty" }, "No cases within about three quarters of a mile."));
      else {
        var shown = r.showAllCases ? r.cases : r.cases.filter(relevantCase);
        var hiddenCount = r.cases.length - shown.length;
        var list = h("div", { class: "list" });
        shown.slice(0, 14).forEach(function (cs) { list.append(caseItem(cs)); });
        if (!shown.length) cb.append(h("div", { class: "empty" }, "No residential rezonings, plans or subdivisions nearby in the last 10 years."));
        cb.append(list);
        if (shown.length > 14) cb.append(h("div", { class: "sub" }, (shown.length - 14) + " more within the search area. Turn on the Cases layer to see them on the map."));
        if (hiddenCount > 0 || r.showAllCases) cb.append(h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: function () { r.showAllCases = !r.showAllCases; render(); } },
          r.showAllCases ? "Show residential cases from the last 10 years only" : "Show all " + r.cases.length + " cases (" + hiddenCount + " older or non-residential)")));
      }
      el.append(cb);
    }

    // Nearby values
    if (loc && loc.nearby) {
      var nb = section("Home values and land sales around it");
      var n = r.nearby;
      if (r.sections.nearby === "loading" || (!n && r.sections.parcel !== "none")) nb.append(u.loading("Reading assessments around this parcel"));
      else if (r.sections.nearby === "error") nb.append(h("div", { class: "callout plain" }, "Couldn't read nearby assessments just now."));
      else if (n && !n.unavailable) {
        nb.append(h("div", { class: "stats" },
          u.stat(money(n.medianValue), "Median home assessment (" + (n.count || 0) + " homes)"),
          u.stat(money(n.medianNewer), "Homes built since " + (T.YEAR - 10) + " (" + (n.newerCount || 0) + ")"),
          u.stat(money(n.medianSale), "Median sale, last 2 yrs (" + (n.salesCount || 0) + ")"),
          u.stat(n.medianPpsf ? "$" + Math.round(n.medianPpsf) : null, "Sale $ per finished sq ft")
        ));
        nb.append(h("div", { class: "sub" }, "Homes with improvements over $50,000 within " + (n.radius || "half a mile") + ", from the county's assessment data."));
        var ls = r.landSales;
        if (ls && ls.rows) {
          nb.append(h("div", { class: "eyebrow" }, "Vacant land sales within 2 miles, last 5 years"));
          if (!ls.rows.length) nb.append(h("div", { class: "empty" }, "No vacant sales of an acre or more found."));
          else {
            nb.append(h("div", { class: "stats" }, u.stat(money(ls.medianPerAcre), "Median price per acre"), u.stat(String(ls.count), "Sales found")));
            var ll = h("div", { class: "list" });
            ls.rows.forEach(function (s) {
              ll.append(h("button", { type: "button", class: "item", onclick: function () { if (s.center) { M.map.setView([s.center[1], s.center[0]], 17); selectParcel(s.center[0], s.center[1], { fit: true }); } } },
                h("div", { class: "t" }, money(s.salePrice) + " · " + acresFmt(s.acres), h("span", { class: "pill gray" }, money(s.perAcre) + "/ac")),
                h("div", { class: "d" }, [dateFmt(s.saleDate), clean(s.zoningCode), clean(s.address), clean(s.owner) ? "now " + clean(s.owner) : ""].filter(Boolean).join(" · "))));
            });
            nb.append(ll);
          }
        }
      }
      el.append(nb);
    } else if (loc) {
      el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Home values around it"),
        h("div", { class: "callout plain" }, loc.parcel
          ? (loc.name || "This county") + " doesn't publish assessed values in its GIS, so nearby values come from the county assessment site."
          : "Owner and value records for " + (loc.name || "this locality") + " haven't been connected in Tract yet. The assessment site has them."),
        loc.links && loc.links.assessor ? h("div", { class: "btn-row" }, u.extLink(loc.links.assessor(clean(m.id) || v.ptm), "Open the assessment record (neighborhood sales)")) : null));
    } else {
      el.append(h("div", { class: "callout plain" }, (v.locality || "This locality") + " shows the parcel outline and acreage from the state parcel layer. Owner, value and zoning connections for it haven't been added yet."));
    }

    // Field links
    el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Look closer"),
      h("div", { class: "btn-row" },
        u.extLink("https://www.google.com/maps/search/?api=1&query=" + r.lat + "," + r.lng, "Google Maps"),
        loc && loc.links && loc.links.gis ? u.extLink(loc.links.gis, "County GIS") : null),
      h("div", { class: "sub mono" }, r.lat.toFixed(6) + ", " + r.lng.toFixed(6) + (v.updated ? " · state layer updated " + (dateFmt(v.updated) || "") : ""))
    ));
  }

  // Default view of nearby cases: residential rezonings, plans and subdivisions from the last 10 years.
  // Cases without a date are kept when their type reads residential (some counties don't publish dates).
  var RES_RE = /rezon|\bREZ\b|ZMA|reclass|subdiv|\bSUB|\bplat\b|site plan|\bPOD\b|preliminary|residential|dwelling|\bunits\b|\bhomes\b|townho|single.family|\blots\b|\bPUD\b|\bPRD\b|\bPMR\b|planned|proffer|comp(rehensive)? plan|\bCPA\b|land use|construction plan|\bCPAP\b|\bR-?\d/i;
  var NOT_RE = /variance|\bVAR\b|\bBZA\b|\bSPMI\b|\bsign\b|telecom|tower|antenna|historic|wetlands board|\bCBPA\b|home occupation|child care|kennel|church|school|daycare|day care|restaurant|retail|office|industrial|data center/i;
  var HOUSING_RE = /residential|dwelling|\bunits\b|\bhomes\b|townho|single.family|\blots\b|subdiv/i;
  function relevantCase(cs) {
    var m = cs.m;
    var d = toDate(m.date) || toDate(m.approved);
    if (d && d < new Date(T.YEAR - 10, T.NOW.getMonth(), T.NOW.getDate())) return false;
    var typeText = [clean(m.type), clean(m.devType), cs.cfg.label].join(" ");
    var all = [typeText, clean(m.name), clean(m.alt), clean(m.desc), clean(m.toZone)].join(" ");
    if (NOT_RE.test(all) && !HOUSING_RE.test(all)) return false;
    return RES_RE.test(all);
  }

  function caseItem(cs) {
    var m = cs.m, a = cs.a, f = cs.cfg.f || {};
    var number = clean(m.number), name = clean(m.name) || clean(m.alt);
    var units = [];
    if (num(m.units) > 0) units.push(num(m.units) + " units");
    ["sfd", "th", "condo", "apt"].forEach(function (k) { if (num(m[k]) > 0) units.push(num(m[k]) + " " + { sfd: "single-family", th: "townhouse", condo: "condo", apt: "apartment" }[k]); });
    var meta = [clean(m.type), clean(m.devType), clean(m.status), dateFmt(m.date), dateFmt(m.approved) ? "approved " + dateFmt(m.approved) : "", clean(m.fromZone) || clean(m.toZone) ? (clean(m.fromZone) ? clean(m.fromZone) + " → " : "to ") + clean(m.toZone) : "", num(m.acres) > 0 ? acresFmt(m.acres) : "", units.join(", "), num(m.cashProffer) > 0 ? "cash proffer " + moneyFull(m.cashProffer) : "", clean(m.proffer) && clean(m.proffer) !== "N" ? "proffered" : "", clean(m.ordinance) ? "ordinance " + clean(m.ordinance) : ""].filter(Boolean);
    var people = [clean(m.developer) ? "Developer: " + clean(m.developer) : "", clean(m.applicant) && clean(m.applicant) !== name ? "Applicant: " + clean(m.applicant) : "", clean(m.caseOwner) ? "Owner: " + clean(m.caseOwner) : "", clean(m.rep) ? "Represented by " + clean(m.rep) : ""].filter(Boolean);
    var desc = clean(m.desc);
    if (!number && !name && f.any) { var ks = Object.keys(a).filter(function (k) { return !/objectid|shape|globalid|created|edited/i.test(k) && clean(a[k]); }).slice(0, 4); name = ks.map(function (k) { return clean(a[k]); }).join(" · "); }
    var link = clean(m.link);
    var firm = T.firmForText && T.firmForText([name, m.applicant, m.developer, m.caseOwner, m.rep, desc].join(" "));
    return h("div", { class: "item static" },
      h("div", { class: "t" }, number || "Case", name ? h("span", null, name) : null, cs.onParcel ? h("span", { class: "pill gold" }, "On this parcel") : null, firm ? h("span", { class: "pill blue" }, firm.short || firm.name) : null),
      people.length ? h("div", { class: "d" }, people.join(" · ")) : null,
      meta.length ? h("div", { class: "m" }, meta.join(" · ")) : null,
      desc ? h("div", { class: "d" }, desc.length > 260 ? desc.slice(0, 257) + "…" : desc) : null,
      h("div", { class: "d" }, cs.cfg.label + (cs.wide ? " · covers a large area (countywide or district-wide)" : cs.dist != null && !cs.onParcel ? " · " + geo.milesFmt(cs.dist) : "")),
      link && /^https?:/i.test(link) ? h("div", null, h("a", { href: link, target: "_blank", rel: "noopener" }, "Open case file ↗")) : null
    );
  }

  // ---------------------------------------------------------------- save / share
  function currentKey() { return current && current.vgin ? current.vgin.fips + ":" + (current.vgin.ptm || current.vgin.parcelId) : null; }
  function snapshot() {
    var r = current; if (!r || !r.vgin) return null;
    var m = merged(r);
    return { key: currentKey(), fips: r.vgin.fips, locality: r.vgin.locality, pin: r.vgin.ptm || r.vgin.parcelId, lat: r.lat, lng: r.lng,
      label: addrOf(m) || "Parcel " + (r.vgin.ptm || r.vgin.parcelId), owner: clean(m.owner), acres: num(m.acres) != null ? num(m.acres) : r.vgin.acresCalc,
      total: num(m.total) != null ? num(m.total) : (num(m.land) != null && num(m.impr) != null ? num(m.land) + num(m.impr) : null) };
  }
  function summaryText() {
    var r = current; if (!r || !r.vgin) return "";
    var m = merged(r);
    var lines = [
      (addrOf(m) || "Parcel " + (r.vgin.ptm || r.vgin.parcelId)) + ", " + r.vgin.locality,
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
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { u.toast("Copied"); }, function () { u.toast("Copy isn't allowed here."); });
  }
  function shareCurrent() { navigator.share({ title: "Parcel", text: summaryText() }).catch(function () {}); }

  // Taps on the map identify parcels
  T.on("mapclick", function (ll) { selectParcel(ll.lng, ll.lat, { fit: false }); });

  T.parcel = {
    select: selectParcel,
    close: closeParcel,
    current: function () { return current; },
    signalsFor: signalsFor,
    caseItem: caseItem,
    ESTATE_RE: ESTATE_RE,
    TRUST_RE: TRUST_RE,
    ENTITY_RE: ENTITY_RE,
    addrOf: addrOf
  };
})();
