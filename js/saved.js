/*
 * Tract saved: your pipeline of parcels, kept in this browser. Status, notes, CSV export, pins on the map.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, h = u.h;
  var M = T.map;
  var STATUSES = ["Screening", "Researching", "Underwriting", "Contacted owner", "Under contract", "Passed"];
  var el = null, active = false, statusFilter = "";
  var layer = L.layerGroup();

  function list() { return u.store("saved") || []; }
  function put(l) { u.store("saved", l); }

  T.on("save-parcel", function (snap) {
    if (!snap) return;
    var l = list();
    if (l.some(function (s) { return s.key === snap.key; })) { T.show("saved"); return; }
    l.unshift(Object.assign({ status: "Screening", note: "", savedAt: Date.now() }, snap));
    put(l);
    u.toast("Saved to your pipeline");
    if (active) render();
  });

  function render() {
    if (!el) return;
    u.clear(el);
    layer.clearLayers();
    var all = list();
    var l = all.filter(function (s) { return !statusFilter || s.status === statusFilter; });
    var counts = {};
    all.forEach(function (s) { counts[s.status] = (counts[s.status] || 0) + 1; });
    el.append(h("div", { class: "view-head" },
      h("div", { class: "eyebrow" }, "Your pipeline · saved on this device"),
      h("div", { class: "head-row" }, h("h2", { class: "title" }, all.length ? all.length + " saved parcel" + (all.length > 1 ? "s" : "") : "Saved"),
        all.length ? h("button", { type: "button", class: "btn small", onclick: exportCsv }, u.icon("download"), "Export CSV") : null),
      all.length ? h("div", { class: "chips" }, [h("button", { type: "button", class: "chip", "aria-pressed": !statusFilter ? "true" : "false", onclick: function () { statusFilter = ""; render(); } }, "All")]
        .concat(STATUSES.filter(function (s) { return counts[s]; }).map(function (s) {
          return h("button", { type: "button", class: "chip", "aria-pressed": statusFilter === s ? "true" : "false", onclick: function () { statusFilter = s; render(); } }, s + " · " + counts[s]);
        }))) : null));
    if (!all.length) {
      el.append(h("div", { class: "callout plain" }, "Tap a parcel on the map, then Save to pipeline. It shows up here with a status and notes, and as a pin on the map."));
      return;
    }
    var brass = M.cssVar("--brass");
    l.forEach(function (s) {
      var i = all.indexOf(s);
      var status = h("select", { id: "st-" + i, "aria-label": "Status" }, STATUSES.map(function (x) { return h("option", { value: x, selected: s.status === x }, x); }));
      status.addEventListener("change", function () { var a = list(); a[i].status = status.value; put(a); render(); });
      var note = h("textarea", { id: "nt-" + i, "aria-label": "Notes", placeholder: "Owner outreach, constraints, next step" });
      note.value = s.note || "";
      note.addEventListener("change", function () { var a = list(); a[i].note = note.value; put(a); });
      el.append(h("div", { class: "saved-card" },
        h("button", { type: "button", class: "item", onclick: function () { M.map.setView([s.lat, s.lng], 17); T.parcel.select(s.lng, s.lat, { fit: true }); } },
          h("div", { class: "t" }, s.label, h("span", { class: "pill gray" }, u.acresFmt(s.acres) || "")),
          h("div", { class: "d" }, [s.locality, s.owner, u.money(s.total) ? "assessed " + u.money(s.total) : ""].filter(Boolean).join(" · ")),
          h("div", { class: "m" }, "Saved " + u.dateFmt(s.savedAt))),
        h("div", { class: "form-row" }, h("div", { class: "field" }, h("label", { for: "st-" + i }, "Status"), status)),
        h("div", { class: "field" }, note),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small ghost", onclick: function () { var a = list(); a.splice(i, 1); put(a); render(); } }, u.icon("trash"), "Remove"))));
      if (s.lat) M.dot(s.lat, s.lng, { layer: layer, color: s.status === "Passed" ? M.cssVar("--muted") : brass, tip: s.label + " · " + s.status, onClick: function () { T.parcel.select(s.lng, s.lat, { fit: true }); } });
    });
    if (active) M.fitLayer(layer, 14);
  }

  function exportCsv() {
    var rows = [["Parcel", "Locality", "Parcel ID", "Owner", "Acres", "Assessed", "Status", "Notes", "Latitude", "Longitude", "Saved"]];
    list().forEach(function (s) { rows.push([s.label, s.locality, s.pin, s.owner, s.acres != null ? (+s.acres).toFixed(2) : "", s.total || "", s.status, s.note, s.lat, s.lng, new Date(s.savedAt).toISOString().slice(0, 10)]); });
    u.download("tract-pipeline.csv", rows.map(function (r) { return r.map(function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n"), "text/csv");
  }

  T.views = T.views || {};
  T.views.saved = {
    title: "Saved",
    render: function (container) { el = container; render(); },
    onShow: function () { active = true; layer.addTo(M.map); render(); },
    onHide: function () { active = false; M.map.removeLayer(layer); }
  };
  T.saved = { has: function (key) { return list().some(function (s) { return s.key === key; }); } };
})();
