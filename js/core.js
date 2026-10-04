/*
 * Tract core: shared helpers, the ArcGIS REST wrapper, icons and a tiny event bus.
 * Loaded first. Every other file reads what it needs from window.Tract (T).
 */
(function () {
  "use strict";

  var T = window.Tract = window.Tract || {};
  T.REG = window.TRACT_LOCALITIES;
  T.FIRMS = window.TRACT_FIRMS || { firms: [], updated: "" };
  var NOW = new Date();
  T.NOW = NOW;
  T.YEAR = NOW.getFullYear();
  var STORE = "tract:v1:";

  // ---------------------------------------------------------------- events
  var handlers = {};
  T.on = function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); };
  T.emit = function (evt, data) { (handlers[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };

  // ---------------------------------------------------------------- DOM
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
  function store(k, v) {
    try {
      if (arguments.length === 1) { var r = localStorage.getItem(STORE + k); return r ? JSON.parse(r) : null; }
      localStorage.setItem(STORE + k, JSON.stringify(v));
    } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- formatting
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
    if (v instanceof Date) return v;
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
  function ago(v) {
    var d = toDate(v); if (!d) return "";
    var days = Math.round((NOW - d) / 864e5);
    if (days < 1) return "today";
    if (days < 2) return "yesterday";
    if (days < 45) return days + " days ago";
    if (days < 540) return Math.round(days / 30.4) + " months ago";
    return Math.round(days / 365) + " years ago";
  }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function clean(v) { if (v == null) return ""; var s = String(v).trim(); return /^(<?null>?|none|n\/a|0+|unassigned|unknown|need address|[.,\s]+)$/i.test(s) ? "" : s; }
  function yesNo(v) { var s = clean(v).toUpperCase(); return s === "Y" || s === "YES" || s === "T" || s === "TRUE" ? "Yes" : s === "N" || s === "NO" || s === "F" || s === "FALSE" ? "No" : clean(v); }
  function sq(s) { return String(s).replace(/'/g, "''"); }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function initials(name) { return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""); }

  // ---------------------------------------------------------------- small UI pieces
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600); }
  function loading(text) { return h("div", { class: "loading" }, text || "Loading"); }
  function kv(rows) {
    var g = h("div", { class: "kv" });
    rows.forEach(function (r) { if (!r || r[1] == null || r[1] === "") return; g.append(h("div", { class: "k" }, r[0]), h("div", { class: "v" + (r[2] ? " mono" : "") }, r[1])); });
    return g.childNodes.length ? g : null;
  }
  function stat(n, l) { return h("div", { class: "stat" }, h("div", { class: "n" }, n == null ? "–" : n), h("div", { class: "l" }, l)); }
  function extLink(href, label) { return h("a", { class: "btn", href: href, target: "_blank", rel: "noopener" }, label, " ↗"); }
  function prose(text) { var d = h("div", { class: "prose" }); String(text).split(/\n\n+/).forEach(function (p) { d.append(h("p", null, p)); }); return d; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function segmented(options, value, onChange, label) {
    var seg = h("div", { class: "segmented", role: "group", "aria-label": label || "" });
    options.forEach(function (o) {
      seg.append(h("button", { type: "button", "aria-pressed": o[0] === value ? "true" : "false", onclick: function () { onChange(o[0]); } }, o[1]));
    });
    return seg;
  }

  // Line icons, 24px grid, drawn with currentColor
  var ICONS = {
    map: "M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20",
    target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    network: "M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20v-1a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v1m2 0v-1a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v1",
    activity: "M3 21h18M5 21V10l5-3v14M10 9l6-4v16M16 12h3v9",
    bookmark: "M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm7.4 3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z",
    layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4",
    x: "M6 6l12 12M18 6 6 18",
    locate: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v3m0 14v3M2 12h3m14 0h3",
    ruler: "M3 17 17 3l4 4L7 21zM7 13l2 2m1-5 2 2m1-5 2 2",
    chevronLeft: "M15 6l-6 6 6 6",
    chevronRight: "M9 6l6 6-6 6",
    plus: "M12 5v14M5 12h14",
    phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
    mail: "M3 6h18v12H3zM3 7l9 6 9-6",
    pin: "M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11zm0-13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    building: "M4 21V5l8-2v18M12 7l8 3v11M8 9v.01M8 13v.01M8 17v.01M16 13v.01M16 17v.01M2 21h20",
    list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
    edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
    trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
    upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
    download: "M12 4v12m-5-5 5 5 5-5M4 20h16",
    calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    filter: "M4 5h16l-6 8v6l-4-2v-4z"
  };
  function icon(name, cls) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "icon" + (cls ? " " + cls : ""));
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", ICONS[name] || "");
    svg.appendChild(p);
    return svg;
  }

  // ---------------------------------------------------------------- geometry
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
  function polysOf(g) { return !g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []; }
  function geomAcres(g) {
    var m2 = 0;
    polysOf(g).forEach(function (p) { p.forEach(function (ring, i) { var a = Math.abs(ringArea(ring)); m2 += i === 0 ? a : -a; }); });
    return m2 / 4046.8564224;
  }
  function ringsCentroid(rings) {
    if (!rings || !rings.length) return null;
    var r = rings[0], x = 0, y = 0;
    r.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / r.length, y / r.length];
  }
  function geomCenter(g) { return !g ? null : g.x != null ? [g.x, g.y] : ringsCentroid(g.rings); }
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
  function pointInGeom(pt, g) { return polysOf(g).some(function (p) { return pointInRings(pt, p); }); }
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
  function atPoint(url, lng, lat, extra, opts) {
    return ags(url, Object.assign({ geometry: pointGeom(lng, lat), geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: false }, extra || {}), opts);
  }
  function inEnvelope(url, env, extra, opts) {
    return ags(url, Object.assign({ geometry: env, geometryType: "esriGeometryEnvelope", inSR: 4326, spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: false }, extra || {}), opts);
  }
  function mapAttrs(attrs, f) {
    var out = {};
    if (!attrs) return out;
    Object.keys(f || {}).forEach(function (k) { var src = f[k]; if (typeof src === "string" && attrs[src] !== undefined) out[k] = attrs[src]; });
    // Some counties record small lots in square feet in the acreage field; trust the drawn area when they disagree badly.
    var sqft = num(out.areaSqft);
    if (sqft && sqft > 0) { var calc = sqft / 43560, a = num(out.acres); if (a == null || a > calc * 3) out.acres = calc; }
    // Zero acres means "not recorded" (subdivision lots); let the measured outline stand in
    if (out.acres !== undefined && !(num(out.acres) > 0)) delete out.acres;
    // Counties that publish land and building values but no total: total is the sum
    if (f && !f.total && out.total == null && num(out.land) != null && num(out.impr) != null) out.total = num(out.land) + num(out.impr);
    return out;
  }
  // Numeric field expression for WHERE clauses (some counties store numbers as text).
  function nf(pl, field) {
    var text = pl.textNumbers === true || (pl.textFields && pl.textFields.indexOf(field) >= 0);
    return text ? "CAST(" + field + " AS FLOAT)" : field;
  }

  // Layer metadata (cached): code -> plain label and code -> color, read from the layer's own map styling,
  // so "SR1" shows as "Suburban Residential 1" and the map and legend use the county's own colors.
  var metaCache = {};
  function layerMeta(cfg) {
    var u = layerUrl(cfg);
    if (!metaCache[u]) {
      metaCache[u] = fetch(u + "?f=json").then(function (r) { return r.json(); }).then(function (j) {
        var labels = {}, colors = {}, rd = j && j.drawingInfo && j.drawingInfo.renderer;
        (rd && rd.uniqueValueInfos || []).forEach(function (u2) {
          if (u2.value == null) return;
          var val = String(u2.value), label = String(u2.label || "").trim(), key = val.toUpperCase();
          // Drop a trailing "- (CODE)" that just repeats the code
          var tail = label.lastIndexOf("(" + val + ")");
          if (tail > 0 && tail + val.length + 2 === label.length) label = label.slice(0, tail).replace(/[\s-]+$/, "");
          if (label && label.toUpperCase() !== key) labels[key] = label;
          var c = u2.symbol && u2.symbol.color;
          if (c && c.length >= 3) colors[key] = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
        });
        return { labels: labels, colors: colors, field: rd && (rd.field1 || rd.field), name: j && j.name };
      }).catch(function () { return { labels: {}, colors: {} }; });
    }
    return metaCache[u];
  }
  function layerLabels(cfg) { return layerMeta(cfg).then(function (m) { return m.labels; }); }
  function withLabel(code, labels) {
    var c = clean(code); if (!c || !labels) return c;
    var l = labels[c.toUpperCase()];
    return l ? c + " · " + l : c;
  }

  T.u = { $: $, h: h, append: append, clear: clear, store: store, num: num, money: money, moneyFull: moneyFull, acresFmt: acresFmt,
    toDate: toDate, dateFmt: dateFmt, ago: ago, median: median, clean: clean, yesNo: yesNo, sq: sq, norm: norm, initials: initials,
    toast: toast, loading: loading, kv: kv, stat: stat, extLink: extLink, prose: prose, download: download, segmented: segmented, icon: icon };
  T.geo = { rad: rad, polysOf: polysOf, geomAcres: geomAcres, ringsCentroid: ringsCentroid, geomCenter: geomCenter, pointInRings: pointInRings,
    pointInGeom: pointInGeom, distMeters: distMeters, milesFmt: milesFmt };
  T.gis = { layerUrl: layerUrl, pointGeom: pointGeom, envelope: envelope, ags: ags, atPoint: atPoint, inEnvelope: inEnvelope, mapAttrs: mapAttrs,
    nf: nf, layerMeta: layerMeta, layerLabels: layerLabels, withLabel: withLabel };
})();
