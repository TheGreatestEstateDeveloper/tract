/*
 * Tract app shell: section switching (Map, Sites, Network, Activity, Saved, Settings), the phone sheet,
 * the laptop panel collapse, map tools, and start-up from the address bar (#p=lat,lng or #section).
 * Each section lives in its own file and registers itself on Tract.views.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, M = T.map;
  var ORDER = ["map", "sites", "network", "activity", "saved", "settings"];
  var app = u.$("app"), side = u.$("side"), sideBody = u.$("side-body");
  var phone = function () { return window.innerWidth < 900; };

  // Static icons in the shell
  Array.prototype.forEach.call(document.querySelectorAll("[data-icon]"), function (b) { b.insertBefore(u.icon(b.getAttribute("data-icon")), b.firstChild); });
  u.$("side-collapse").append(u.icon("chevronLeft"));

  T.views = T.views || {};
  T.views.map = {
    title: "Map",
    render: function (el) { M.renderLayers(el); },
    onShow: function () {},
    onHide: function () {}
  };

  var rendered = {};
  T.view = null;
  T.show = function (name) {
    if (!T.views[name]) name = "map";
    if (side.classList.contains("collapsed")) setCollapsed(false);
    if (phone()) {
      var s = side.getAttribute("data-state");
      if (name === "map") side.setAttribute("data-state", T.view === "map" && s !== "peek" ? "peek" : s === "full" ? "full" : "half");
      else if (s === "peek") side.setAttribute("data-state", "half");
    }
    if (T.view === name) return;
    if (T.view && T.views[T.view].onHide) T.views[T.view].onHide();
    T.view = name;
    app.setAttribute("data-view", name);
    ORDER.forEach(function (n) { u.$("view-" + n).hidden = n !== name; });
    Array.prototype.forEach.call(document.querySelectorAll(".nav-btn"), function (b) {
      if (b.getAttribute("data-view") === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var el = u.$("view-" + name);
    if (!rendered[name]) { T.views[name].render(el); rendered[name] = true; }
    if (T.views[name].onShow) T.views[name].onShow();
    sideBody.scrollTop = 0;
    u.store("view", name);
    if (!/^#p=/.test(location.hash)) { try { history.replaceState(null, "", name === "map" ? location.pathname : "#" + name); } catch (e) { /* ignore */ } }
  };

  Array.prototype.forEach.call(document.querySelectorAll(".nav-btn"), function (b) {
    b.addEventListener("click", function () { T.show(b.getAttribute("data-view")); });
  });
  document.querySelector(".brand").addEventListener("click", function (e) { e.preventDefault(); T.show("map"); });

  // Phone: the panel is a bottom sheet with three heights
  u.$("side-handle").addEventListener("click", function () {
    var s = side.getAttribute("data-state");
    side.setAttribute("data-state", s === "peek" ? "half" : s === "half" ? "full" : "peek");
  });
  // Phone: drag either sheet up or down by its top (handle and heading), or from the body when it's scrolled to the top.
  // On release it settles at the nearest height: peek, half or full.
  function draggable(sheet, body, states) {
    var startY = 0, startH = 0, dragging = false, moved = false, fromBody = false;
    function avail() { return sheet.parentNode.getBoundingClientRect().height; }
    function onStart(e) {
      if (!phone() || e.touches.length !== 1) return;
      var t = e.target;
      var inHead = !!t.closest(".sheet-handle, .view-head, .report-head, .eyebrow, h2.title");
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      fromBody = !inHead;
      if (fromBody && body.scrollTop > 0) return;
      startY = e.touches[0].clientY; startH = sheet.getBoundingClientRect().height; dragging = true; moved = false;
    }
    function onMove(e) {
      if (!dragging) return;
      var dy = e.touches[0].clientY - startY;
      // From the body, only a downward pull at the top moves the sheet; upward is normal scrolling
      if (fromBody && (dy < 0 || body.scrollTop > 0)) { if (!moved) dragging = false; return; }
      if (!moved && Math.abs(dy) < 8) return;
      moved = true;
      e.preventDefault();
      sheet.style.transition = "none";
      sheet.style.height = Math.max(70, Math.min(avail() - 60, startH - dy)) + "px";
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = "";
      if (!moved) return;
      var frac = sheet.getBoundingClientRect().height / avail();
      sheet.style.height = "";
      var pick = frac < 0.28 ? states[0] : frac < 0.68 ? states[1] : states[2];
      if (pick === "close") { if (sheet.id === "identify") T.parcel.close(); return; }
      sheet.setAttribute("data-state", pick);
    }
    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd);
    sheet.addEventListener("touchcancel", onEnd);
  }
  draggable(side, sideBody, ["peek", "half", "full"]);
  draggable(u.$("identify"), u.$("identify-body"), ["close", "half", "full"]);

  // Laptop: the panel can fold away to give the map the whole width
  function setCollapsed(on) {
    side.classList.toggle("collapsed", on);
    app.classList.toggle("side-collapsed", on);
    u.$("side-collapse").setAttribute("aria-label", on ? "Show panel" : "Hide panel");
    u.store("sideCollapsed", on);
    setTimeout(function () { M.map.invalidateSize(); }, 240);
  }
  u.$("side-collapse").addEventListener("click", function () { setCollapsed(!side.classList.contains("collapsed")); });
  if (u.store("sideCollapsed") && !phone()) setCollapsed(true);

  // Map tools
  u.$("btn-layers").addEventListener("click", function () {
    if (T.view === "map" && !phone() && !side.classList.contains("collapsed")) { setCollapsed(true); return; }
    T.show("map");
    if (phone()) side.setAttribute("data-state", "half");
  });
  u.$("btn-measure").addEventListener("click", function () { if (M.measuring()) M.stopMeasure(); else M.startMeasure(); });
  T.on("measure", function (on) { u.$("btn-measure").setAttribute("aria-pressed", on ? "true" : "false"); });
  u.$("btn-settings").addEventListener("click", function () { T.show("settings"); });
  u.$("btn-locate").addEventListener("click", function () {
    if (!navigator.geolocation) { u.toast("Location isn't available on this device."); return; }
    navigator.geolocation.getCurrentPosition(function (p) { M.map.setView([p.coords.latitude, p.coords.longitude], 17); },
      function () { u.toast("Couldn't get your location. Check location permission for this app."); }, { enableHighAccuracy: true, timeout: 10000 });
  });

  // A parcel report on a phone hides the panel underneath so the two sheets don't stack
  T.on("parcel", function (p) { app.classList.toggle("identify-open", !!p); });

  var resizeT;
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(function () { M.map.invalidateSize(); }, 150); });

  // ---------------------------------------------------------------- start
  var hash = location.hash;
  var tab = (hash.match(/^#(map|sites|network|activity|saved|settings)$/) || [])[1];
  T.show(tab || (u.store("view") && u.store("view") !== "settings" ? u.store("view") : "map"));
  if (phone() && !tab) side.setAttribute("data-state", "peek");
  var mh = hash.match(/#p=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (mh) { var lat0 = +mh[1], lng0 = +mh[2]; M.map.setView([lat0, lng0], 17); T.parcel.select(lng0, lat0, { fit: true }); }
})();
