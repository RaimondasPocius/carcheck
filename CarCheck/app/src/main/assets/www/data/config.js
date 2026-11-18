// APP SETTINGS - edit values here to tune scoring without touching the code.
window.CONFIG = {
  defaultLang: "lt",        // "lt" or "en"
  currency: "€",
  costMultiplier: 1.0,      // 1.2 = repair prices +20% (e.g. expensive workshop)
  strictness: 2.0,          // quality = (earned/possible)^strictness * 100. 1 = linear, higher = harsher
  criticalCap: 45,          // if any CRITICAL item is marked X, quality is capped at this %
  serviceBadRating: 7,      // workshop rating at or below this is listed as a problem (with repair estimate)
  serviceCritRating: 3,     // workshop rating at or below this counts as CRITICAL
  serviceCapMid: 84,        // a workshop rating <= 6 caps quality here (never green)
  serviceCapPoor: 65,       // a workshop rating <= 4 caps quality here
  negWalkBelow: 50,         // quality % below this -> advice is "do not buy / only with a big discount"
  negWalkRepairShare: 0.4,  // repairs above this share of the asking price -> advice is "do not buy"
  negMaxDiscount: 0.35,     // the opening offer never goes lower than this share below the asking price
  negOpenExtra: 0.03,       // first offer = price - max repair - this share of the price
  repairWarnPct: 15,        // highlight repair cost if it exceeds this % of the asking price
  // Verdict bands, highest first. 'buy' (green) = worth buying.
  bands: [
    { min: 85, key: "buy",       color: "#33d17a" },
    { min: 70, key: "negotiate", color: "#f5b301" },
    { min: 50, key: "risky",     color: "#ff7a1a" },
    { min: 0,  key: "avoid",     color: "#ff3b4e" }
  ]
};
