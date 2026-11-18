// APP UI. Data lives in data/*.js, scoring in core.js. This file only draws screens.
(function () {
  "use strict";
  var CFG = window.CONFIG, STR = window.STRINGS, DATA = window.CHECKLIST, Core = window.Core;
  var LANGS = [["lt", "LT"], ["en", "EN"]];
  var KEY = "carcheck_state_v1";
  var CATS = DATA.categories;
  var ICON = {
    ok: '<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    bad: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    na: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>'
  };

  // ---------- state ----------
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fresh() { return { id: uid(), lang: CFG.defaultLang, step: "info", info: { date: today() }, answers: {} }; }
  function load() {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load() || fresh();
  if (!state.id) state.id = uid();
  if (!state.info) state.info = {};
  if (!state.info.date) state.info.date = today();
  if (state.step !== "info" && state.step !== "result" && !CATS[state.step]) state.step = "info";

  var ui = {};

  // ---------- helpers ----------
  function t(k) { return (STR[state.lang] && STR[state.lang][k]) || STR.en[k] || k; }
  function L(o) { return o[state.lang] || o.en; }
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) for (var k in a) {
      var v = a[k];
      if (v === false || v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "value") e.value = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + CFG.currency; }
  function money(c) {
    var m = CFG.costMultiplier || 1;
    var a = Math.round(c[0] * m / 10) * 10, b = Math.round(c[1] * m / 10) * 10;
    return fmt(a) + " – " + fmt(b);
  }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function $(sel) { return document.querySelector(sel); }
  function toast(msg) {
    var e = h("div", { class: "toast" }, [msg]);
    document.body.appendChild(e);
    setTimeout(function () { e.remove(); }, 1900);
  }
  function closeOverlay() {
    var o = document.querySelectorAll(".ov");
    if (!o.length) return false;
    o.forEach(function (x) { x.remove(); });
    return true;
  }

  // ---------- navigation ----------
  function go(step) { state.step = step; closeOverlay(); render(); }
  function catAnswered(i) { return CATS[i].items.filter(function (it) { return state.answers[it.id]; }).length; }
  function isComplete(i) { return typeof i === "number" && catAnswered(i) === CATS[i].items.length; }
  function firstIncomplete() {
    for (var i = 0; i < CATS.length; i++) if (!isComplete(i)) return i;
    return -1;
  }
  function goNext() {
    var s = state.step;
    if (typeof s !== "number") return;
    go(s === CATS.length - 1 ? "result" : s + 1);
  }
  function goPrev() {
    var s = state.step;
    if (s === "result") go(CATS.length - 1);
    else if (s === 0) go("info");
    else if (typeof s === "number") go(s - 1);
  }
  window.appBack = function () {
    if (closeOverlay()) return true;
    if (state.step === "info") return false;
    goPrev();
    return true;
  };

  // ---------- chrome ----------
  function topbar() {
    var lang = h("div", { class: "lang" }, LANGS.map(function (l) {
      return h("button", {
        class: state.lang === l[0] ? "on" : "",
        onclick: function () { state.lang = l[0]; save(); render(); }
      }, [l[1]]);
    }));
    var burger = h("button", {
      class: "burger", "aria-label": t("saved"), onclick: openHistory,
      html: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
    });
    return h("div", { class: "topbar" }, [h("div", { class: "tl" }, [burger, h("div", { class: "brand" }, [h("i"), "CarCheck"])]), lang]);
  }
  function progress() {
    var wrap = h("div", { class: "prog" });
    CATS.forEach(function (c, i) {
      var f = catAnswered(i) / c.items.length;
      var cls = (state.step === i ? "cur " : "") + (f >= 1 ? "done" : "");
      wrap.appendChild(h("button", { class: cls, "aria-label": L(c), onclick: function () { go(i); } },
        [h("span", { style: "--f:" + f })]));
    });
    return wrap;
  }
  // ---------- saved reports (history) ----------
  var HKEY = "carcheck_history_v1";
  function loadHist() { try { var s = localStorage.getItem(HKEY); return s ? JSON.parse(s) : []; } catch (e) { return []; } }
  function saveHist(l) { try { localStorage.setItem(HKEY, JSON.stringify(l)); } catch (e) {} }
  function upsertHist(r) {
    var l = loadHist();
    var rec = { id: state.id, saved: Date.now(), info: state.info, answers: state.answers, quality: r.quality, score: r.score, color: r.band.color };
    var found = false;
    for (var i = 0; i < l.length; i++) if (l[i].id === rec.id) { l[i] = rec; found = true; }
    if (!found) l.unshift(rec);
    saveHist(l.slice(0, 100));
  }
  function openHistory() {
    closeOverlay();
    var sheet = h("div", { class: "sheet" }, [h("h2", null, [t("saved")])]);
    var l = loadHist().sort(function (a, b) { return b.saved - a.saved; });
    if (!l.length) sheet.appendChild(h("div", { class: "hempty" }, [t("no_saved")]));
    l.forEach(function (rec) {
      var inf = rec.info || {};
      var main = h("button", { class: "hmain", onclick: function () {
        state = { id: rec.id, lang: state.lang, step: "result", info: JSON.parse(JSON.stringify(inf)), answers: JSON.parse(JSON.stringify(rec.answers || {})) };
        save(); closeOverlay(); render();
      } }, [
        h("div", { class: "hn" }, [h("b", null, [inf.model || "—"]), h("span", null, [[inf.plate, inf.date].filter(Boolean).join(" · ")])]),
        h("div", { class: "hp", style: "color:" + rec.color }, [String(rec.quality), h("small", null, ["%"])])
      ]);
      var del = h("button", { class: "hdel", "aria-label": t("del"), onclick: function () {
        saveHist(loadHist().filter(function (x) { return x.id !== rec.id; }));
        openHistory();
      }, html: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>' });
      sheet.appendChild(h("div", { class: "hrow" }, [main, del]));
    });
    var ov = h("div", { class: "ov", onclick: function (e) { if (e.target === ov) ov.remove(); } }, [sheet]);
    document.body.appendChild(ov);
  }

  function openCategories() {
    var sheet = h("div", { class: "sheet" }, [h("h2", null, [t("categories")])]);
    CATS.forEach(function (c, i) {
      var a = catAnswered(i), n = c.items.length;
      sheet.appendChild(h("button", {
        class: "catrow" + (a === n ? " done" : "") + (state.step === i ? " cur" : ""),
        onclick: function () { go(i); }
      }, [h("span", { class: "n" }, [("0" + (i + 1)).slice(-2)]), h("span", { class: "nm" }, [L(c)]),
        h("span", { class: "st" }, [a === n ? "✓" : a + "/" + n])]));
    });
    var ov = h("div", { class: "ov", onclick: function (e) { if (e.target === ov) ov.remove(); } }, [sheet]);
    document.body.appendChild(ov);
  }
  function confirmDialog(msg, onYes) {
    var ov = h("div", { class: "ov center", onclick: function (e) { if (e.target === ov) ov.remove(); } }, [
      h("div", { class: "dlg" }, [
        h("p", null, [msg]),
        h("div", { class: "two" }, [
          h("button", { class: "btn ghost", onclick: function () { ov.remove(); } }, [t("cancel")]),
          h("button", { class: "btn red", onclick: function () { ov.remove(); onYes(); } }, [t("yes")])
        ])
      ])
    ]);
    document.body.appendChild(ov);
  }
  function newInspection() {
    confirmDialog(t("confirm_new"), function () { state = fresh(); save(); render(); });
  }

  // ---------- screens ----------
  function render() {
    var app = $("#app");
    app.innerHTML = "";
    document.documentElement.lang = state.lang;
    app.appendChild(topbar());
    if (state.step !== "info") { ui.prog = progress(); app.appendChild(ui.prog); }
    if (state.step === "info") infoView(app);
    else if (state.step === "result") resultView(app);
    else catView(app, state.step);
    window.scrollTo(0, 0);
    save();
  }

  function field(key, label, o) {
    o = o || {};
    var input = h("input", {
      type: o.type || "text", value: state.info[key] || "", placeholder: o.ph || "",
      inputmode: o.mode, maxlength: o.max, autocomplete: "off", autocapitalize: o.caps ? "characters" : "off",
      oninput: function (e) {
        var v = e.target.value;
        if (o.clean) { var c = o.clean(v); if (c !== v) { e.target.value = c; v = c; } }
        state.info[key] = v; save();
        wrap.classList.remove("err");
        if (o.counter) cnt.textContent = v.length + "/" + o.max;
      }
    });
    var cnt = h("em", null, [o.counter ? (state.info[key] || "").length + "/" + o.max : ""]);
    var wrap = h("div", { class: "field", "data-k": key }, [
      h("label", null, [h("span", null, [label]), o.counter ? cnt : o.opt ? null : h("em", null, ["*"])]),
      input,
      h("div", { class: "msg" }, [t("required")])
    ]);
    if (o.hint) wrap.appendChild(h("div", { class: "hint" }, [o.hint]));
    return wrap;
  }

  function infoView(app) {
    var up = function (v) { return v.toUpperCase().replace(/[^A-Z0-9]/g, ""); };
    var plateUp = function (v) { return v.toUpperCase().replace(/[^A-Z0-9 -]/g, ""); };
    var nextYear = new Date().getFullYear() + 1;
    var has = Object.keys(state.answers).length > 0;
    var main = h("main", null, [
      h("div", { class: "eyebrow" }, [t("tagline")]),
      h("h1", null, [t("info_title")]),
      h("div", { class: "redline" }),
      h("p", { class: "sub" }, [t("info_sub")]),
      field("vin", t("vin"), { clean: up, max: 17, counter: true, caps: true, hint: t("vin_hint") }),
      field("plate", t("plate"), { clean: plateUp, caps: true, max: 12 }),
      field("date", t("date"), { type: "date" }),
      field("model", t("model"), { ph: t("model_ph") }),
      field("engine", t("engine"), { ph: t("engine_ph") }),
      h("div", { class: "row2" }, [
        field("year", t("year"), { type: "number", mode: "numeric", clean: function (v) { return v.replace(/\D/g, "").slice(0, 4); } }),
        field("mileage", t("mileage"), { type: "number", mode: "numeric", opt: true })
      ]),
      field("price", t("price"), { type: "number", mode: "numeric", opt: true }),
      h("button", { class: "btn red", onclick: start }, [has ? t("cont") : t("start")]),
      has ? h("button", { class: "btn ghost", onclick: newInspection }, [t("new_check")]) : null
    ]);
    app.appendChild(main);

    function start() {
      var bad = [];
      ["vin", "plate", "date", "model", "engine", "year"].forEach(function (k) {
        var v = String(state.info[k] || "").trim();
        var ok = v.length > 0;
        if (k === "year") ok = +v >= 1950 && +v <= nextYear;
        if (k === "vin") ok = v.length >= 5;
        var el = main.querySelector('[data-k="' + k + '"]');
        el.classList.toggle("err", !ok);
        if (!ok) bad.push(el);
      });
      if (bad.length) { bad[0].scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      var fi = firstIncomplete();
      go(fi === -1 ? "result" : fi);
    }
  }

  function catView(app, i) {
    var cat = CATS[i];
    var n = cat.items.length;
    var count = h("span", { class: "count" });
    var main = h("main", null, [
      h("div", { class: "cathead" }, [
        h("button", { class: "idx", onclick: openCategories }, [
          ("0" + (i + 1)).slice(-2) + " " + t("of") + " " + ("0" + CATS.length).slice(-2) + " ", h("u", null, ["▾"])
        ]),
        count
      ]),
      h("h1", null, [L(cat)]),
      h("div", { class: "redline" }),
      h("div", { class: "legend" }, [
        h("span", { class: "lo" }, ["✓ " + t("legend_ok")]),
        h("span", { class: "lb" }, ["✗ " + t("legend_bad")]),
        h("span", null, ["– " + t("legend_na")])
      ])
    ]);
    var list = h("div", { class: "card" });
    cat.items.forEach(function (it) { list.appendChild(itemRow(it, i)); });
    main.appendChild(list);
    app.appendChild(main);

    var left = h("div", { class: "left" });
    var nextBtn = h("button", { class: "btn red", onclick: goNext }, [i === CATS.length - 1 ? t("finish") : t("next")]);
    var foot = h("div", { class: "foot" }, [
      left,
      h("div", { class: "in" }, [h("button", { class: "btn ghost", onclick: goPrev }, [t("back")]), nextBtn])
    ]);
    app.appendChild(foot);
    ui.refresh = function () {
      var a = catAnswered(i);
      count.textContent = a + " / " + n;
      left.textContent = a < n ? t("left") + ": " + (n - a) : "";
      nextBtn.disabled = a < n;
      var np = progress();
      ui.prog.replaceWith(np);
      ui.prog = np;
    };
    ui.refresh();
  }

  function itemRow(it, ci) {
    var row = h("div", { class: "item" });
    var btns = {};
    function paint() {
      var a = state.answers[it.id] || "";
      row.className = "item " + a;
      ["ok", "bad", "na"].forEach(function (k) { btns[k].setAttribute("aria-pressed", a === k ? "true" : "false"); });
    }
    function press(k) {
      var wasComplete = isComplete(ci);
      if (state.answers[it.id] === k) delete state.answers[it.id]; else state.answers[it.id] = k;
      save(); paint(); ui.refresh();
      if (!wasComplete && isComplete(ci)) {
        setTimeout(function () { if (state.step === ci && isComplete(ci)) goNext(); }, 600);
      }
    }
    ["ok", "bad", "na"].forEach(function (k) {
      btns[k] = h("button", { class: "ab " + k, html: ICON[k], "aria-label": k, onclick: function () { press(k); } });
    });
    var txt = h("div", { class: "t" }, [L(it)]);
    if (it.crit) txt.appendChild(h("div", { class: "tag" }, [t("critical")]));
    row.appendChild(txt);
    row.appendChild(h("div", { class: "btns" }, [btns.ok, btns.bad, btns.na]));
    paint();
    return row;
  }

  function resultView(app) {
    var r = Core.calc(DATA, CFG, state.answers);
    upsertHist(r);
    var col = r.band.color;
    var info = state.info;
    var C = 2 * Math.PI * 104;
    var gauge = h("div", { class: "gauge" });
    gauge.innerHTML = '<svg viewBox="0 0 230 230"><circle class="bg" cx="115" cy="115" r="104"/>' +
      '<circle class="fg" cx="115" cy="115" r="104" stroke="' + col + '" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/></svg>';
    var fg = gauge.querySelector(".fg");
    gauge.appendChild(h("div", { class: "mid" }, [
      h("div", { class: "pct", style: "color:" + col }, [String(r.quality), h("small", null, ["%"])]),
      h("div", { class: "lab" }, [t("quality")])
    ]));
    setTimeout(function () { fg.setAttribute("stroke-dashoffset", C * (1 - r.quality / 100)); }, 60);

    var main = h("main", null, [
      h("div", { class: "eyebrow" }, [t("result_title")]),
      h("h1", null, [info.model || "—"]),
      h("div", { class: "eyebrow" }, [[info.year, info.engine].filter(Boolean).join(" · ")]),
      h("div", { class: "eyebrow", style: "margin-top:4px" }, [["VIN " + (info.vin || "—"), info.plate, info.date].filter(Boolean).join(" · ")]),
      h("div", { class: "redline" }),
      gauge,
      h("div", { class: "verdict" }, [
        h("div", { class: "score", style: "color:" + col }, [r.score.toFixed(1), h("small", null, [" / 10"])]),
        h("div", { class: "v", style: "color:" + col }, [t("verdict_" + r.band.key)])
      ])
    ]);
    main.lastChild.style.marginBottom = "16px";

    if (r.answered < r.total) main.appendChild(h("div", { class: "warnbox" }, [fill(t("unanswered"), { n: r.total - r.answered })]));

    if (r.crit.length) {
      var ul = h("ul");
      r.crit.forEach(function (f) { ul.appendChild(h("li", null, [L(f.item)])); });
      main.appendChild(h("div", { class: "crit" }, [h("h2", null, [t("crit_title")]), ul]));
    }

    // repair investment
    var rep = h("div", { class: "card" }, [h("h2", null, [t("repair")])]);
    rep.appendChild(h("div", { class: "money" }, [r.repairMax ? fmt(r.repairMin) + " – " + fmt(r.repairMax) : fmt(0)]));
    rep.appendChild(h("div", { class: "kv", style: "margin-top:10px" }, [h("span", null, [t("repair_avg")]), h("span", null, [fmt(r.repairMid)])]));
    var price = +info.price;
    if (price > 0) {
      var share = Math.round(r.repairMid / price * 100);
      rep.appendChild(h("div", { class: "kv" }, [h("span", null, [t("price_total")]), h("span", null, [fmt(price + r.repairMid)])]));
      rep.appendChild(h("div", { class: "kv" }, [h("span", null, [fill(t("repair_share"), { p: share })]), h("span", { class: share > CFG.repairWarnPct ? "warnpct" : "" }, [share > CFG.repairWarnPct ? "⚠" : "✓"])]));
    }
    main.appendChild(rep);

    // category bars
    var bars = h("div", { class: "card" }, [h("h2", null, [t("cat_quality")])]);
    r.cats.forEach(function (c) {
      if (c.pct == null) return;
      var bc = Core.bandFor(c.pct, CFG).color;
      bars.appendChild(h("div", { class: "bar" }, [
        h("div", { class: "l" }, [h("span", null, [L(c.cat)]), h("b", { style: "color:" + bc }, [c.pct + "%"])]),
        h("div", { class: "tr" }, [h("i", { style: "width:" + c.pct + "%;background:" + bc })])
      ]));
    });
    main.appendChild(bars);

    // defects / open tasks
    [["defects", true], ["open_tasks", false]].forEach(function (sec) {
      var list = r.failed.filter(function (f) { return (f.cat.scored !== false) === sec[1]; });
      if (!list.length && !sec[1]) return;
      var card = h("div", { class: "card list" }, [h("h2", null, [t(sec[0])])]);
      if (!list.length) card.appendChild(h("div", { class: "note", style: "margin:4px 0" }, [t("no_defects")]));
      var last = null, group;
      list.forEach(function (f) {
        if (f.cat !== last) { group = h("div", { class: "dgroup" }, [h("h3", null, [L(f.cat)])]); card.appendChild(group); last = f.cat; }
        var tx = h("div", { class: "tx" }, [L(f.item)]);
        if (f.item.crit) tx.appendChild(h("div", { class: "tag" }, [t("critical")]));
        group.appendChild(h("div", { class: "d" }, [tx, h("div", { class: "c" }, [f.item.cost ? money(f.item.cost) : ""])]));
      });
      main.appendChild(card);
    });

    main.appendChild(h("div", { class: "note" }, [t("disclaimer")]));
    main.appendChild(h("button", { class: "btn red", onclick: function () { exportPdf(r); } }, [t("share")]));
    main.appendChild(h("button", { class: "btn ghost", onclick: function () { copyText(report(r)); } }, [t("copy_text")]));
    main.appendChild(h("button", { class: "btn ghost", onclick: function () { go(CATS.length - 1); } }, [t("edit")]));
    main.appendChild(h("button", { class: "btn ghost", onclick: newInspection }, [t("new_check")]));
    app.appendChild(main);
  }

  // ---------- report / share ----------
  function report(r) {
    var i = state.info, lines = [];
    lines.push("CarCheck · " + (i.date || ""));
    lines.push([i.model, i.engine, i.year].filter(Boolean).join(" · "));
    lines.push("VIN: " + (i.vin || "-") + " · " + (i.plate || "-") + (i.mileage ? " · " + i.mileage + " km" : ""));
    lines.push("");
    lines.push(t("quality") + ": " + r.quality + "%  |  " + t("score") + ": " + r.score.toFixed(1) + "/10");
    lines.push(t("verdict_" + r.band.key));
    lines.push(t("repair") + ": " + (r.repairMax ? fmt(r.repairMin) + " – " + fmt(r.repairMax) : fmt(0)) + " (" + t("repair_avg") + " " + fmt(r.repairMid) + ")");
    if (+i.price > 0) lines.push(t("price_total") + ": " + fmt(+i.price + r.repairMid));
    if (r.crit.length) { lines.push(""); lines.push(t("crit_title") + ":"); r.crit.forEach(function (f) { lines.push("! " + L(f.item)); }); }
    if (r.failed.length) {
      lines.push(""); lines.push(t("defects") + ":");
      r.failed.forEach(function (f) { lines.push("- [" + L(f.cat) + "] " + L(f.item) + (f.item.cost ? " (" + money(f.item.cost) + ")" : "")); });
    }
    return lines.join("\n");
  }
  function copyText(text) {
    var done = false;
    try { done = !!(navigator.clipboard && navigator.clipboard.writeText); } catch (e) {}
    function legacy() {
      var ta = h("textarea", { style: "position:fixed;opacity:0" }); ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(t("copied")); } catch (e) {}
      ta.remove();
    }
    if (done) navigator.clipboard.writeText(text).then(function () { toast(t("copied")); }, legacy);
    else legacy();
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function reportHtml(r) {
    var i = state.info, col = r.band.color, b = [];
    b.push('<!doctype html><html><head><meta charset="utf-8"><style>' +
      'body{font-family:sans-serif;color:#15151a;font-size:12.5px;line-height:1.4;margin:0}' +
      '.br{font-size:11px;letter-spacing:.3em;font-weight:700;color:#bb0a30;text-transform:uppercase}' +
      'h1{font-size:24px;margin:4px 0 2px}h2{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#555;margin:22px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}' +
      'h3{font-size:12px;color:#bb0a30;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.08em}' +
      '.m{color:#555}.sc{display:flex;align-items:center;gap:22px;margin:14px 0 4px}' +
      '.big{font-size:46px;font-weight:300;line-height:1}.v{font-weight:700;letter-spacing:.08em;text-transform:uppercase}' +
      '.row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #e4e4e8;page-break-inside:avoid}' +
      '.tr{height:5px;background:#e4e4e8;margin:3px 0 8px}.tr i{display:block;height:100%}' +
      '.c{white-space:nowrap;color:#555}.crit{border:1px solid #d11;padding:8px 10px;margin-top:12px;color:#a00}.crit li{margin:2px 0}' +
      '.f{margin-top:22px;color:#777;font-size:10.5px}' +
      '</style></head><body>');
    b.push('<div class="br">CarCheck</div><div class="m">' + esc(t("pdf_title")) + '</div>');
    b.push('<h1>' + esc(i.model || "—") + '</h1>');
    b.push('<div class="m">' + esc([i.year, i.engine].filter(Boolean).join(" · ")) + '</div>');
    var meta = ["VIN " + (i.vin || "—"), i.plate, i.date];
    if (i.mileage) meta.push(t("pdf_mileage") + ": " + i.mileage + " km");
    if (+i.price > 0) meta.push(t("pdf_price") + ": " + fmt(+i.price));
    b.push('<div class="m">' + esc(meta.filter(Boolean).join(" · ")) + '</div>');
    b.push('<div class="sc"><div class="big" style="color:' + col + '">' + r.quality + '%</div><div><div style="font-size:22px;font-weight:700;color:' + col + '">' + r.score.toFixed(1) + ' / 10</div><div class="v" style="color:' + col + '">' + esc(t("verdict_" + r.band.key)) + '</div></div></div>');
    if (r.answered < r.total) b.push('<div class="m">' + esc(fill(t("unanswered"), { n: r.total - r.answered })) + '</div>');
    if (r.crit.length) {
      b.push('<div class="crit"><b>' + esc(t("crit_title")) + '</b><ul>');
      r.crit.forEach(function (f) { b.push('<li>' + esc(L(f.item)) + '</li>'); });
      b.push('</ul></div>');
    }
    b.push('<h2>' + esc(t("repair")) + '</h2>');
    b.push('<div class="row"><span>' + esc(r.repairMax ? fmt(r.repairMin) + " – " + fmt(r.repairMax) : fmt(0)) + '</span><span class="c">' + esc(t("repair_avg")) + ': ' + esc(fmt(r.repairMid)) + '</span></div>');
    if (+i.price > 0) b.push('<div class="row"><span>' + esc(t("price_total")) + '</span><span class="c">' + esc(fmt(+i.price + r.repairMid)) + '</span></div>');
    b.push('<h2>' + esc(t("cat_quality")) + '</h2>');
    r.cats.forEach(function (c) {
      if (c.pct == null) return;
      var bc = Core.bandFor(c.pct, CFG).color;
      b.push('<div style="page-break-inside:avoid"><div class="row" style="border:0;padding-bottom:0"><span>' + esc(L(c.cat)) + '</span><b style="color:' + bc + '">' + c.pct + '%</b></div><div class="tr"><i style="width:' + c.pct + '%;background:' + bc + '"></i></div></div>');
    });
    [["defects", true], ["open_tasks", false]].forEach(function (sec) {
      var list = r.failed.filter(function (f) { return (f.cat.scored !== false) === sec[1]; });
      if (!list.length) { if (sec[1]) b.push('<h2>' + esc(t("defects")) + '</h2><div class="m">' + esc(t("no_defects")) + '</div>'); return; }
      b.push('<h2>' + esc(t(sec[0])) + '</h2>');
      var last = null;
      list.forEach(function (f) {
        if (f.cat !== last) { b.push('<h3>' + esc(L(f.cat)) + '</h3>'); last = f.cat; }
        b.push('<div class="row"><span>' + (f.item.crit ? '<b style="color:#bb0a30">! </b>' : '') + esc(L(f.item)) + '</span><span class="c">' + (f.item.cost ? esc(money(f.item.cost)) : '') + '</span></div>');
      });
    });
    b.push('<div class="f">' + esc(t("disclaimer")) + '</div></body></html>');
    return b.join("");
  }
  function exportPdf(r) {
    var i = state.info;
    var name = "CarCheck_" + (i.plate || i.vin || "report").replace(/[^A-Za-z0-9]+/g, "") + "_" + (i.date || "");
    if (window.Android && window.Android.printReport) { window.Android.printReport(reportHtml(r), name); return; }
    if (window.Android && window.Android.share) { window.Android.share(report(r)); return; }
    var text = report(r);
    if (navigator.share) { navigator.share({ text: text }).catch(function () { copyText(text); }); return; }
    copyText(text);
  }

  render();
})();
