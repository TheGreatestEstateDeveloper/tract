/*
 * Tract settings: contacts import and export, data coverage by county, and app info.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, REG = T.REG, h = u.h;
  var el = null;

  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    var head = (rows.shift() || []).map(function (x) { return u.norm(x).replace(/ /g, ""); });
    return rows.filter(function (r) { return r.some(Boolean); }).map(function (r) {
      var o = {};
      head.forEach(function (k, i) { if (r[i]) o[{ fullname: "name", firm: "company", organization: "company", counties: "counties", county: "counties", phonenumber: "phone", mobile: "phone", emailaddress: "email", howweknow: "relationship", met: "relationship" }[k] || k] = r[i].trim(); });
      if (o.counties) o.counties = o.counties.split(/[;|]/).map(function (s) { return s.trim(); });
      if (o.lastinteraction || o.lastcontact) o.interactions = [{ date: o.lastdate || "", what: o.lastinteraction || o.lastcontact, where: o.lastwhere || "" }];
      return o;
    });
  }

  function render() {
    if (!el) return;
    u.clear(el);
    el.append(h("div", { class: "view-head" }, h("div", { class: "eyebrow" }, "Settings"), h("h2", { class: "title" }, "Tract")));

    // Contacts
    var fileIn = h("input", { id: "contacts-file", type: "file", accept: ".json,.csv,application/json,text/csv", class: "file-input" });
    fileIn.addEventListener("change", function () {
      var file = fileIn.files && fileIn.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = /\.csv$/i.test(file.name) ? parseCsv(String(rd.result)) : JSON.parse(rd.result);
          var res = T.network.importContacts(data);
          u.toast(res.added + " added, " + res.updated + " updated");
          render();
        } catch (e) { u.toast("That file isn't a contacts file Tract can read."); }
      };
      rd.readAsText(file);
    });
    var n = T.network.people().length;
    el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Your contacts"),
      h("p", { class: "sub" }, "Kept in this browser only and never sent anywhere. Import the same file on each device you use. " + n + (n === 1 ? " person" : " people") + " on this device."),
      h("label", { class: "btn", for: "contacts-file" }, u.icon("upload"), "Import contacts (.json or .csv)"), fileIn,
      n ? h("button", { type: "button", class: "btn", onclick: T.network.exportContacts }, u.icon("download"), "Export contacts") : null,
      h("details", { class: "sub" }, h("summary", null, "File format"),
        h("p", null, "JSON: { \"contacts\": [ { \"name\", \"company\", \"role\", \"title\", \"counties\": [\"Prince William\"], \"phone\", \"email\", \"relationship\", \"strength\", \"notes\", \"interactions\": [ { \"date\": \"2026-03-14\", \"what\", \"where\" } ] } ] }"),
        h("p", null, "CSV: a header row with name, company, role, title, counties (separate several with ;), phone, email, relationship, notes."))));

    // Coverage
    var cov = h("div", { class: "list" });
    REG.order.forEach(function (fips) {
      var l = REG.byFips[fips]; if (!l) return;
      var has = [];
      if (l.parcel && l.parcel.f.owner) has.push("owner");
      if (l.parcel && (l.parcel.f.total || l.parcel.f.land) || (l.joins && l.joins.some(function (j) { return j.f.total || j.f.land; }))) has.push("values");
      if (l.parcel && l.parcel.f.salePrice || (l.joins && l.joins.some(function (j) { return j.f.salePrice; }))) has.push("sales");
      if (l.zoning || (l.parcel && l.parcel.f.zoningCode)) has.push("zoning");
      if (l.plan || (l.parcel && l.parcel.f.compPlan)) has.push("future land use");
      if (l.cases) has.push("cases");
      if (l.areas) has.push(l.areas.map(function (a) { return a.label.toLowerCase(); }).join(", "));
      if (l.nearby) has.push("nearby values");
      cov.append(h("div", { class: "coverage-row" }, h("strong", null, l.name), h("span", { class: "pill " + (l.depth === "deep" ? "brass" : l.depth === "partial" ? "blue" : "gray") }, l.depth === "deep" ? "Full" : l.depth === "partial" ? "Partial" : "Plan only"),
        h("div", { class: "d" }, (has.length ? has.join(", ") : "parcel outline and links") + (l.stale ? ". " + l.stale : ""))));
    });
    el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "What each county publishes"),
      h("p", { class: "sub" }, "Every parcel in Virginia has an outline and acreage from the state layer (VGIN). These localities add more, read live from their own GIS servers each time you tap. Everywhere else shows outlines, borders, flood zones and wetlands."), cov));

    el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "About"),
      h("p", { class: "sub" }, "Tract reads public county, state and federal data at the moment you look. Assessment data isn't a survey or a title search; confirm anything you'll rely on with the county and the land records. Firm profiles come from public sources listed on each page."),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: function () { if (window.caches) caches.keys().then(function (ks) { Promise.all(ks.map(function (k) { return caches.delete(k); })).then(function () { location.reload(); }); }); else location.reload(); } }, "Reload latest version"))));
  }

  T.views = T.views || {};
  T.views.settings = {
    title: "Settings",
    render: function (container) { el = container; render(); },
    onShow: function () { render(); },
    onHide: function () {}
  };
  T.on("network", function () { if (T.view === "settings") render(); });
})();
