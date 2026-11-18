// SCORING LOGIC (pure functions, no UI). Can be tested with node.
(function (root) {
  "use strict";

  function bandFor(q, cfg) {
    for (var i = 0; i < cfg.bands.length; i++) {
      if (q >= cfg.bands[i].min) return cfg.bands[i];
    }
    return cfg.bands[cfg.bands.length - 1];
  }

  function round10(n) { return Math.round(n / 10) * 10; }
  function r50(n) { return Math.round(n / 50) * 50; }

  // answers: { itemId: "ok" | "bad" | "na" }
  // svc:  { categoryKey: true }  -> category is judged by a workshop rating instead of the checklist
  // rate: { categoryKey: 1..10 } -> workshop rating (1 bad, 10 good)
  function calc(data, cfg, answers, svc, rate) {
    svc = svc || {}; rate = rate || {};
    var earned = 0, possible = 0, answered = 0, total = 0;
    var repMin = 0, repMax = 0, failed = [], crit = [], cats = [], svcCap = 100;

    data.categories.forEach(function (cat) {
      var n = cat.items.length;
      total += n;

      if (cat.service && svc[cat.key]) {
        var W = 0;
        cat.items.forEach(function (it) { W += it.w; });
        var rt = rate[cat.key];
        if (!rt) { cats.push({ cat: cat, pct: null, answered: 0, n: n, service: true }); return; }
        answered += n;
        var e = W * rt / 10;
        if (cat.scored !== false) { possible += W; earned += e; }
        if (rt <= 6) svcCap = Math.min(svcCap, cfg.serviceCapMid);
        if (rt <= 4) svcCap = Math.min(svcCap, cfg.serviceCapPoor);
        var f = (10 - rt) / 9;
        var cost = cat.serviceCost ? [round10(cat.serviceCost[0] * f), round10(cat.serviceCost[1] * f)] : null;
        if (rt <= cfg.serviceBadRating) {
          var isCrit = rt <= cfg.serviceCritRating;
          var item = {
            id: "svc_" + cat.key, w: 0, crit: isCrit, cost: cost && cost[1] > 0 ? cost : null,
            lt: "Serviso įvertinimas: " + rt + "/10", en: "Workshop rating: " + rt + "/10"
          };
          failed.push({ cat: cat, item: item });
          if (isCrit) crit.push({ cat: cat, item: item });
          if (item.cost) { repMin += item.cost[0]; repMax += item.cost[1]; }
        }
        cats.push({ cat: cat, pct: Math.round(Math.pow(rt / 10, cfg.strictness) * 100), answered: n, n: n, service: true, rating: rt });
        return;
      }

      var ce = 0, cp = 0, cAns = 0;
      cat.items.forEach(function (it) {
        var a = answers[it.id];
        if (!a) return;
        answered++; cAns++;
        if (a === "na") return;
        if (cat.scored !== false) {
          cp += it.w; possible += it.w;
          if (a === "ok") { ce += it.w; earned += it.w; }
        }
        if (a === "bad") {
          failed.push({ cat: cat, item: it });
          if (it.crit) crit.push({ cat: cat, item: it });
          if (it.cost) { repMin += it.cost[0]; repMax += it.cost[1]; }
        }
      });
      var cpct = cp ? Math.round(Math.pow(ce / cp, cfg.strictness) * 100) : null;
      cats.push({ cat: cat, pct: cpct, answered: cAns, n: n });
    });

    var q = possible ? Math.pow(earned / possible, cfg.strictness) * 100 : 0;
    var rawPct = possible ? (earned / possible) * 100 : 0;
    if (q > svcCap) q = svcCap;
    if (crit.length && q > cfg.criticalCap) q = cfg.criticalCap;
    q = Math.round(q);
    var score = Math.min(10, Math.max(1, q / 10));

    var m = cfg.costMultiplier || 1;
    repMin = round10(repMin * m);
    repMax = round10(repMax * m);

    return {
      quality: q, rawPct: Math.round(rawPct), score: Math.round(score * 10) / 10,
      band: bandFor(q, cfg), failed: failed, crit: crit, cats: cats,
      repairMin: repMin, repairMax: repMax, repairMid: round10((repMin + repMax) / 2),
      answered: answered, total: total
    };
  }

  // Negotiation advice from a calc() result and the asking price (0 = unknown).
  function negotiate(res, price, cfg) {
    var pts = res.failed.filter(function (f) { return f.item.cost; }).map(function (f) {
      return { cat: f.cat, item: f.item, mid: (f.item.cost[0] + f.item.cost[1]) / 2 };
    }).sort(function (a, b) { return b.mid - a.mid; });
    var lo = r50(res.repairMin), hi = r50(res.repairMax), mid = r50(res.repairMid);
    var walk = res.crit.length > 0 || res.quality < cfg.negWalkBelow || (price > 0 && res.repairMid > price * cfg.negWalkRepairShare);
    var o = { level: walk ? "walk" : (hi > 0 ? "discount" : "none"), lo: lo, hi: hi, mid: mid, points: pts, open: 0, target: 0, ceiling: 0 };
    if (price > 0) {
      o.open = Math.max(r50(price * (1 - cfg.negMaxDiscount)), r50(price - hi - price * cfg.negOpenExtra)); // first offer
      o.target = Math.max(o.open, r50(price - mid));                    // realistic deal
      o.ceiling = Math.max(o.target, r50(price - lo));                  // do not pay more than this
    }
    return o;
  }

  root.Core = { calc: calc, bandFor: bandFor, negotiate: negotiate };
  if (typeof module !== "undefined") module.exports = root.Core;
})(typeof window !== "undefined" ? window : globalThis);
