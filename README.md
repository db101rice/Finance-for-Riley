# Riley's Money Lab

A small phone-friendly web app that shows, with sliders and charts:

1. **Start Early**: how starting to invest at 15 instead of 25 changes what you have at 65.
2. **Loans**: what a car, student loan or mortgage really costs in interest, and what extra payments save.
3. **The Credit Card Trap**: how long the "minimum payment" takes, compared with fixed payments.
4. **Small Habits Add Up**: what a daily or weekly habit would grow to if invested instead.

Plain HTML/CSS/JavaScript with no build step and no dependencies. It works offline once loaded.

## Run locally
```
python3 -m http.server 8000
```
Then open http://localhost:8000.

## Files
- `finance.js`: all the money math (monthly compounding)
- `charts.js`: small SVG charts with touch tooltips
- `app.js`: the four topic screens
- `sw.js`, `manifest.webmanifest`, `icons/`: let it be installed with "Add to Home Screen"
