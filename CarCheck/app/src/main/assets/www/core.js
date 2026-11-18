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

  // answers: { itemId: "ok" | "bad" | "na" }
  function calc(data, cfg, answers) {
    var earned = 0, possible = 0, answered = 0, total = 0;
    var repMin = 0, repMax = 0, failed = [], crit = [], cats = [];

    data.categories.forEach(function (cat) {
      var ce = 0, cp = 0, cAns = 0;
      cat.items.forEach(function (it) {
        total++;
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
      cats.push({ cat: cat, pct: cpct, answered: cAns, n: cat.items.length });
    });

    var q = possible ? Math.pow(earned / possible, cfg.strictness) * 100 : 0;
    var rawPct = possible ? (earned / possible) * 100 : 0;
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

  root.Core = { calc: calc, bandFor: bandFor };
  if (typeof module !== "undefined") module.exports = root.Core;
})(typeof window !== "undefined" ? window : globalThis);
