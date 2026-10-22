# Motu

A Push/Pull/Legs x2 training tracker. Strong-style logging, plus the consistency dashboard from the old Google Sheet.

Live: `https://hossainawsaf11.github.io/motu/` (once GitHub Pages is on)

## What it does
- Log sets fast: previous weight and reps shown on every row, tap the tick and the placeholder fills in
- Double progression coach on each exercise: tells you to hold or add weight based on last session
- Rest timer that starts on every tick, with sound and vibration
- Records: estimated 1RM PRs flagged live, charts per lift (1RM, top weight, volume, reps)
- XP, levels, ranks, weekly streak, 6-session target, 12-week consistency map
- Comeback bonus after 7+ days off
- Body weight trend with checkpoints, daily steps with 10k goal
- Stairmaster finisher on every session
- Plate calculator for barbell lifts, kg/lb toggle
- Editable templates, edit or delete past sessions
- Works offline and installs to your home screen

## Data
Everything is stored in your phone's browser. Weeks 1 to 8 from the sheet are preloaded.
Add it to your home screen (Safari: Share > Add to Home Screen) and export a backup from Settings every couple of weeks.

## Files
- `index.html` page and styles
- `app.js` all logic
- `seed.js` templates and history imported from the sheet
- `sw.js`, `manifest.webmanifest`, `icons/` offline + install support
