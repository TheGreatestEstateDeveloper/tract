/*
 * Tract sites: find land in the map view, scored by what matters to a land buyer.
 * Signals come from what each county publishes: owner name patterns (estate, heirs, trust, individual),
 * sale history (long-held, $0 transfers), farm tax program, out-of-state mailing address, builder ownership,
 * vacant land, water and sewer, and whether the comp plan allows more than current zoning.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, gis = T.gis, geo = T.geo, REG = T.REG, h = u.h;
  var M = T.map;
  var clean = u.clean, num = u.num;

  var DEFAULTS = { minAc: 10, maxAc: "", vacant: true, estate: false, trust: false, individual: false, outOfState: false, longHeld: 0, transfer: false,
    farm: false, upside: false, utilities: false, noBuilders: true, maxPerAcre: "", nearCases: false, zoning: "", assemble: false };
  var f = Object.assign({}, DEFAULTS, u.store("siteFilters") || {});
  var PRESETS = [
    { key: "inherited", label: "Inherited farmland with upside", d: "Estate, heirs, trust or a recent $0 family transfer, in a farm tax program or farm zoning, where the plan allows more.",
      set: { minAc: 10, vacant: false, estate: true, transfer: true, trust: true, farm: false, upside: true, noBuilders: true, individual: false, outOfState: false, longHeld: 0 } },
    { key: "upside", label: "Plan says grow, zoning says farm", d: "Rural or low-density zoning where the comprehensive plan calls for more.",
      set: { minAc: 10, vacant: false, upside: true, noBuilders: true, estate: false, trust: false, transfer: false, individual: false, outOfState: false, longHeld: 0 } },
    { key: "longheld", label: "Long-held family land", d: "Individuals or family trusts who have owned 25 years or more.",
      set: { minAc: 20, vacant: false, individual: true, trust: true, longHeld: 25, noBuilders: true, estate: false, transfer: false, upside: false, outOfState: false } },
    { key: "absentee", label: "Absentee owners", d: "Tax bills go out of state.",
      set: { minAc: 5, vacant: true, outOfState: true, noBuilders: true, estate: false, trust: false, transfer: false, individual: false, upside: false, longHeld: 0 } }
  ];
  var el = null, active = false, results = null, busy = false, ownerMode = null;
  var layer = L.layerGroup();

  function save() { u.store("siteFilters", f); }

  // ---------------------------------------------------------------- signals per parcel
  function flags(m, loc) {
    var owner = [clean(m.owner), clean(m.owner2)].join(" ").trim();
    var P = T.parcel;
    var sd = u.toDate(m.saleDate), yrs = sd && sd.getFullYear() > 1900 ? T.YEAR - sd.getFullYear() : null;
    var st = clean(m.mailState) || (clean(m.mailCity).match(/\b([A-Z]{2})\s*$/) || [])[1] || "";
    var firm = owner ? T.firmForText(owner) : null;
    return {
      estate: P.ESTATE_RE.test(owner),
      trust: P.TRUST_RE.test(owner),
      individual: !!owner && !P.ENTITY_RE.test(owner) && !P.TRUST_RE.test(owner) && !P.ESTATE_RE.test(owner),
      outOfState: !!st && st.toUpperCase() !== "VA",
      years: yrs,
      transfer: (sd && num(m.salePrice) === 0 && yrs != null && yrs <= 5) || u.yesNo(m.familyTransfer) === "Yes",
      farm: num(m.useValue) > 0 && num(m.total) > 0 && num(m.useValue) < num(m.total) * 0.8,
      builder: firm,
      vacant: num(m.impr) === 0 || clean(m.useClass) === "VAC",
      utilities: /^(Y|YES|T|TRUE)$/i.test(clean(m.water)) || /^(Y|YES|T|TRUE)$/i.test(clean(m.sewer)) || /water|sewer/i.test(clean(m.water))
    };
  }

  function zoningUpside(zCode, planText) {
    var lowZoning = /\b(A-?\d*|AR-?\d*|AG|AE|RA|RR|R-?1|R-?C|RE-?\d*|TR-?\d+|JLMA|CR-?1|RC|AC|A)\b/i.test(zCode || "");
    var denserPlan = /suburban|urban|neighborhood|residential|mixed|town center|transition|compact|village|community|activity center|planned|growth/i.test(planText || "")
      && !/rural|agric|conservation|open space|park|resource|preserv/i.test(planText || "");
    return lowZoning && denserPlan;
  }

  // ---------------------------------------------------------------- search
  async function polysIn(cfg, env, codeFields) {
    try {
      var j = await gis.inEnvelope(gis.layerUrl(cfg), env, { outFields: codeFields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0004, resultRecordCount: 2000 }, { timeout: 30000 });
      return (j.features || []).filter(function (x) { return x.geometry && x.geometry.rings; });
    } catch (e) { return []; }
  }
  function attrAt(polys, pt, fields) {
    for (var i = 0; i < polys.length; i++) if (geo.pointInRings(pt, polys[i].geometry.rings)) {
      return fields.map(function (k) { return clean(polys[i].attributes[k]); }).filter(Boolean).join(" ");
    }
    return "";
  }

  async function run() {
    if (busy) return;
    ownerMode = null;
    if (M.map.getZoom() < 12) { results = { msg: "Zoom in to a few miles across first (the search covers what's on screen)." }; render(); return; }
    busy = true; results = null; render();
    var b = M.map.getBounds(), c = M.map.getCenter();
    var env = { xmin: b.getWest(), ymin: b.getSouth(), xmax: b.getEast(), ymax: b.getNorth(), spatialReference: { wkid: 4326 } };
    var fips = M.activeFips() || (M.localityAt(c.lng, c.lat) || {}).fips;
    var loc = fips && REG.byFips[fips];
    var out = { rows: [], loc: loc, notes: [] };
    try {
      if (loc && loc.parcel && loc.parcel.f.acres) {
        var pf = loc.parcel.f, pl = loc.parcel;
        // Assemblages: smaller parcels count too, since several together can make the site
        var floor = f.assemble ? Math.min(1, num(f.minAc) || 1) : (num(f.minAc) || 1);
        var where = gis.nf(pl, pf.acres) + " >= " + floor;
        if (num(f.maxAc) && !f.assemble) where += " AND " + gis.nf(pl, pf.acres) + " <= " + num(f.maxAc);
        if (f.vacant && pf.impr) where += " AND (" + gis.nf(pl, pf.impr) + " = 0 OR " + pf.impr + " IS NULL)";
        var want = ["owner", "owner2", "acres", "areaSqft", "address", "addrNo", "addrPre", "addrStreet", "addrSuffix", "id", "total", "land", "impr", "useValue", "zoningCode", "compPlan",
          "saleDate", "salePrice", "mailState", "mailCity", "familyTransfer", "water", "sewer", "useClass"].map(function (k) { return pf[k]; }).filter(Boolean);
        var jobs = [gis.inEnvelope(pl.url, env, { where: where, outFields: want.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0003, resultRecordCount: 1000 }, { timeout: 30000 })];
        var needPlan = f.upside || true; // always fetch so each result can show its plan designation
        jobs.push(needPlan && loc.plan && !pf.compPlan ? polysIn(loc.plan, env, [loc.plan.code, loc.plan.alt].filter(Boolean)) : Promise.resolve([]));
        jobs.push(loc.zoning && !pf.zoningCode && loc.zoning.code !== "*" ? polysIn(loc.zoning, env, [loc.zoning.code]) : Promise.resolve([]));
        jobs.push(f.nearCases && loc.cases ? casesNear(loc, env) : Promise.resolve([]));
        var res = await Promise.all(jobs);
        var planPolys = res[1], zonePolys = res[2], cases = res[3];
        var labels = loc.plan ? await gis.layerLabels(loc.plan) : {};
        (res[0].features || []).forEach(function (x) {
          var m = gis.mapAttrs(x.attributes, pf);
          m.center = geo.ringsCentroid(x.geometry && x.geometry.rings);
          if (!m.center) return;
          var a = num(m.acres);
          if (a == null || a < floor) return;
          var fl = flags(m, loc);
          var planCode = clean(m.compPlan) || attrAt(planPolys, m.center, [loc.plan && loc.plan.code].filter(Boolean)) || attrAt(planPolys, m.center, [loc.plan && loc.plan.alt].filter(Boolean));
          m.planText = clean(m.compPlan) || gis.withLabel(planCode, labels);
          m.zone = clean(m.zoningCode) || attrAt(zonePolys, m.center, [loc.zoning && loc.zoning.code].filter(Boolean));
          fl.upside = zoningUpside(m.zone, m.planText);
          if (cases.length) {
            var near = cases.filter(function (cs) { return geo.distMeters(m.center, cs.center) < 1609 * 1.5; });
            fl.nearCases = near.length;
          }
          m.flags = fl;
          out.rows.push(m);
        });
        if (res[0].exceededTransferLimit || (res[0].features || []).length >= 1000) out.notes.push("The county returned its maximum of 1,000 parcels for this view. Zoom in to see everything.");
        if (!pf.owner) out.notes.push(loc.name + " doesn't publish owner names, so owner filters can't apply here.");
        if (!pf.saleDate) out.notes.push(loc.name + " doesn't publish sale dates, so long-held and transfer filters can't apply here.");
        if (!pf.useValue) out.notes.push(loc.name + " doesn't publish land use (farm tax) values, so the farm program filter can't apply here.");
        if (!loc.plan && !pf.compPlan) out.notes.push(loc.name + " doesn't publish a future land use layer, so the upside filter can't apply here.");
      } else {
        // State outlines only: filter by drawn area. Web Mercator area overstates true area by about 1/cos²(lat).
        var k = Math.pow(Math.cos(geo.rad(c.lat)), 2);
        var minMerc = Math.round((num(f.minAc) || 1) * 4046.86 / k * 0.9);
        var j2 = await gis.inEnvelope(REG.VGIN.feature, env, { where: "Shape__Area >= " + minMerc, outFields: "FIPS,LOCALITY,PTM_ID", returnGeometry: true, outSR: 4326, f: "geojson", resultRecordCount: 400 });
        (j2.features || []).forEach(function (ft) {
          var a = geo.geomAcres(ft.geometry), bb = L.geoJSON(ft.geometry).getBounds().getCenter();
          if (a >= (num(f.minAc) || 1) && (!num(f.maxAc) || a <= num(f.maxAc))) out.rows.push({ id: ft.properties.PTM_ID, acres: a, county: ft.properties.LOCALITY, center: [bb.lng, bb.lat], flags: {} });
        });
        out.notes.push((loc ? loc.name : "This locality") + " only has state parcel outlines in Tract, so this list is filtered by size only.");
      }
    } catch (e) {
      results = { msg: "The parcel search didn't finish. Zoom in a little and try again." }; busy = false; render(); return;
    }
    // Filter and score
    out.rows = out.rows.filter(pass).map(function (m) { m.score = score(m); return m; });
    if (f.assemble) out.rows = assemble(out.rows);
    out.rows.sort(function (a, b) { return b.score - a.score || (num(b.acres) || 0) - (num(a.acres) || 0); });
    results = out;
    busy = false;
    render();
  }

  async function casesNear(loc, env) {
    var since = new Date(T.NOW); since.setFullYear(since.getFullYear() - 3);
    var pad = 0.03, big = { xmin: env.xmin - pad, ymin: env.ymin - pad, xmax: env.xmax + pad, ymax: env.ymax + pad, spatialReference: env.spatialReference };
    var out = [];
    await Promise.all(loc.cases.map(async function (cfg) {
      try {
        var j = await gis.inEnvelope(gis.layerUrl(cfg), big, { returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.001, resultRecordCount: 500 });
        (j.features || []).forEach(function (x) {
          var m = gis.mapAttrs(x.attributes, cfg.f);
          var d = u.toDate(m.date);
          if (cfg.f.date && (!d || d < since)) return;
          var c = geo.geomCenter(x.geometry);
          if (c) out.push({ center: c });
        });
      } catch (e) { /* skip */ }
    }));
    return out;
  }

  // A parcel passes when it matches the hard filters. Owner signals combine with OR (any of the checked ones).
  function pass(m) {
    var fl = m.flags || {};
    if (f.noBuilders && fl.builder) return false;
    if (f.upside && !fl.upside) return false;
    if (f.farm && !fl.farm) return false;
    if (f.utilities && !fl.utilities) return false;
    if (f.nearCases && !fl.nearCases) return false;
    if (num(f.maxPerAcre) && num(m.land) && num(m.acres) && num(m.land) / num(m.acres) > num(f.maxPerAcre)) return false;
    if (f.zoning && (m.zone || "").toUpperCase().indexOf(String(f.zoning).toUpperCase()) < 0) return false;
    if (f.longHeld && !(fl.years >= f.longHeld)) return false;
    var anyOwner = f.estate || f.trust || f.individual || f.outOfState || f.transfer;
    if (anyOwner) {
      var hit = (f.estate && fl.estate) || (f.trust && fl.trust) || (f.individual && fl.individual) || (f.outOfState && fl.outOfState) || (f.transfer && fl.transfer);
      if (!hit) return false;
    }
    return true;
  }
  // Group parcels by owner (same name after removing punctuation) and keep owners whose parcels add up
  // to the minimum. Combined acres, every parcel's location, and the strongest signals carry over.
  function ownerKey(m) { return u.norm([clean(m.owner), clean(m.owner2)].join(" ")).replace(/\b(the|and|of)\b/g, "").replace(/\s+/g, " ").trim(); }
  function assemble(rows) {
    var groups = {};
    rows.forEach(function (m) {
      var k = ownerKey(m);
      if (!k) return;
      (groups[k] = groups[k] || []).push(m);
    });
    var out = [];
    Object.keys(groups).forEach(function (k) {
      var ps = groups[k];
      var total = ps.reduce(function (s, x) { return s + (num(x.acres) || 0); }, 0);
      if (total < (num(f.minAc) || 1) || (num(f.maxAc) && total > num(f.maxAc))) return;
      if (ps.length < 2 && total < (num(f.minAc) || 1)) return;
      var best = ps.slice().sort(function (a, b) { return b.score - a.score; })[0];
      var land = ps.reduce(function (s, x) { return s + (num(x.land) || 0); }, 0);
      out.push(Object.assign({}, best, {
        group: ps, acres: total, land: land || null, address: ps.length > 1 ? ps.length + " parcels" : T.parcel.addrOf(best),
        score: best.score + (ps.length > 1 ? Math.min(10, ps.length * 2) : 0)
      }));
    });
    return out;
  }

  function score(m) {
    var fl = m.flags || {}, s = 0;
    if (fl.estate) s += 30;
    if (fl.transfer) s += 25;
    if (fl.upside) s += 25;
    if (fl.trust) s += 10;
    if (fl.individual) s += 8;
    if (fl.years >= 25) s += 10; else if (fl.years >= 15) s += 5;
    if (fl.outOfState) s += 8;
    if (fl.farm) s += 6;
    if (fl.utilities) s += 6;
    if (fl.nearCases) s += Math.min(10, fl.nearCases * 3);
    if (fl.vacant) s += 4;
    s += Math.min(10, (num(m.acres) || 0) / 10);
    return Math.round(s);
  }
  function whyChips(m) {
    var fl = m.flags || {}, out = [];
    if (fl.estate) out.push(["Estate or heirs", "gold"]);
    if (fl.transfer) out.push(["$0 deed in last 5 yrs (inheritance, gift or trust)", "gold"]);
    if (fl.upside) out.push(["Plan allows more", "gold"]);
    if (fl.trust) out.push(["Trust", "gray"]);
    if (fl.individual) out.push(["Individual owner", "gray"]);
    if (fl.years >= 15) out.push(["Owned " + fl.years + " yrs", "gray"]);
    if (fl.outOfState) out.push(["Out-of-state owner", "gray"]);
    if (fl.farm) out.push(["Farm tax program", "gray"]);
    if (fl.utilities) out.push(["Public utilities", "gray"]);
    if (fl.nearCases) out.push([fl.nearCases + " cases nearby", "blue"]);
    if (fl.builder) out.push([fl.builder.short + " owns it", "blue"]);
    return out;
  }

  // ---------------------------------------------------------------- owner search (from the search bar)
  async function ownerSearch(patterns, heading) {
    ownerMode = { heading: heading, rows: null };
    results = null;
    render();
    var out = [];
    var targets = REG.order.filter(function (fp) { var l = REG.byFips[fp]; return l && l.ownerSearch && l.parcel && l.parcel.f.owner; });
    await Promise.all(targets.map(async function (fips) {
      var loc = REG.byFips[fips], pf = loc.parcel.f;
      var where = patterns.map(function (p) { return "UPPER(" + pf.owner + ") LIKE '%" + u.sq(p.toUpperCase()) + "%'"; }).join(" OR ");
      var fields = ["owner", "acres", "areaSqft", "address", "addrNo", "addrStreet", "addrSuffix", "id", "total", "zoningCode"].map(function (k) { return pf[k]; }).filter(Boolean);
      try {
        var j = await gis.ags(loc.parcel.url, { where: where, outFields: fields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0005, resultRecordCount: 300 }, { timeout: 30000 });
        (j.features || []).forEach(function (x) { var m = gis.mapAttrs(x.attributes, pf); m.county = loc.name; m.center = geo.ringsCentroid(x.geometry && x.geometry.rings); out.push(m); });
      } catch (e) { /* county offline: skip */ }
    }));
    ownerMode.rows = out.sort(function (a, b) { return (num(b.acres) || 0) - (num(a.acres) || 0); });
    ownerMode.searched = targets.map(function (fp) { return REG.byFips[fp].name; });
    render();
  }

  // ---------------------------------------------------------------- rendering
  function check(key, label, sub) {
    var cb = h("input", { type: "checkbox", id: "sf-" + key, checked: !!f[key] });
    cb.addEventListener("change", function () { f[key] = cb.checked; save(); });
    return h("label", { class: "check-row", for: "sf-" + key }, cb, h("span", { class: "check" }), h("span", null, label, sub ? h("small", null, sub) : null));
  }
  function numField(key, label, attrs) {
    var i = h("input", Object.assign({ id: "sf-" + key, type: "number", inputmode: "numeric", value: f[key] === "" || f[key] == null ? "" : String(f[key]) }, attrs || {}));
    i.addEventListener("change", function () { f[key] = i.value === "" ? "" : +i.value; save(); });
    return h("div", { class: "field" }, h("label", { for: "sf-" + key }, label), i);
  }

  function render() {
    if (!el) return;
    u.clear(el);
    layer.clearLayers();
    if (ownerMode) return renderOwner();
    el.append(h("div", { class: "view-head" }, h("div", { class: "eyebrow" }, "Find land"), h("h2", { class: "title" }, "Sites"),
      h("p", { class: "sub" }, "Move the map to the area you're screening, pick what matters, then search this view.")));

    var pre = h("div", { class: "presets" });
    PRESETS.forEach(function (p) {
      pre.append(h("button", { type: "button", class: "preset", onclick: function () { Object.assign(f, p.set); save(); render(); run(); } }, h("strong", null, p.label), h("span", null, p.d)));
    });
    el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Quick searches"), pre));

    var hold = h("select", { id: "sf-longHeld" }, [[0, "Any"], [10, "10+ years"], [20, "20+ years"], [25, "25+ years"], [40, "40+ years"]].map(function (o) { return h("option", { value: o[0], selected: +f.longHeld === o[0] }, o[1]); }));
    hold.addEventListener("change", function () { f.longHeld = +hold.value; save(); });
    var zone = h("input", { id: "sf-zoning", type: "text", value: f.zoning || "", placeholder: "A-1" });
    zone.addEventListener("change", function () { f.zoning = zone.value.trim(); save(); });
    el.append(h("details", { class: "block filters-box", open: !results },
      h("summary", null, "Filters"),
      h("div", { class: "form-row" }, numField("minAc", "Min acres", { min: "0", step: "1" }), numField("maxAc", "Max acres", { min: "0", step: "1", placeholder: "Any" }), numField("maxPerAcre", "Max land $/acre", { min: "0", step: "1000", placeholder: "Any" })),
      h("div", { class: "filter-group" }, h("div", { class: "eyebrow" }, "Owner (any checked)"),
        check("estate", "Estate or heirs", "Owner name reads as an estate, heirs or life estate"),
        check("transfer", "Recent $0 or family transfer", "Changed hands without a price in the last 5 years"),
        check("trust", "Held in a trust"),
        check("individual", "Individual owner", "Not a company"),
        check("outOfState", "Owner out of state")),
      h("div", { class: "form-row" }, h("div", { class: "field" }, h("label", { for: "sf-longHeld" }, "Owned at least"), hold), h("div", { class: "field" }, h("label", { for: "sf-zoning" }, "Zoning contains"), zone)),
      h("div", { class: "filter-group" }, h("div", { class: "eyebrow" }, "Land"),
        check("vacant", "Vacant land only", "No building value"),
        check("upside", "Plan allows more than zoning", "Comp plan calls for denser use than today's zoning"),
        check("farm", "In a farm or forest tax program"),
        check("utilities", "Public water or sewer", "Where the county publishes it"),
        check("nearCases", "Rezonings within 1.5 miles (last 3 years)"),
        check("noBuilders", "Hide land builders already own"),
        check("assemble", "Combine parcels with the same owner", "Assemblages: smaller parcels count toward the minimum when one owner holds several"))));
    el.append(h("div", { class: "btn-row sticky-actions" },
      h("button", { type: "button", class: "btn primary", onclick: run }, u.icon("search"), busy ? "Searching" : "Search this view"),
      h("button", { type: "button", class: "btn", onclick: function () { f = Object.assign({}, DEFAULTS); save(); results = null; render(); } }, "Reset")));

    var box = h("div", { class: "block" });
    el.append(box);
    if (busy) { box.append(u.loading("Reading parcels and plan maps in view")); return; }
    if (!results) return;
    if (results.msg) { box.append(h("div", { class: "callout plain" }, results.msg)); return; }
    var rows = results.rows;
    var totalAc = rows.reduce(function (s, x) { return s + (num(x.acres) || 0); }, 0);
    box.append(h("div", { class: "stats" }, u.stat(String(rows.length), "Matching parcels"), u.stat(u.acresFmt(totalAc), "Combined acres")));
    results.notes.forEach(function (n) { box.append(h("div", { class: "sub" }, n)); });
    var l = h("div", { class: "list" });
    var brass = M.cssVar("--brass");
    rows.slice(0, 150).forEach(function (x, i) {
      var addr = T.parcel.addrOf(x);
      var multi = x.group && x.group.length > 1;
      l.append(h("button", { type: "button", class: "item", onclick: function () { go(x); } },
        h("div", { class: "t" }, clean(x.owner) || addr || clean(x.id) || "Parcel", num(x.acres) ? h("span", { class: "pill gray" }, u.acresFmt(x.acres) + (multi ? " combined" : "")) : null,
          multi ? h("span", { class: "pill brass" }, x.group.length + " parcels") : null, x.score ? h("span", { class: "score", title: "Match score" }, x.score) : null),
        h("div", { class: "d" }, [addr, x.zone, x.planText ? "plan: " + x.planText : "", u.money(x.land) && num(x.acres) >= 1 ? u.money(num(x.land) / num(x.acres)) + "/ac land" : "", x.county].filter(Boolean).join(" · ")),
        h("div", { class: "chips small" }, whyChips(x).map(function (c) { return h("span", { class: "pill " + c[1] }, c[0]); }))));
      (x.group || [x]).forEach(function (p) {
        M.dot(p.center[1], p.center[0], { layer: layer, color: i < 20 ? brass : M.cssVar("--navy-pin"), tip: (clean(x.owner) || addr || "Parcel") + " · " + (u.acresFmt(p.acres) || "") + (multi ? " of " + u.acresFmt(x.acres) : ""), onClick: function () { selectOne(p); } });
      });
    });
    if (rows.length > 150) box.append(h("div", { class: "sub" }, "Showing the top 150."));
    box.append(l);
    if (!rows.length) box.append(h("div", { class: "empty" }, "Nothing in this view matches. Loosen a filter or move the map."));
  }
  function selectOne(x) { M.map.setView([x.center[1], x.center[0]], 17); T.parcel.select(x.center[0], x.center[1], { fit: true }); }
  function go(x) {
    if (!x.group || x.group.length < 2) return selectOne(x);
    // An assemblage: show all of the owner's parcels, then open the largest
    var b = L.latLngBounds(x.group.map(function (p) { return [p.center[1], p.center[0]]; }));
    M.map.fitBounds(b, { maxZoom: 16, padding: [60, 60] });
    var big = x.group.slice().sort(function (a, c) { return (num(c.acres) || 0) - (num(a.acres) || 0); })[0];
    T.parcel.select(big.center[0], big.center[1], { fit: false });
  }

  function renderOwner() {
    el.append(h("div", { class: "view-head" },
      h("button", { type: "button", class: "btn small ghost", onclick: function () { ownerMode = null; render(); } }, u.icon("chevronLeft"), "Sites"),
      h("div", { class: "eyebrow" }, "Owner records"), h("h2", { class: "title" }, ownerMode.heading)));
    var rows = ownerMode.rows;
    if (!rows) { el.append(u.loading("Searching county owner records")); return; }
    el.append(h("p", { class: "sub" }, "Searched " + ownerMode.searched.join(", ") + ". Fairfax, Loudoun, Henrico and Stafford don't publish owners, and land held in project LLCs won't match a company name."));
    if (!rows.length) { el.append(h("div", { class: "empty" }, "No parcels found under those names.")); return; }
    var totalAc = rows.reduce(function (s, x) { return s + (num(x.acres) || 0); }, 0);
    el.append(h("div", { class: "stats" }, u.stat(String(rows.length), "Parcels"), u.stat(u.acresFmt(totalAc), "Total acres")));
    var by = {};
    rows.forEach(function (x) { (by[x.county] = by[x.county] || []).push(x); });
    Object.keys(by).forEach(function (cn) {
      var l = h("div", { class: "list" });
      by[cn].slice(0, 60).forEach(function (x) {
        if (x.center) M.dot(x.center[1], x.center[0], { layer: layer, tip: clean(x.owner), onClick: function () { go(x); } });
        l.append(h("button", { type: "button", class: "item", onclick: function () { if (x.center) go(x); } },
          h("div", { class: "t" }, clean(x.owner) || "Parcel", num(x.acres) ? h("span", { class: "pill gray" }, u.acresFmt(x.acres)) : null),
          h("div", { class: "d" }, [T.parcel.addrOf(x), clean(x.zoningCode), u.money(x.total) ? "assessed " + u.money(x.total) : ""].filter(Boolean).join(" · "))));
      });
      el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, cn, h("span", { class: "count" }, by[cn].length)), l));
    });
    M.fitLayer(layer, 15);
  }

  T.views = T.views || {};
  T.views.sites = {
    title: "Sites",
    render: function (container) { el = container; render(); },
    onShow: function () { active = true; layer.addTo(M.map); render(); },
    onHide: function () { active = false; M.map.removeLayer(layer); }
  };
  T.sites = { ownerSearch: ownerSearch, run: run };
})();
