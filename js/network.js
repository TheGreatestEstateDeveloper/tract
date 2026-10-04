/*
 * Tract network: the companies and counties you work with, and the people you know in each.
 * People live only in this browser (localStorage), imported from a private file the owner keeps.
 * Nothing here is ever sent anywhere or committed to the public repo.
 */
(function () {
  "use strict";
  var T = window.Tract, u = T.u, REG = T.REG, FIRMS = T.FIRMS, h = u.h;
  var M = T.map;

  // ---------------------------------------------------------------- firm locations (city level, public)
  // Headquarters when in or near Virginia, otherwise the Virginia division office named in the firm profile.
  var FIRM_LL = {
    nvr: [38.9586, -77.357, "Headquarters, Reston"], stanleymartin: [38.9586, -77.357, "Headquarters, Reston"], bowman: [38.9586, -77.357, "Headquarters, Reston"],
    vanmetre: [38.8462, -77.3064, "Headquarters, Fairfax"], peterson: [38.8462, -77.3064, "Headquarters, Fairfax"],
    christopher: [38.8809, -77.3008, "Headquarters, Oakton"], millersmith: [38.9339, -77.1773, "Headquarters, McLean"], elmstreet: [38.9339, -77.1773, "Headquarters, McLean"],
    hhhunt: [37.666, -77.5064, "Headquarters, Glen Allen (Henrico)"], stylecraft: [37.6085, -77.4766, "Headquarters, Lakeside (Henrico)"],
    chesapeakehomes: [36.8529, -75.978, "Headquarters, Virginia Beach"], atlantic: [38.3032, -77.4605, "Headquarters, Fredericksburg area"],
    stateson: [37.2296, -80.4139, "Headquarters, Blacksburg area"], mainstreet: [37.506, -77.6497, "Headquarters, Midlothian"],
    hazel: [38.8943, -77.4311, "Headquarters, Chantilly"], faulconer: [38.0251, -77.9969, "Louisa County"], rinker: [38.7509, -77.4753, "Headquarters, Manassas"],
    khov: [38.9696, -77.3861, "Virginia division, Herndon"], drhorton: [38.9187, -77.2311, "Northern Virginia division, Tysons"],
    buchanan: [38.9807, -77.1003, "Headquarters, Bethesda MD"]
  };
  var TYPE_LABEL = { public: "Public builder", regional: "Regional builder", developer: "Land developer", contractor: "Contractor or engineer", other: "Company" };
  var ROLES = ["Board of Supervisors", "Planning Commission", "County staff", "Elected official", "Landowner", "Land broker", "Land acquisition", "Division president", "Attorney", "Engineer", "Lender", "Investor", "Builder", "Developer", "Consultant"];
  var STRENGTH = ["Close", "Warm", "Acquaintance", "Not met yet"];

  // ---------------------------------------------------------------- storage
  function rid() { return Math.random().toString(36).slice(2, 10); }
  function loadPeople() {
    var list = u.store("contacts") || [];
    var changed = false;
    list.forEach(function (c) {
      // Older Tract contacts files used firm / met; keep them working
      if (!c.id) { c.id = rid(); changed = true; }
      if (c.company == null && c.firm != null) { c.company = c.firm; changed = true; }
      if (!c.counties) { c.counties = c.county ? [].concat(c.county) : []; changed = true; }
      if (!c.interactions) { c.interactions = []; changed = true; }
      if (c.relationship == null && c.met) { c.relationship = c.met; changed = true; }
    });
    if (changed) u.store("contacts", list);
    return list;
  }
  var people = loadPeople();
  var customCompanies = u.store("companies") || []; // { id, name, type, hq, ll:[lat,lng], website, notes, aliases }
  function savePeople() { u.store("contacts", people); companiesCache = null; T.emit("network", null); }
  function saveCompanies() { u.store("companies", customCompanies); companiesCache = null; T.emit("network", null); }

  // ---------------------------------------------------------------- counties
  function countyList() {
    var locs = M.localities();
    if (locs) return locs.features.map(function (f) { return { fips: f.properties.fips, name: f.properties.name, short: f.properties.short, lp: f.properties.lp }; });
    return REG.order.map(function (f) { return { fips: f, name: REG.byFips[f].name, short: REG.byFips[f].name }; });
  }
  function countyName(fips) { var c = countyList().filter(function (x) { return x.fips === fips; })[0]; return c ? c.name : (REG.byFips[fips] && REG.byFips[fips].name) || fips; }
  // Accept "Prince William", "Prince William County", "PWC" style text or a FIPS code
  function toFips(text) {
    var t = String(text || "").trim();
    if (/^51\d{3}$/.test(t)) return t;
    var n = u.norm(t).replace(/\b(county|co)\b/g, "").trim();
    if (!n) return null;
    var list = countyList();
    var exact = list.filter(function (c) { return u.norm(c.name) === u.norm(t) || u.norm(c.short) === n; });
    var city = /\bcity\b/i.test(t);
    if (exact.length > 1) exact = exact.filter(function (c) { return city ? /city/i.test(c.name) : !/city/i.test(c.name); });
    if (exact.length) return exact[0].fips;
    var starts = list.filter(function (c) { return u.norm(c.short).indexOf(n) === 0; });
    return starts.length === 1 ? starts[0].fips : null;
  }

  // ---------------------------------------------------------------- companies
  var companiesCache = null;
  function shortName(n) { return String(n).split(" (")[0]; }
  function matchesCompany(personCompany, c) {
    var name = u.norm(personCompany);
    if (!name) return false;
    return [c.name, c.short].concat(c.aliases || []).some(function (a) {
      a = u.norm(a);
      return a && (name === a || (a.length > 3 && (name.indexOf(a) === 0 || a.indexOf(name) === 0)));
    });
  }
  function companies() {
    if (companiesCache) return companiesCache;
    var list = FIRMS.firms.map(function (f) {
      var ll = FIRM_LL[f.key];
      return { id: "firm:" + f.key, firmKey: f.key, name: f.name, short: shortName(f.name), type: f.type, aliases: f.aliases || [], hq: f.hq, website: f.website,
        ll: ll ? [ll[0], ll[1]] : null, llNote: ll ? ll[2] : null, firm: f };
    });
    customCompanies.forEach(function (c) {
      var hit = list.filter(function (x) { return matchesCompany(c.name, x); })[0];
      if (hit) { if (c.ll) { hit.ll = c.ll; hit.llNote = c.hq || "Location you set"; } return; }
      list.push(Object.assign({ short: shortName(c.name), type: c.type || "other", aliases: c.aliases || [] }, c));
    });
    // Companies that only appear on people
    people.forEach(function (p) {
      if (!p.company || p.firmKey) return;
      if (list.some(function (x) { return matchesCompany(p.company, x); })) return;
      list.push({ id: "co:" + u.norm(p.company).replace(/ /g, "-"), name: p.company, short: p.company, type: "other", aliases: [], derived: true });
    });
    list.forEach(function (c) {
      c.people = people.filter(function (p) { return (p.firmKey && c.firmKey === p.firmKey) || matchesCompany(p.company, c); });
      c.last = lastTouch(c.people);
    });
    companiesCache = list;
    return list;
  }
  function companyById(id) { return companies().filter(function (c) { return c.id === id; })[0]; }
  function companyOf(p) { return companies().filter(function (c) { return c.people.indexOf(p) >= 0; })[0]; }
  function peopleIn(fips) { return people.filter(function (p) { return (p.counties || []).indexOf(fips) >= 0; }); }
  function lastInteraction(p) {
    var l = (p.interactions || []).slice().sort(function (a, b) { return (u.toDate(b.date) || 0) - (u.toDate(a.date) || 0); })[0];
    return l || null;
  }
  function lastTouch(list) {
    var best = null;
    list.forEach(function (p) { var l = lastInteraction(p); if (l && (!best || (u.toDate(l.date) || 0) > (u.toDate(best.date) || 0))) best = l; });
    return best;
  }

  // Match free text (case names, applicants, owners) to a known firm. Word-boundary patterns only, to avoid false hits.
  var firmPatterns = null;
  function firmForText(text) {
    if (!text) return null;
    if (!firmPatterns) {
      firmPatterns = [];
      FIRMS.firms.forEach(function (f) {
        var pats = [].concat(f.casePatterns || [], f.ownerPatterns || [], (f.aliases || []).filter(function (a) { return a.length > 4; }));
        pats.forEach(function (p) {
          var esc = String(p).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
          firmPatterns.push({ re: new RegExp("(^|[^A-Z0-9])" + esc + "([^A-Z0-9]|$)"), firm: f });
        });
      });
    }
    var t = String(text).toUpperCase();
    for (var i = 0; i < firmPatterns.length; i++) if (firmPatterns[i].re.test(t)) return { key: firmPatterns[i].firm.key, name: firmPatterns[i].firm.name, short: shortName(firmPatterns[i].firm.name) };
    return null;
  }
  T.firmForText = firmForText;

  // ---------------------------------------------------------------- view state
  var el = null;
  var state = { mode: u.store("netMode") || "companies", display: u.store("netDisplay") || "map", q: "", typeFilter: "all", page: null };
  var layer = L.layerGroup();
  var countyLayer = null;

  function setState(k, v) { state[k] = v; if (k === "mode") u.store("netMode", v); if (k === "display") u.store("netDisplay", v); render(); }

  function render() {
    if (!el) return;
    if (state.page) return renderPage();
    u.clear(el);
    var search = h("input", { type: "search", class: "list-search", placeholder: state.mode === "companies" ? "Search companies and people" : "Search counties and people", value: state.q, "aria-label": "Search the network" });
    search.addEventListener("input", function () { state.q = search.value; renderList(listBox); });
    el.append(h("div", { class: "view-head" },
      h("div", { class: "eyebrow" }, "Your network · " + people.length + " " + (people.length === 1 ? "person" : "people")),
      h("div", { class: "head-row" }, h("h2", { class: "title" }, "Network"),
        h("button", { type: "button", class: "btn small primary", onclick: function () { editPerson(null, {}); } }, u.icon("plus"), "Add person")),
      h("div", { class: "toolbar" },
        u.segmented([["companies", "Companies"], ["counties", "Counties"]], state.mode, function (v) { setState("mode", v); }, "Group by"),
        u.segmented([["map", "Map"], ["list", "List"]], state.display, function (v) { setState("display", v); }, "Display")),
      search));
    if (state.mode === "companies") {
      var types = [["all", "All"], ["mine", "People I know"], ["builder", "Builders"], ["developer", "Developers"], ["contractor", "Engineers and contractors"], ["other", "Other"]];
      el.append(h("div", { class: "chips" }, types.map(function (t) {
        return h("button", { type: "button", class: "chip", "aria-pressed": state.typeFilter === t[0] ? "true" : "false", onclick: function () { state.typeFilter = t[0]; render(); } }, t[1]);
      })));
    }
    var listBox = h("div", { class: "list" });
    el.append(listBox);
    renderList(listBox);
    if (!people.length) el.append(h("div", { class: "callout plain" }, "No people yet. Add someone, or import your contacts file under Settings."));
    drawMap();
  }

  function filteredCompanies() {
    var n = u.norm(state.q);
    return companies().filter(function (c) {
      if (state.typeFilter === "mine" && !c.people.length) return false;
      if (state.typeFilter === "builder" && c.type !== "public" && c.type !== "regional") return false;
      if (state.typeFilter === "developer" && c.type !== "developer") return false;
      if (state.typeFilter === "contractor" && c.type !== "contractor") return false;
      if (state.typeFilter === "other" && c.type !== "other") return false;
      if (!n) return true;
      return u.norm([c.name].concat(c.aliases || [], c.people.map(function (p) { return p.name; })).join(" ")).indexOf(n) >= 0;
    }).sort(function (a, b) { return (b.people.length > 0) - (a.people.length > 0) || a.short.localeCompare(b.short); });
  }
  function filteredCounties() {
    var n = u.norm(state.q);
    return countyList().map(function (c) { return Object.assign({}, c, { people: peopleIn(c.fips) }); }).filter(function (c) {
      if (!n) return true;
      return u.norm([c.name].concat(c.people.map(function (p) { return p.name + " " + (p.role || ""); })).join(" ")).indexOf(n) >= 0;
    }).sort(function (a, b) { return (b.people.length > 0) - (a.people.length > 0) || b.people.length - a.people.length || a.name.localeCompare(b.name); });
  }

  function renderList(box) {
    u.clear(box);
    if (state.mode === "companies") {
      var cs = filteredCompanies();
      if (!cs.length) box.append(h("div", { class: "empty" }, "No companies match."));
      cs.slice(0, 200).forEach(function (c) {
        var last = c.last;
        box.append(h("button", { type: "button", class: "item", onclick: function () { openCompany(c.id); } },
          h("div", { class: "t" }, c.short, c.people.length ? h("span", { class: "pill brass" }, c.people.length + (c.people.length === 1 ? " person" : " people")) : null),
          h("div", { class: "d" }, [TYPE_LABEL[c.type] || "Company", c.hq].filter(Boolean).join(" · ")),
          last ? h("div", { class: "m" }, "Last: " + [u.dateFmt(last.date), last.what].filter(Boolean).join(" · ")) : null));
      });
    } else {
      var ct = filteredCounties();
      ct.slice(0, 140).forEach(function (c) {
        var loc = REG.byFips[c.fips], last = lastTouch(c.people);
        box.append(h("button", { type: "button", class: "item", onclick: function () { openCounty(c.fips); } },
          h("div", { class: "t" }, c.name, c.people.length ? h("span", { class: "pill brass" }, c.people.length + (c.people.length === 1 ? " person" : " people")) : null,
            loc ? h("span", { class: "pill gray" }, loc.depth === "deep" ? "Full data" : loc.depth === "partial" ? "Partial data" : "Plan only") : null),
          c.people.length ? h("div", { class: "d" }, c.people.slice(0, 3).map(function (p) { return p.name + (p.role ? " (" + p.role + ")" : ""); }).join(", ") + (c.people.length > 3 ? " and " + (c.people.length - 3) + " more" : "")) : null,
          last ? h("div", { class: "m" }, "Last: " + [u.dateFmt(last.date), last.what].filter(Boolean).join(" · ")) : null));
      });
    }
  }

  // ---------------------------------------------------------------- map for the network
  function drawMap() {
    layer.clearLayers();
    if (countyLayer) { M.map.removeLayer(countyLayer); countyLayer = null; }
    if (!active) return;
    if (state.display !== "map" && !state.page) return;
    if (state.mode === "counties" || (state.page && state.page.type === "county")) {
      var locs = M.localities();
      if (!locs) { M.boundariesReady.then(drawMap); return; }
      var max = 1;
      var counts = {};
      people.forEach(function (p) { (p.counties || []).forEach(function (f) { counts[f] = (counts[f] || 0) + 1; if (counts[f] > max) max = counts[f]; }); });
      var focus = state.page && state.page.type === "county" ? state.page.id : null;
      countyLayer = L.geoJSON(locs, {
        renderer: L.svg({ pane: "overlayPane" }), bubblingMouseEvents: false,
        style: function (f) {
          var n = counts[f.properties.fips] || 0;
          return { className: "net-county" + (n ? " has" : "") + (focus === f.properties.fips ? " focus" : ""), weight: focus === f.properties.fips ? 3 : 1, fillOpacity: n ? 0.18 + 0.5 * (n / max) : 0.04 };
        },
        onEachFeature: function (f, l) {
          var n = counts[f.properties.fips] || 0;
          l.bindTooltip(f.properties.name + (n ? " · " + n + (n === 1 ? " person" : " people") : ""), { sticky: true, direction: "top" });
          l.on("click", function () { openCounty(f.properties.fips); });
        }
      }).addTo(M.map);
      if (!state.page && M.map.getZoom() > 9) M.map.flyTo([37.95, -78.75], 7);
    } else {
      var list = state.page && state.page.type === "company" ? [companyById(state.page.id)] : filteredCompanies();
      var brass = M.cssVar("--brass"), navy = M.cssVar("--navy-pin");
      list.forEach(function (c) {
        if (!c || !c.ll) return;
        M.dot(c.ll[0], c.ll[1], { layer: layer, color: c.people.length ? brass : navy, cls: "company", title: c.short,
          tip: c.short + (c.llNote ? " · " + c.llNote : "") + (c.people.length ? " · " + c.people.length + " you know" : ""), onClick: function () { openCompany(c.id); } });
      });
      if (!state.page) M.fitLayer(layer, 9);
      else if (layer.getLayers().length) M.map.setView(layer.getLayers()[0].getLatLng(), Math.max(M.map.getZoom(), 10));
    }
  }

  // ---------------------------------------------------------------- pages
  function back() { state.page = null; render(); }
  function pageHead(eyebrow, title, extra) {
    return h("div", { class: "view-head" },
      h("button", { type: "button", class: "btn small ghost", onclick: back }, u.icon("chevronLeft"), "Network"),
      h("div", { class: "eyebrow" }, eyebrow), h("h2", { class: "title" }, title), extra || null);
  }
  function openCompany(id) { state.page = { type: "company", id: id }; render(); }
  function openCounty(fips) { state.page = { type: "county", id: fips }; render(); }
  function openPerson(id) { state.page = { type: "person", id: id }; render(); }

  function renderPage() {
    u.clear(el);
    el.parentNode && (el.parentNode.scrollTop = 0);
    var pg = state.page;
    if (pg.type === "company") renderCompany(companyById(pg.id));
    else if (pg.type === "county") renderCounty(pg.id);
    else if (pg.type === "person") renderPerson(people.filter(function (p) { return p.id === pg.id; })[0]);
    drawMap();
  }

  function personCard(p, opts) {
    opts = opts || {};
    var last = lastInteraction(p);
    var co = opts.hideCompany ? null : p.company;
    return h("div", { class: "person" },
      h("button", { type: "button", class: "person-main", onclick: function () { openPerson(p.id); } },
        h("span", { class: "avatar" }, u.initials(p.name)),
        h("span", { class: "person-text" },
          h("span", { class: "t" }, p.name, p.strength ? h("span", { class: "pill " + (p.strength === "Close" ? "brass" : "gray") }, p.strength) : null),
          h("span", { class: "d" }, [p.role || p.title, co, opts.hideCounty ? null : (p.counties || []).map(countyName).join(", ")].filter(Boolean).join(" · ")),
          p.relationship ? h("span", { class: "d" }, p.relationship) : null,
          last ? h("span", { class: "m" }, "Last: " + [u.dateFmt(last.date), last.what, last.where ? "at " + last.where : ""].filter(Boolean).join(" · ")) : null)),
      h("span", { class: "person-actions" },
        p.phone ? h("a", { class: "icon-btn", href: "tel:" + String(p.phone).replace(/[^\d+]/g, ""), "aria-label": "Call " + p.name, title: p.phone }, u.icon("phone")) : null,
        p.email ? h("a", { class: "icon-btn", href: "mailto:" + p.email, "aria-label": "Email " + p.name, title: p.email }, u.icon("mail")) : null));
  }

  function renderCompany(c) {
    if (!c) { back(); return; }
    var f = c.firm;
    el.append(pageHead(TYPE_LABEL[c.type] || "Company", c.name,
      u.kv([["Headquarters", c.hq], ["On the map", c.llNote || (c.ll ? "Location you set" : null)], ["Virginia offices", f && f.vaOffices], ["Ticker", f && f.ticker, true],
        ["Website", c.website ? h("a", { href: c.website, target: "_blank", rel: "noopener" }, c.website.replace(/^https?:\/\//, "")) : null]])));
    var mine = h("section", { class: "block" }, h("h3", { class: "sec" }, "People you know here"));
    if (c.people.length) { var pl = h("div", { class: "people" }); c.people.forEach(function (p) { pl.append(personCard(p, { hideCompany: true })); }); mine.append(pl); }
    else mine.append(h("div", { class: "empty" }, "Nobody yet."));
    mine.append(h("div", { class: "btn-row" },
      h("button", { type: "button", class: "btn small", onclick: function () { editPerson(null, { company: c.short }); } }, u.icon("plus"), "Add someone at " + c.short),
      !c.ll ? h("button", { type: "button", class: "btn small", onclick: function () { setCompanyLocation(c); } }, u.icon("pin"), "Set office location") : null));
    el.append(mine);

    if (T.activity && c.firmKey) {
      var act = h("section", { class: "block" }, h("h3", { class: "sec" }, "What they're doing (last 12 months)"), u.loading("Reading county records"));
      el.append(act);
      var firmKey = c.firmKey;
      T.activity.firmSummary(firmKey).then(function (s) {
        if (!state.page || state.page.id !== "firm:" + firmKey) return;
        while (act.childNodes.length > 1) act.removeChild(act.lastChild);
        act.append(h("div", { class: "stats" },
          u.stat(String(s.lots), "Lots and parcels bought"),
          u.stat(s.spent ? u.money(s.spent) : "–", "Spent on land (deeds split per lot)"),
          u.stat(String(s.open.length), "Open cases"),
          u.stat(String(s.filings.length), "Filings")));
        act.append(u.kv([
          ["Counties", s.counties.join(", ") || "None found"],
          ["Communities", s.communities.slice(0, 12).join(", ") || null]
        ]));
        var recent = s.open.concat(s.land).sort(function (a, b) { return b.date - a.date; }).slice(0, 6);
        if (recent.length) {
          var rl = h("div", { class: "list" });
          recent.forEach(function (it) {
            rl.append(h("div", { class: "item static" },
              h("div", { class: "t" }, h("span", { class: "pill " + (it.kind === "land" ? "brass" : "blue") }, it.kind === "land" ? (it.count > 1 ? "Lots" : "Land") : u.clean(it.m.number) || "Case"), it.title),
              h("div", { class: "m" }, [u.dateFmt(it.date), it.county, it.kind === "filing" ? u.clean(it.m.status) : ""].filter(Boolean).join(" · "))));
          });
          act.append(rl);
        }
        if (!s.lots && !s.filings.length) act.append(h("div", { class: "empty" }, "Nothing under their names in the last year. They may buy through project LLCs or file through engineers."));
      }).catch(function () { while (act.childNodes.length > 1) act.removeChild(act.lastChild); act.append(h("div", { class: "empty" }, "Couldn't read county records just now.")); });
      el.append(h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn primary small", onclick: function () { T.show("activity"); T.activity.openFirm(c.firmKey); } }, u.icon("activity"), "See it all on the map")));
    }

    if (f) {
      if (f.summary) el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "What they do in Virginia"), u.prose(f.summary)));
      if (f.strategy) el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Strategy and how they buy land"), u.prose(f.strategy)));
      if (f.numbers && f.numbers.length) el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Key numbers"), u.kv(f.numbers.map(function (x) { return [x[0], x[1]]; }))));
      if (f.people && f.people.length) {
        var lp = h("div", { class: "list" });
        f.people.forEach(function (p) { lp.append(h("div", { class: "item static" }, h("div", { class: "t" }, p.name), h("div", { class: "d" }, p.title))); });
        el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Leadership (public sources)"), lp));
      }
      if (f.projects && f.projects.length) {
        var prj = h("div", { class: "list" });
        f.projects.forEach(function (p) { prj.append(h("div", { class: "item static" }, h("div", { class: "t" }, p.name, p.status ? h("span", { class: "pill gray" }, p.status) : null), h("div", { class: "d" }, [p.locality, p.detail].filter(Boolean).join(" · ")))); });
        el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Virginia communities and pipeline"), prj));
      }
      if (f.sources && f.sources.length) {
        var ol = h("ol");
        f.sources.forEach(function (s) { ol.append(h("li", null, h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label))); });
        el.append(h("div", { class: "sources" }, h("strong", null, "Sources"), ol));
      }
    }
  }

  function renderCounty(fips) {
    var loc = REG.byFips[fips];
    var list = peopleIn(fips);
    el.append(pageHead("County network", countyName(fips)));
    var mine = h("section", { class: "block" }, h("h3", { class: "sec" }, "People you know in " + countyName(fips)));
    if (list.length) {
      // Group: officials and staff first, then everyone else by company
      var officials = list.filter(function (p) { return /board|supervisor|commission|council|staff|elected|official|mayor|delegate|senator/i.test(p.role || p.title || ""); });
      var others = list.filter(function (p) { return officials.indexOf(p) < 0; });
      if (officials.length) { mine.append(h("div", { class: "eyebrow" }, "Officials and county staff")); var a = h("div", { class: "people" }); officials.forEach(function (p) { a.append(personCard(p, { hideCounty: true })); }); mine.append(a); }
      if (others.length) { mine.append(h("div", { class: "eyebrow" }, officials.length ? "Everyone else" : "")); var b = h("div", { class: "people" }); others.forEach(function (p) { b.append(personCard(p, { hideCounty: true })); }); mine.append(b); }
    } else mine.append(h("div", { class: "empty" }, "Nobody yet in this county."));
    mine.append(h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small", onclick: function () { editPerson(null, { counties: [fips] }); } }, u.icon("plus"), "Add someone here")));
    el.append(mine);

    var data = h("section", { class: "block" }, h("h3", { class: "sec" }, "What Tract knows here"));
    if (loc) {
      var has = [];
      if (loc.parcel && loc.parcel.f.owner) has.push("owners");
      if (loc.parcel && (loc.parcel.f.total || loc.parcel.f.land) || loc.joins) has.push("values");
      if (loc.parcel && loc.parcel.f.salePrice || (loc.joins && loc.joins.some(function (j) { return j.f.salePrice; }))) has.push("sales");
      if (loc.zoning || (loc.parcel && loc.parcel.f.zoningCode)) has.push("zoning");
      if (loc.plan || (loc.parcel && loc.parcel.f.compPlan)) has.push("future land use");
      if (loc.cases) has.push("cases");
      data.append(h("p", { class: "sub" }, has.length ? "Parcels here show " + has.join(", ") + "." : "Parcel outlines only so far."));
      if (loc.notes) data.append(h("p", { class: "sub" }, loc.notes));
    } else data.append(h("p", { class: "sub" }, "Parcel outlines only so far. Owner, values and zoning for this locality haven't been connected yet."));
    data.append(h("div", { class: "btn-row" },
      T.activity && loc && (loc.cases || loc.ownerSearch) ? h("button", { type: "button", class: "btn small primary", onclick: function () { T.show("activity"); T.activity.openCounty(fips); } }, u.icon("activity"), "Recent activity here") : null,
      loc && loc.links && loc.links.planning ? u.extLink(loc.links.planning, "Planning department") : null,
      loc && loc.links && loc.links.gis ? u.extLink(loc.links.gis, "County GIS") : null));
    el.append(data);
  }

  function renderPerson(p) {
    if (!p) { back(); return; }
    var c = companyOf(p);
    el.append(pageHead([p.role, p.title].filter(Boolean).join(" · ") || "Person", p.name));
    el.append(h("div", { class: "btn-row" },
      p.phone ? h("a", { class: "btn primary small", href: "tel:" + String(p.phone).replace(/[^\d+]/g, "") }, u.icon("phone"), "Call") : null,
      p.email ? h("a", { class: "btn small", href: "mailto:" + p.email }, u.icon("mail"), "Email") : null,
      h("button", { type: "button", class: "btn small", onclick: function () { editPerson(p); } }, u.icon("edit"), "Edit")));
    el.append(u.kv([
      ["Company", c ? h("button", { type: "button", class: "linkish", onclick: function () { openCompany(c.id); } }, c.name) : p.company || null],
      ["Counties", (p.counties || []).length ? h("span", null, (p.counties || []).map(function (f, i) { return [i ? ", " : "", h("button", { type: "button", class: "linkish", onclick: function () { openCounty(f); } }, countyName(f))]; })) : null],
      ["Role", p.role || null], ["Title", p.title || null], ["Relationship", p.strength || null],
      ["Phone", p.phone || null, true], ["Email", p.email || null],
      ["How you know them", p.relationship || null], ["Tags", (p.tags || []).join(", ") || null]
    ]));
    if (p.notes) el.append(h("section", { class: "block" }, h("h3", { class: "sec" }, "Notes"), u.prose(p.notes)));

    var log = h("section", { class: "block" }, h("h3", { class: "sec" }, "What you've done together"));
    var when = h("input", { type: "date", value: new Date().toISOString().slice(0, 10), "aria-label": "Date" });
    var what = h("input", { type: "text", placeholder: "Talked about the Route 15 site", "aria-label": "What happened" });
    var where = h("input", { type: "text", placeholder: "2026 Oyster Roast", "aria-label": "Where" });
    log.append(h("div", { class: "form-row log-form" }, h("div", { class: "field" }, h("label", null, "Date"), when), h("div", { class: "field wide" }, h("label", null, "What happened"), what), h("div", { class: "field" }, h("label", null, "Where"), where)),
      h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn small primary", onclick: function () {
        if (!what.value.trim()) { u.toast("Add what happened first."); return; }
        p.interactions = p.interactions || [];
        p.interactions.push({ date: when.value, what: what.value.trim(), where: where.value.trim() });
        savePeople(); render(); u.toast("Logged");
      } }, "Log it")));
    var items = (p.interactions || []).slice().sort(function (a, b) { return (u.toDate(b.date) || 0) - (u.toDate(a.date) || 0); });
    if (items.length) {
      var tl = h("ol", { class: "timeline" });
      items.forEach(function (it) {
        tl.append(h("li", null, h("span", { class: "when" }, u.dateFmt(it.date) || ""), h("span", { class: "what" }, it.what), it.where ? h("span", { class: "where" }, it.where) : null,
          h("button", { type: "button", class: "icon-btn small", "aria-label": "Delete this entry", onclick: function () { p.interactions.splice(p.interactions.indexOf(it), 1); savePeople(); render(); } }, u.icon("x"))));
      });
      log.append(tl);
    } else log.append(h("div", { class: "empty" }, "Nothing logged yet."));
    el.append(log);
  }

  // ---------------------------------------------------------------- add / edit
  function editPerson(p, preset) {
    var isNew = !p;
    p = p || Object.assign({ id: rid(), name: "", company: "", counties: [], role: "", title: "", phone: "", email: "", relationship: "", strength: "", notes: "", tags: [], interactions: [] }, preset || {});
    var dl = h("datalist", { id: "dl-companies" }, companies().map(function (c) { return h("option", { value: c.short }); }));
    var dlr = h("datalist", { id: "dl-roles" }, ROLES.map(function (r) { return h("option", { value: r }); }));
    var dlc = h("datalist", { id: "dl-counties" }, countyList().map(function (c) { return h("option", { value: c.name }); }));
    function input(id, label, value, attrs) { var i = h("input", Object.assign({ id: id, type: "text", value: value || "" }, attrs || {})); return [h("div", { class: "field" }, h("label", { for: id }, label), i), i]; }
    var fName = input("p-name", "Name", p.name, { required: true, autocomplete: "off" });
    var fCompany = input("p-company", "Company", p.company, { list: "dl-companies", autocomplete: "off" });
    var fRole = input("p-role", "Role", p.role, { list: "dl-roles", placeholder: "Board of Supervisors" });
    var fTitle = input("p-title", "Title", p.title);
    var fPhone = input("p-phone", "Phone", p.phone, { type: "tel", inputmode: "tel" });
    var fEmail = input("p-email", "Email", p.email, { type: "email", inputmode: "email" });
    var chosen = (p.counties || []).slice();
    var chipBox = h("div", { class: "chips" });
    function drawChips() {
      u.clear(chipBox);
      chosen.forEach(function (f) { chipBox.append(h("button", { type: "button", class: "chip", "aria-pressed": "true", onclick: function () { chosen.splice(chosen.indexOf(f), 1); drawChips(); } }, countyName(f), " ×")); });
    }
    drawChips();
    var cInput = h("input", { id: "p-county", type: "text", list: "dl-counties", placeholder: "Type a county and press Enter", autocomplete: "off" });
    function addCounty() { var f = toFips(cInput.value); if (f && chosen.indexOf(f) < 0) { chosen.push(f); drawChips(); } else if (!f && cInput.value.trim()) u.toast("Pick a county from the list."); cInput.value = ""; }
    cInput.addEventListener("change", addCounty);
    cInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCounty(); } });
    var strength = h("select", { id: "p-strength" }, h("option", { value: "" }, "Not set"), STRENGTH.map(function (s) { return h("option", { value: s, selected: p.strength === s }, s); }));
    var rel = h("textarea", { id: "p-rel", placeholder: "Met at the Prince William Chamber breakfast through Sam; key voice on the Board for western county land use." }); rel.value = p.relationship || "";
    var notes = h("textarea", { id: "p-notes", placeholder: "Anything else worth remembering" }); notes.value = p.notes || "";
    var tags = input("p-tags", "Tags", (p.tags || []).join(", "), { placeholder: "politics, PWC, data centers" });

    u.clear(el);
    el.append(h("div", { class: "view-head" },
      h("button", { type: "button", class: "btn small ghost", onclick: function () { render(); } }, u.icon("chevronLeft"), "Cancel"),
      h("div", { class: "eyebrow" }, "Private to this device"), h("h2", { class: "title" }, isNew ? "Add a person" : "Edit " + p.name)),
      dl, dlr, dlc,
      h("div", { class: "form" }, fName[0], h("div", { class: "form-row" }, fCompany[0], fRole[0]), h("div", { class: "form-row" }, fTitle[0], h("div", { class: "field" }, h("label", { for: "p-strength" }, "Relationship"), strength)),
        h("div", { class: "field" }, h("label", { for: "p-county" }, "Counties"), chipBox, cInput),
        h("div", { class: "form-row" }, fPhone[0], fEmail[0]),
        h("div", { class: "field" }, h("label", { for: "p-rel" }, "How you know them"), rel),
        h("div", { class: "field" }, h("label", { for: "p-notes" }, "Notes"), notes), tags[0],
        h("div", { class: "btn-row" },
          h("button", { type: "button", class: "btn primary", onclick: function () {
            if (cInput.value.trim()) addCounty();
            if (!fName[1].value.trim()) { u.toast("Add a name first."); fName[1].focus(); return; }
            p.name = fName[1].value.trim(); p.company = fCompany[1].value.trim(); p.role = fRole[1].value.trim(); p.title = fTitle[1].value.trim();
            p.phone = fPhone[1].value.trim(); p.email = fEmail[1].value.trim(); p.relationship = rel.value.trim(); p.notes = notes.value.trim();
            p.strength = strength.value; p.counties = chosen; p.tags = tags[1].value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
            var hit = companies().filter(function (c) { return c.firmKey && matchesCompany(p.company, c); })[0];
            p.firmKey = hit ? hit.firmKey : "";
            if (isNew) people.push(p);
            savePeople();
            u.toast(isNew ? "Added" : "Saved");
            openPerson(p.id);
          } }, isNew ? "Add person" : "Save"),
          !isNew ? h("button", { type: "button", class: "btn danger", onclick: function () {
            if (!confirm("Remove " + p.name + " from this device?")) return;
            people.splice(people.indexOf(p), 1); savePeople(); state.page = null; render();
          } }, u.icon("trash"), "Remove") : null)));
    fName[1].focus();
  }

  async function setCompanyLocation(c) {
    var addr = prompt("Office address or town for " + c.short + " (for example: 4100 Monument Corner Dr, Fairfax VA)");
    if (!addr) return;
    try {
      var url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&countryCode=USA&SingleLine=" + encodeURIComponent(addr);
      var j = await (await fetch(url)).json();
      var cand = j.candidates && j.candidates[0];
      if (!cand || cand.score < 75) { u.toast("Couldn't find that address."); return; }
      var existing = customCompanies.filter(function (x) { return matchesCompany(x.name, c); })[0];
      if (existing) { existing.ll = [cand.location.y, cand.location.x]; existing.hq = cand.address; }
      else customCompanies.push({ id: "custom:" + rid(), name: c.name, type: c.type, ll: [cand.location.y, cand.location.x], hq: cand.address });
      saveCompanies();
      u.toast("Location saved");
      render();
    } catch (e) { u.toast("Address search isn't reachable right now."); }
  }

  // ---------------------------------------------------------------- import / export
  // Accepts { contacts: [...] } or a plain array. Fields: name (required), company or firm, title, role,
  // county / counties (names or FIPS), phone, email, relationship or met, strength, notes, tags, interactions [{date, what, where}].
  function importContacts(data) {
    var arr = Array.isArray(data) ? data : data && (data.contacts || data.people);
    if (!Array.isArray(arr)) throw new Error("Not a contacts file");
    var added = 0, updated = 0;
    arr.forEach(function (c) {
      if (!c || !c.name) return;
      var company = String(c.company || c.firm || "");
      var counties = [].concat(c.counties || c.county || []).map(toFips).filter(Boolean);
      var match = people.filter(function (p) { return u.norm(p.name) === u.norm(c.name) && (!company || !p.company || u.norm(p.company) === u.norm(company)); })[0];
      var rec = match || { id: rid(), interactions: [], counties: [], tags: [] };
      rec.name = String(c.name);
      if (company) rec.company = company;
      ["title", "role", "phone", "email", "strength", "notes"].forEach(function (k) { if (c[k]) rec[k] = String(c[k]); });
      if (c.relationship || c.met) rec.relationship = String(c.relationship || c.met);
      counties.forEach(function (f) { if (rec.counties.indexOf(f) < 0) rec.counties.push(f); });
      if (c.tags) [].concat(c.tags).forEach(function (t) { if (rec.tags.indexOf(t) < 0) rec.tags.push(String(t)); });
      (c.interactions || []).forEach(function (it) {
        if (!it || !it.what) return;
        var dup = rec.interactions.some(function (x) { return x.date === it.date && x.what === it.what; });
        if (!dup) rec.interactions.push({ date: it.date || "", what: String(it.what), where: it.where ? String(it.where) : "" });
      });
      var hit = FIRMS.firms.filter(function (f) { return matchesCompany(rec.company, { name: f.name, short: shortName(f.name), aliases: f.aliases }); })[0];
      rec.firmKey = hit ? hit.key : "";
      if (match) updated++; else { people.push(rec); added++; }
    });
    savePeople();
    return { added: added, updated: updated };
  }
  function exportContacts() {
    u.download("tract-contacts.json", JSON.stringify({ contacts: people, companies: customCompanies, exported: new Date().toISOString() }, null, 1), "application/json");
  }

  // ---------------------------------------------------------------- view registration
  var active = false;
  T.views = T.views || {};
  T.views.network = {
    title: "Network",
    render: function (container) { el = container; render(); },
    onShow: function () { active = true; layer.addTo(M.map); render(); },
    onHide: function () { active = false; M.map.removeLayer(layer); if (countyLayer) { M.map.removeLayer(countyLayer); countyLayer = null; } }
  };
  T.on("network", function () { if (active) render(); });

  T.network = {
    companies: companies,
    people: function () { return people; },
    peopleIn: peopleIn,
    openCompany: function (id) { openCompany(id); },
    openCounty: function (fips) { state.mode = "counties"; openCounty(fips); },
    openPerson: function (id) { openPerson(id); },
    importContacts: importContacts,
    exportContacts: exportContacts,
    countyName: countyName,
    toFips: toFips,
    companyForFirm: function (key) { return companyById("firm:" + key); }
  };
})();
