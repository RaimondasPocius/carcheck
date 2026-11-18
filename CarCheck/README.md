# CarCheck – used car inspection app (Audi-inspired dark theme, LT/EN)

Native Android shell (WebView) + web app in `app/src/main/assets/www/`.
**Almost every change happens only in that folder.**

## Build the APK (no Android Studio needed)
1. Create a GitHub repo and upload this whole folder (including `.github/`).
2. Open the repo → **Actions → Build APK → Run workflow** (also runs on every push).
3. When finished, download the artifact **CarCheck-apk** → unzip → install `app-debug.apk`
   (allow "install unknown apps" on the phone).

Alternative: open the folder in Android Studio → Build → Build APK(s).

## Where to change things
| What | File |
|---|---|
| Checklist items, weights, repair costs, critical flags | `www/data/checklist.js` |
| UI texts (LT/EN) | `www/data/strings.js` |
| Scoring strictness, verdict colors/thresholds, cost multiplier | `www/data/config.js` |
| Scoring formula | `www/core.js` |
| Screens / behaviour | `www/app.js` |
| Look (colors, fonts) | `www/style.css` |

Open `www/index.html` in a desktop browser to preview without building.

## Checklist item format
`{"id":"b07","w":3,"crit":true,"cost":[500,3000],"lt":"...","en":"..."}`
- `w` importance 1–3; `crit` deal-breaker (caps quality at `criticalCap`); `cost` = [min,max] EUR if marked ✗.
- Keep `id` stable. Category `"scored": false` = not counted in the quality index (still shows open tasks and costs).

## Scoring
quality % = (earned weight / possible weight)^strictness × 100 (items marked "–" are ignored).
Score 1–10 = quality / 10. Green "worth buying" at ≥ 85 %. Repair investment = sum of min/max costs of ✗ items.

## Prompt for Claude when updating
"Here is my CarCheck project. Change X in the files under `app/src/main/assets/www/`, return full changed files."

## Saved reports & PDF
- Burger button (top left) lists saved reports; a report is saved automatically when the result screen is opened. Stored in the phone's WebView localStorage.
- "Create PDF report" opens Android's print dialog: choose **Save as PDF** (then share the file from Files).
- PDF layout: `reportHtml()` in `www/app.js`; native bridge: `printReport()` in `MainActivity.java`.
