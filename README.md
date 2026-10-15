# Reel Luck

A cinematic movie recommendation wheel. Built with plain HTML, CSS, and JavaScript; no API keys, packages, or build step required.

## Features

- 40 films selected from Letterboxd’s official Top 500 Films.
- A randomized wheel with a precise animated landing and optional tick sounds.
- Genre, runtime, and era filters; no repeat picks by default.
- Film posters, director/year/runtime details, original watch pitches, and direct Letterboxd links.
- Searchable collection and watchlist saved in this browser.
- Keyboard controls, screen-reader announcements, reduced-motion support, and responsive layouts.

## Preview

Serve `dist/` with any static web server, or open `dist/index.html` directly. The local files include the movie data and posters. The page uses Google Fonts when available and falls back to system fonts.

## GitHub Pages

1. Put the contents of `dist/` at the root of a GitHub repository. For a personal homepage, name the repository `YOUR-USERNAME.github.io`.
2. Open the repository’s Settings → Pages.
3. Choose “Deploy from a branch,” then `main` and `/ (root)`; save.
4. Share the website URL shown in the Pages settings after deployment completes.

All local file URLs are relative, so project pages such as `YOUR-USERNAME.github.io/reel-luck/` also work. Keep `.nojekyll` in the root. The Sites hosting metadata is not required for GitHub Pages.

## Data and credits

Curated snapshot verified October 13, 2026 against https://letterboxd.com/official/list/letterboxds-top-500-films/ . Metadata and poster image URLs were verified using each film’s public Letterboxd page. `movies.js` retains the original poster source URL and direct film link for each selection. Film posters remain the property of their respective owners. Watch pitches are original.

This is an independent project, unaffiliated with Letterboxd. It does not connect to a Letterboxd account or live-sync rankings. Saved films and spin history stay in local browser storage, which can be reset or cleared by the browser.
