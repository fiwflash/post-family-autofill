# AGENTS.md

Manifest V3 Chrome extension that auto-fills the POST Family (Thailand Post) signup form and extracts signup data with the Gemini API. Plain HTML/CSS/vanilla JS — **no package.json, build, lint, test, or CI**.

## Load / verify

- Load unpacked at `chrome://extensions` with Developer mode; select this repo root. There is no build step; `manifest.json` is the shipped artifact.
- Manual test only: real signup page at `https://praisanee.my.site.com/postfamily/Signup` plus a Gemini API key entered in the side panel. No test suite or fixtures.
- After editing `background.js`: reload the extension. After editing `content.js`: reload the extension **and** refresh the signup tab (content scripts are injected only on navigation). After editing `popup.*`: close/reopen the side panel.
- `backup/` is gitignored and untracked. Never edit or rely on it as source; the root files are canonical.

## Architecture

- `popup.html` + `popup.js` are the **Side Panel** (`side_panel.default_path`), not a browser-action popup. It owns the UI, settings, clipboard paste, review form, and storage.
- `background.js` is the service worker. It only handles `extractDataWithGemini` (Gemini REST call); all form filling is done by the content script.
- `content.js` runs only on `https://praisanee.my.site.com/postfamily/Signup*` (see `content_scripts.matches`). It handles `fillStep1`, `fillStep2`, `fillStep3` messages.
- Flow: side panel → background for Gemini extraction → side panel review form → side panel → content script for filling.
- `chrome.storage.local` keys: `geminiApiKey`, `selectedModel`, `refCodes`, `recommendedPostcode`, `fillTimings`. The API key is stored in plaintext; never hardcode one.

## Site-specific quirks (do not "simplify")

- The target site uses Quasar. Selectors depend on `.q-field__label`, `.q-field__native`, `.q-menu`, `.q-item`, `.q-checkbox` and exact Thai `aria-label` strings. Fields are found by visible Thai label, so keep labels/strings in Thai and match the live site.
- Dropdowns have two distinct strategies: `selectQuasarByLabel` for short lists (day, month, province, district, sub-district) and `selectQuasarByScroll` for the long year list (Buddhist-era year). Don't merge them into a generic `<select>` approach.
- `setInputValue` must dispatch native setter + `input`/`change`/`blur` events; direct `.value =` does not update the framework state.
- Birth year is 4-digit Buddhist era; month input is numeric and converted to Thai month names via `convertMonthToThai`.
- Referral codes are normalized to `THP-` prefix in `content.js` (`formatReferralCode`).
- Review form initializes the password field to `aaaa1111` when populating data (`popup.js`).

## Timing settings

- `DEFAULT_TIMINGS` is duplicated in `content.js` and `popup.js`; change both together.
- Storage stores timings in **milliseconds**; the settings UI displays seconds and applies the `fast` / `normal` / `safe` multipliers (`0.5` / `1.0` / `1.5`).

## Conventions

- Keep user-facing strings in Thai to match the existing UI and README.
- No formatter is configured; preserve each file's existing style (2-space in `content.js`/`background.js`, 4-space in `popup.js`) and avoid unrelated reformatting.
- Model names from the Gemini `models` list are full resource names (e.g. `models/gemini-2.5-flash`) and are appended directly to the `v1beta/...:generateContent` URL. `gemini-1.5-flash` is only the background fallback; the UI prioritizes `gemini-2.5-flash` and auto-switches on "high demand" errors.
