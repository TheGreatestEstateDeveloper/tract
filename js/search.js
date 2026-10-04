/*
 * Tract search: one box for addresses and places, coordinates, parcel IDs (pin:), owners (owner:),
 * plus instant matches from your companies, people and counties.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, gis = T.gis, REG = T.REG, h = u.h;
  var box = u.$("search"), results = u.$("search-results"), form = u.$("search-form");
  var M = T.map;

  form.addEventListener("submit", function (e) { e.preventDefault(); runSearch(box.value.trim()); });
  document.addEventListener("click", function (e) { if (!e.target.closest(".search-wrap")) results.hidden = true; });
  box.addEventListener("focus", function () { if (results.childNodes.length && box.value.trim()) results.hidden = false; });
  var typing;
  box.addEventListener("input", function () { clearTimeout(typing); typing = setTimeout(function () { instant(box.value.trim()); }, 160); });
  box.addEventListener("keydown", function (e) { if (e.key === "Escape") { results.hidden = true; box.blur(); } });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== box && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); box.focus(); }
  });

  function row(label, sub, onClick, iconName) {
    return h("button", { type: "button", class: "result", onclick: function () { results.hidden = true; onClick(); } },
      iconName ? u.icon(iconName) : null, h("span", null, label, sub ? h("small", null, sub) : null));
  }

  // Instant local matches while typing: companies, people, counties
  function instant(q) {
    if (q.length < 2 || /^(pin|gpin|parcel|id|owner)\s*[:#]/i.test(q) || /^-?\d+(\.\d+)?\s*[, ]\s*-?\d+/.test(q)) { if (!q) results.hidden = true; return; }
    var n = u.norm(q), out = [];
    (T.network ? T.network.companies() : []).filter(function (c) { return u.norm(c.name + " " + (c.aliases || []).join(" ")).indexOf(n) >= 0; }).slice(0, 4).forEach(function (c) {
      out.push(row(c.name, "Company" + (c.people && c.people.length ? " · " + c.people.length + " people you know" : ""), function () { T.show("network"); T.network.openCompany(c.id); }, "building"));
    });
    (T.network ? T.network.people() : []).filter(function (p) { return u.norm(p.name + " " + (p.company || "")).indexOf(n) >= 0; }).slice(0, 4).forEach(function (p) {
      out.push(row(p.name, [p.role || p.title, p.company].filter(Boolean).join(" · ") || "Person", function () { T.show("network"); T.network.openPerson(p.id); }, "network"));
    });
    var locs = M.localities();
    if (locs) locs.features.filter(function (f) { return u.norm(f.properties.name).indexOf(n) >= 0; }).slice(0, 3).forEach(function (f) {
      out.push(row(f.properties.name, "County or city", function () { T.show("network"); T.network.openCounty(f.properties.fips); }, "pin"));
    });
    u.clear(results);
    if (!out.length) { results.hidden = true; return; }
    out.forEach(function (x) { results.append(x); });
    results.append(h("div", { class: "result hint" }, "Press Enter to search addresses and places"));
    results.hidden = false;
  }

  async function runSearch(q) {
    if (!q) return;
    u.clear(results); results.hidden = false; results.append(h("div", { class: "result" }, u.loading("Searching")));
    var coord = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coord) {
      var a = +coord[1], b = +coord[2], lat = Math.abs(a) < 45 ? a : b, lng = Math.abs(a) < 45 ? b : a;
      results.hidden = true; M.map.setView([lat, lng], 18); T.parcel.select(lng, lat, { fit: true }); return;
    }
    var pinM = q.match(/^(pin|gpin|parcel|id)\s*[:#]\s*(.+)$/i);
    if (pinM) return searchPin(pinM[2].trim());
    var ownM = q.match(/^owner\s*[:#]\s*(.+)$/i);
    if (ownM) { results.hidden = true; T.show("sites"); T.sites.ownerSearch([ownM[1].trim().toUpperCase()], "Owner search: " + ownM[1].trim()); return; }
    try {
      var url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=6&outFields=Match_addr,Addr_type&countryCode=USA" +
        "&searchExtent=" + encodeURIComponent(JSON.stringify({ xmin: -83.7, ymin: 36.5, xmax: -75.2, ymax: 39.5, spatialReference: { wkid: 4326 } })) +
        "&SingleLine=" + encodeURIComponent(q + (/virginia|\bva\b/i.test(q) ? "" : ", Virginia"));
      var j = await (await fetch(url)).json();
      u.clear(results);
      var cands = (j.candidates || []).filter(function (c) { return c.score > 70; });
      cands.forEach(function (c) {
        results.append(row(c.address, c.attributes && c.attributes.Addr_type ? c.attributes.Addr_type.replace(/([a-z])([A-Z])/g, "$1 $2") : "", function () {
          var ll = c.location; M.map.setView([ll.y, ll.x], 18); T.parcel.select(ll.x, ll.y, { fit: true });
        }, "pin"));
      });
      results.append(row("Search owner names for \"" + q + "\"", "Counties that publish owners", function () { T.show("sites"); T.sites.ownerSearch([q.toUpperCase()], "Owner search: " + q); }, "search"));
      if (!cands.length) results.insertBefore(h("div", { class: "result hint" }, "No address match. Try a street address, a place name, or owner: NAME."), results.firstChild);
    } catch (e) { u.clear(results).append(h("div", { class: "result" }, "Search isn't reachable right now. Check your connection.")); }
  }

  async function searchPin(pin) {
    try {
      var j = await gis.ags(REG.VGIN.feature, { where: "PTM_ID = '" + u.sq(pin) + "' OR PARCELID = '" + u.sq(pin) + "'", outFields: "FIPS,LOCALITY,PTM_ID", returnGeometry: true, outSR: 4326, f: "geojson", resultRecordCount: 10 });
      u.clear(results);
      var fs = j.features || [];
      if (!fs.length) { results.append(h("div", { class: "result" }, "No parcel with that ID. Use the ID exactly as the county writes it, spaces included.")); return; }
      fs.forEach(function (f) {
        var b = L.geoJSON(f.geometry).getBounds(), c = b.getCenter();
        results.append(row(f.properties.PTM_ID, f.properties.LOCALITY, function () { M.map.fitBounds(b, { maxZoom: 18 }); T.parcel.select(c.lng, c.lat, { fit: false }); }, "pin"));
      });
    } catch (e) { u.clear(results).append(h("div", { class: "result" }, "The state parcel service didn't answer. Try again.")); }
  }

  T.search = { run: runSearch, focus: function () { box.focus(); } };
})();
