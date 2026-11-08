# Thucydides Aerospace Inc. — Landing Page

Single-page static site for [thucy-aero.com](https://thucy-aero.com), hosted on GitHub Pages.

## Deploy to GitHub Pages

### 1. Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it something like `thucy-aero.com`
3. Keep it **Public** (required for free GitHub Pages)
4. Do **not** initialize with a README — you already have one locally

### 2. Push this folder to GitHub

```bash
cd c:\Users\dylan\Documents\Projects\thucy-aero.com
git init
git add .
git commit -m "Add landing page"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/thucy-aero.com.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### 3. Enable GitHub Pages

1. Open your repo on GitHub → **Settings** → **Pages**
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**
3. Set **Branch** to `main` and folder to `/ (root)`
4. Click **Save**
5. Under **Custom domain**, enter `thucy-aero.com` and save
6. Wait for the DNS check, then enable **Enforce HTTPS**

The `CNAME` file in this repo tells GitHub Pages which domain to serve.

### 4. Configure DNS at GoDaddy

Log in to [GoDaddy](https://www.godaddy.com) → **My Products** → **DNS** for `thucy-aero.com`.

**Remove** any existing A records or CNAME records that point to GoDaddy's website builder (if you're replacing the current "Coming Soon" site).

**Add these A records** for the root domain (`@`):

| Type | Name | Value             | TTL  |
|------|------|-------------------|------|
| A    | @    | 185.199.108.153   | 600  |
| A    | @    | 185.199.109.153   | 600  |
| A    | @    | 185.199.110.153   | 600  |
| A    | @    | 185.199.111.153   | 600  |

**Add a CNAME** for `www` (optional but recommended):

| Type  | Name | Value                        | TTL  |
|-------|------|------------------------------|------|
| CNAME | www  | YOUR_USERNAME.github.io      | 600  |

Replace `YOUR_USERNAME` with your GitHub username.

DNS changes can take up to 48 hours to propagate, but usually complete within an hour.

### 5. Set up email (separate from the website)

To use `dylan@thucy-aero.com`, sign up for [Google Workspace](https://workspace.google.com/) or [Zoho Mail](https://www.zoho.com/mail/) and add the MX records they provide in GoDaddy DNS. This is independent of GitHub Pages.

## Local preview

One-time setup (needs Node.js):

```bash
npm install
```

Then start the dev server:

```bash
npm run dev        # opens http://localhost:5173 and live-reloads on every save
npm run dev:lan    # same, but also reachable from your phone on the same Wi-Fi
```

Vite is only used as a local dev server. There is no build step: GitHub Pages
still serves the files in this repo as-is.

## What gets published

GitHub Pages builds the site with Jekyll, and `_config.yml` keeps `assets/`,
`tools/`, `node_modules/` and the npm files out of the published site. They are
still in git, and this repo is public, so anyone can see them on GitHub.

Design files and flight logs (the OpenVSP model, geometry memo, ArduPilot logs)
are **not** in git: they live in `assets/` on your machine only and are listed
in `.gitignore`. Add anything else that must stay private to `.gitignore`
before committing; removing a file from git history later is much harder.

## Color scheme

The site is dark only. Every color is a CSS custom property in `:root` in
`styles.css`; use those tokens and don't hard-code colors anywhere else.

| Token            | Value                     | Use                                              | Contrast on `--bg` |
|------------------|---------------------------|--------------------------------------------------|--------------------|
| `--bg`           | `#0a0c0f`                 | Page background (also `theme-color`)             | —                  |
| `--text`         | `#e8eaed`                 | Headings, primary text                           | 16.3:1             |
| `--text-muted`   | `#8b929a`                 | Body copy, captions, footer                      | 6.2:1              |
| `--accent`       | `#00a800`                 | Brand green: links, top rule, ASCII airframe, telemetry values | 6.2:1              |
| `--accent-hover` | `#00c400`                 | Link hover and focus                             | 8.3:1              |
| `--border`       | `#1e2329`                 | Dividers (decorative, not for text)              | 1.2:1              |
| `--grid-dot`     | `rgb(255 255 255 / 0.07)` | Background dot grid                              | —                  |

Every text color passes WCAG AA (4.5:1). Green is the only accent color. Use it
sparingly, for things you can interact with or that represent the brand.

## Airframe animation

`airframe.js` draws the rotating ASCII quadplane into `<pre id="airframe-ascii">`.
It works like the classic spinning ASCII donut: it samples points on each
surface, tumbles them on two axes, uses a z-buffer for depth, and shades with
`.,-~:;=!*#$@`. The dimensions are typed into the script (they come from the
OpenVSP model, which is kept out of git). It pauses when scrolled off-screen and shows a
still frame if the visitor has "reduce motion" turned on.

## Latest milestone page (`/latest/`)

Shows one milestone at a time: a video with live flight telemetry under it.

- `latest/media/first-flight.mp4`: trimmed web clip (12.0–36.5 s of the
  original in `assets/flight-test-2/`, no audio, H.264 CRF 23).
- `latest/media/first-flight.telemetry.json`: readouts synced to the clip,
  built from the onboard ArduPilot log by `tools/apm_telemetry.py`. See that
  script's header for how the video and log were lined up. The log itself is
  not in git; keep it at `assets/flight-test-2/APM/` locally.
- `latest/telemetry.js`: updates the readouts every video frame.

If you re-trim the clip, rebuild the telemetry with the new `--clip-start` and
`--duration`:

```bash
python3 tools/apm_telemetry.py assets/flight-test-2/APM/LOGS/00000001.BIN \
  latest/media/first-flight.telemetry.json \
  --offset 503.3 --clip-start 12.0 --duration 24.5 --touchdown 536.25
```
