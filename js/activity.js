/*
 * Tract activity: what builders and developers are doing, read live from county records.
 *  - Filings: rezonings, site plans, subdivisions and permits in every county case layer that has a date.
 *  - Land: recent purchases where the new owner matches a known builder or developer name.
 * Each item is matched to a firm by names in the case (applicant, developer, owner, project) or the buyer.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, gis = T.gis, geo = T.geo, REG = T.REG, FIRMS = T.FIRMS, h = u.h;
  var M = T.map;
  var clean = u.clean, num = u.num;

  var RANGES = [["90", "90 days"], ["365", "1 year"], ["730", "2 years"]];
  var state = { days: u.store("actDays") || "365", kind: "all", firm: "", fips: "", display: u.store("actDisplay") || "map", who: "matched" };
  var el = null, active = false;
  var layer = L.layerGroup();
  var cache = {}; // key -> Promise of items
  var items = null, progress = null;

  function firmByKey(k) { return FIRMS.firms.filter(function (f) { return f.key === k; })[0]; }
  function shortName(n) { return String(n).split(" (")[0]; }

  // Project names from firm profiles help match cases filed under a community name
  var projectIndex = null;
  function projectMatch(text) {
    if (!projectIndex) {
      projectIndex = [];
      FIRMS.firms.forEach(function (f) {
        (f.projects || []).forEach(function (p) {
          var n = String(p.name || "").replace(/\(.*?\)/g, "").trim();
          if (n.length < 6 || /townhomes?|homes|section|phase/i.test(n) && n.split(" ").length < 2) return;
          projectIndex.push({ re: new RegExp("(^|[^A-Z])" + n.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "([^A-Z]|$)"), firm: f, project: n });
        });
      });
    }
    var t = String(text || "").toUpperCase();
    for (var i = 0; i < projectIndex.length; i++) if (projectIndex[i].re.test(t)) return projectIndex[i];
    return null;
  }

  function sinceDate() { var d = new Date(T.NOW); d.setDate(d.getDate() - (+state.days)); return d.toISOString().slice(0, 10); }

  // ---------------------------------------------------------------- loading
  async function caseFilings(fips, loc, since) {
    var out = [];
    await Promise.all((loc.cases || []).map(async function (cfg) {
      var f = cfg.f || {};
      if (!f.date) return;
      var fields = Object.keys(f).map(function (k) { return f[k]; }).filter(function (x) { return typeof x === "string"; });
      var params = { where: f.date + " >= DATE '" + since + "'", outFields: fields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.001, resultRecordCount: 800 };
      var j;
      try { j = await gis.ags(gis.layerUrl(cfg), params, { timeout: 30000 }); }
      catch (e) {
        // Some servers store dates as text; fall back to newest records and filter here
        try { j = await gis.ags(gis.layerUrl(cfg), Object.assign({}, params, { where: "1=1", orderByFields: f.date + " DESC", resultRecordCount: 400 }), { timeout: 30000 }); } catch (e2) { return; }
      }
      var cut = u.toDate(since);
      (j.features || []).forEach(function (x) {
        var m = gis.mapAttrs(x.attributes, f);
        var d = u.toDate(m.date);
        if (!d || d < cut || d > new Date(T.NOW.getTime() + 864e5 * 400)) return;
        var center = geo.geomCenter(x.geometry);
        var text = [m.name, m.alt, m.applicant, m.developer, m.caseOwner, m.rep, m.desc].map(clean).join(" | ");
        var firm = T.firmForText(text), via = firm ? "name" : null;
        if (!firm) { var pm = projectMatch([m.name, m.alt, m.desc].join(" ")); if (pm) { firm = { key: pm.firm.key, name: pm.firm.name, short: shortName(pm.firm.name) }; via = "project " + pm.project; } }
        out.push({ kind: "filing", fips: fips, county: loc.name, cfg: cfg, m: m, date: d, center: center, firm: firm, via: via,
          title: clean(m.name) || clean(m.alt) || clean(m.number) || "Case", who: clean(m.developer) || clean(m.applicant) || clean(m.caseOwner) || "" });
      });
    }));
    return out;
  }

  var ownerPatternList = null;
  function ownerPatterns() {
    if (!ownerPatternList) {
      ownerPatternList = [];
      FIRMS.firms.forEach(function (f) { (f.ownerPatterns || []).forEach(function (p) { if (ownerPatternList.indexOf(p) < 0) ownerPatternList.push(p.toUpperCase()); }); });
    }
    return ownerPatternList;
  }
  async function landBuys(fips, loc, since) {
    var pl = loc.parcel, f = pl && pl.f;
    if (!f || !f.owner || !f.saleDate || !loc.ownerSearch) return [];
    var likes = ownerPatterns().map(function (p) { return "UPPER(" + f.owner + ") LIKE '%" + u.sq(p) + "%'"; }).join(" OR ");
    var fields = ["owner", "acres", "areaSqft", "address", "id", "salePrice", "saleDate", "zoningCode", "subdivision"].map(function (k) { return f[k]; }).filter(Boolean);
    var params = { where: "(" + likes + ") AND " + f.saleDate + " >= DATE '" + since + "'", outFields: fields.join(","), returnGeometry: true, outSR: 4326, maxAllowableOffset: 0.0008, resultRecordCount: 1000 };
    var j;
    try { j = await gis.ags(pl.url, params, { timeout: 30000 }); }
    catch (e) { try { j = await gis.ags(pl.url, Object.assign({}, params, { where: likes }), { timeout: 30000 }); } catch (e2) { return []; } }
    var cut = u.toDate(since);
    // Builders usually buy finished lots one at a time; roll them up by firm and subdivision (or by area when there's no subdivision name)
    var groups = {};
    (j.features || []).forEach(function (x) {
      var m = gis.mapAttrs(x.attributes, f);
      var d = u.toDate(m.saleDate);
      if (!d || d < cut) return;
      var firm = T.firmForText(m.owner);
      if (!firm) return;
      var c = geo.ringsCentroid(x.geometry && x.geometry.rings);
      var sub = clean(m.subdivision);
      var key = firm.key + "|" + (sub ? sub.toUpperCase() : c ? c[0].toFixed(2) + "," + c[1].toFixed(2) : clean(m.id));
      var g = groups[key] || (groups[key] = { kind: "land", fips: fips, county: loc.name, firm: firm, via: "owner name", count: 0, price: 0, acres: 0, first: d, date: d, center: c, sub: sub, owners: {}, deeds: {}, m: m });
      g.count++;
      // One deed often covers several lots and counties repeat its full price on each; count each price once per date
      var deedKey = d.toISOString().slice(0, 10) + "|" + (num(m.salePrice) || 0);
      if (!g.deeds[deedKey]) { g.deeds[deedKey] = true; g.price += num(m.salePrice) || 0; }
      g.acres += num(m.acres) || 0;
      if (d > g.date) { g.date = d; g.m = m; }
      if (d < g.first) g.first = d;
      g.owners[clean(m.owner)] = true;
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.who = Object.keys(g.owners).slice(0, 2).join(", ");
      g.title = g.count > 1
        ? g.count + " lots" + (g.sub ? " in " + g.sub : "") + (g.price ? " · " + u.money(g.price) : "")
        : (g.price ? u.money(g.price) : "Transfer") + (g.acres ? " · " + u.acresFmt(g.acres) : "") + (g.sub ? " · " + g.sub : "");
      return g;
    });
  }

  async function load() {
    var key = state.days;
    if (!cache[key]) {
      var since = sinceDate();
      var targets = REG.order.filter(function (f) { var l = REG.byFips[f]; return l && (l.cases || (l.parcel && l.ownerSearch)); });
      progress = { done: 0, total: targets.length };
      cache[key] = Promise.all(targets.map(async function (fips) {
        var loc = REG.byFips[fips];
        var res = await Promise.all([caseFilings(fips, loc, since).catch(function () { return []; }), landBuys(fips, loc, since).catch(function () { return []; })]);
        progress.done++;
        if (active && !items) renderStatus();
        return res[0].concat(res[1]);
      })).then(function (all) { return [].concat.apply([], all).sort(function (a, b) { return b.date - a.date; }); });
    }
    items = null;
    render();
    items = await cache[key];
    if (active) render();
  }

  function filtered() {
    return (items || []).filter(function (it) {
      if (state.kind !== "all" && it.kind !== state.kind) return false;
      if (state.fips && it.fips !== state.fips) return false;
      if (state.firm && (!it.firm || it.firm.key !== state.firm)) return false;
      if (!state.firm && state.who === "matched" && !it.firm) return false;
      return true;
    });
  }

  // ---------------------------------------------------------------- rendering
  var statusEl = null;
  function renderStatus() {
    if (!statusEl || !progress) return;
    u.clear(statusEl).append(u.loading("Checking county records (" + progress.done + " of " + progress.total + " counties)"));
  }

  function render() {
    if (!el) return;
    u.clear(el);
    var firm = state.firm && firmByKey(state.firm);
    var firmSel = h("select", { "aria-label": "Builder or developer" }, h("option", { value: "" }, "All builders and developers"),
      FIRMS.firms.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (f) { return h("option", { value: f.key, selected: f.key === state.firm }, shortName(f.name)); }));
    firmSel.addEventListener("change", function () { state.firm = firmSel.value; render(); });
    var countySel = h("select", { "aria-label": "County" }, h("option", { value: "" }, "All counties"),
      REG.order.filter(function (f) { var l = REG.byFips[f]; return l.cases || l.parcel; }).map(function (f) { return h("option", { value: f, selected: f === state.fips }, REG.byFips[f].name); }));
    countySel.addEventListener("change", function () { state.fips = countySel.value; render(); });

    el.append(h("div", { class: "view-head" },
      h("div", { class: "eyebrow" }, "Live from county records"),
      h("h2", { class: "title" }, firm ? shortName(firm.name) : state.fips ? REG.byFips[state.fips].name + " activity" : "Who's doing what"),
      firm ? h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small ghost", onclick: function () { state.firm = ""; render(); } }, u.icon("chevronLeft"), "All firms"),
        T.network ? h("button", { type: "button", class: "btn small", onclick: function () { T.show("network"); T.network.openCompany("firm:" + firm.key); } }, u.icon("building"), "Company page") : null) : null,
      h("div", { class: "toolbar" },
        u.segmented(RANGES, state.days, function (v) { state.days = v; u.store("actDays", v); load(); }, "Time range"),
        u.segmented([["map", "Map"], ["list", "List"]], state.display, function (v) { state.display = v; u.store("actDisplay", v); render(); }, "Display")),
      h("div", { class: "filters" }, firmSel, countySel),
      h("div", { class: "chips" },
        [["all", "Everything"], ["filing", "Rezonings and plans"], ["land", "Land purchases"]].map(function (k) {
          return h("button", { type: "button", class: "chip", "aria-pressed": state.kind === k[0] ? "true" : "false", onclick: function () { state.kind = k[0]; render(); } }, k[1]);
        }),
        !state.firm ? h("button", { type: "button", class: "chip", "aria-pressed": state.who === "all" ? "true" : "false", onclick: function () { state.who = state.who === "all" ? "matched" : "all"; render(); } }, "Include unmatched filings") : null)));

    statusEl = h("div", { class: "block" });
    el.append(statusEl);
    if (!items) { renderStatus(); drawMap([]); return; }
    var list = filtered();
    var firmsIn = {};
    list.forEach(function (it) { if (it.firm) firmsIn[it.firm.key] = (firmsIn[it.firm.key] || 0) + (it.count || 1); });
    var lots = list.filter(function (i) { return i.kind === "land"; }).reduce(function (s, i) { return s + (i.count || 1); }, 0);
    statusEl.append(h("div", { class: "stats" },
      u.stat(String(list.filter(function (i) { return i.kind === "filing"; }).length), "Filings"),
      u.stat(String(lots), "Lots and parcels bought"),
      u.stat(String(Object.keys(firmsIn).length), "Firms active")));
    if (!list.length) statusEl.append(h("div", { class: "empty" }, state.firm ? "No filings or purchases under this firm's names in the selected range. Builders often file under project LLCs and engineers; try Include unmatched filings, or a longer range." : "Nothing in this range."));

    if (state.display === "list" || state.firm) {
      // Group by firm (or by county when one firm is selected)
      var groups = {};
      list.forEach(function (it) {
        var g = state.firm ? it.county : it.firm ? shortName(it.firm.name) : "Not matched to a firm";
        (groups[g] = groups[g] || []).push(it);
      });
      Object.keys(groups).sort(function (a, b) { return (a === "Not matched to a firm") - (b === "Not matched to a firm") || groups[b].length - groups[a].length; }).forEach(function (g) {
        var box = h("section", { class: "block" }, h("h3", { class: "sec" }, g, h("span", { class: "count" }, groups[g].length)));
        var l = h("div", { class: "list" });
        groups[g].slice(0, 60).forEach(function (it) { l.append(itemEl(it)); });
        if (groups[g].length > 60) box.append(h("div", { class: "sub" }, (groups[g].length - 60) + " more"));
        box.append(l);
        el.append(box);
      });
    } else {
      // Map mode: a compact firm leaderboard; the map carries the detail
      var lb = h("div", { class: "list" });
      Object.keys(firmsIn).sort(function (a, b) { return firmsIn[b] - firmsIn[a]; }).forEach(function (k) {
        var f = firmByKey(k);
        lb.append(h("button", { type: "button", class: "item", onclick: function () { state.firm = k; render(); } },
          h("div", { class: "t" }, shortName(f.name), h("span", { class: "pill blue" }, firmsIn[k])),
          h("div", { class: "d" }, f.tagline || "")));
      });
      if (lb.childNodes.length) el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Most active"), lb));
      var recent = h("div", { class: "list" });
      list.slice(0, 25).forEach(function (it) { recent.append(itemEl(it)); });
      if (list.length) el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Latest"), recent));
    }
    el.append(h("p", { class: "sub" }, "Matching uses names in the county record (applicant, developer, owner, project). Builders often file through project LLCs, engineers or attorneys, so treat this as a floor, not a full count. Counties without dated case files aren't included."));
    drawMap(list);
  }

  function itemEl(it) {
    var m = it.m;
    var meta = it.kind === "land"
      ? [it.count > 1 && it.first < it.date ? "Bought " + u.dateFmt(it.first) + " to " + u.dateFmt(it.date) : "Bought " + u.dateFmt(it.date), it.acres ? u.acresFmt(it.acres) : "", clean(m.zoningCode), it.county].filter(Boolean)
      : [clean(m.type), clean(m.status), u.dateFmt(it.date), it.county].filter(Boolean);
    var b = h("button", { type: "button", class: "item", onclick: function () {
      if (!it.center) return;
      M.map.setView([it.center[1], it.center[0]], 16);
      if (it.kind === "land") T.parcel.select(it.center[0], it.center[1], { fit: true });
    } },
      h("div", { class: "t" }, it.kind === "land" ? h("span", { class: "pill brass" }, it.count > 1 ? "Lots" : "Land") : h("span", { class: "pill blue" }, clean(m.number) || "Case"), it.title,
        it.firm && !state.firm ? h("span", { class: "pill gray" }, it.firm.short) : null),
      it.who ? h("div", { class: "d" }, it.who) : null,
      h("div", { class: "m" }, meta.join(" · ")),
      it.kind === "filing" && clean(m.desc) ? h("div", { class: "d" }, clean(m.desc).slice(0, 180) + (clean(m.desc).length > 180 ? "…" : "")) : null);
    return b;
  }

  function drawMap(list) {
    layer.clearLayers();
    if (!active) return;
    var brass = M.cssVar("--brass"), blue = M.cssVar("--case");
    list.forEach(function (it) {
      if (!it.center) return;
      M.dot(it.center[1], it.center[0], { layer: layer, color: it.kind === "land" ? brass : blue, cls: it.kind,
        tip: (it.firm ? it.firm.short + " · " : "") + it.title + " · " + u.dateFmt(it.date),
        onClick: function () {
          M.map.setView([it.center[1], it.center[0]], Math.max(M.map.getZoom(), 16));
          if (it.kind === "land") T.parcel.select(it.center[0], it.center[1], { fit: true });
          else T.parcel.select(it.center[0], it.center[1], { fit: true });
        } });
    });
    if (list.length && layer.getLayers().length) M.fitLayer(layer, 13);
  }

  T.views = T.views || {};
  T.views.activity = {
    title: "Activity",
    render: function (container) { el = container; render(); },
    onShow: function () { active = true; layer.addTo(M.map); if (!items) load(); else render(); },
    onHide: function () { active = false; M.map.removeLayer(layer); }
  };
  T.activity = {
    openFirm: function (key) { state.firm = key; state.fips = ""; if (active) { if (!items) load(); else render(); } },
    openCounty: function (fips) { state.fips = fips; state.firm = ""; if (active) { if (!items) load(); else render(); } }
  };
})();
