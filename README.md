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

Events newest first. The latest one leads the page (the `h1`); each earlier one
follows in its own `milestone-more` section, with its date. To add
an event, move the current lead into a `milestone-more` section and put the new
one at the top.

### First forward flight (2026-11-22)

- `latest/media/first-transition.mp4`: all of `IMG_3814.MOV` (iPhone, in the
  2026-11-22 Outdoor session in the team Drive), portrait. The bottom 30 % of
  the frame (foreground grass) is cropped off, leaving 4:5, and scaled from 4K
  to 1080 x 1350. Two-pass H.264 at 8.2 Mbit/s, so the file stays under
  GitHub's 100 MB limit; the original is 487 MB. No audio, phone metadata
  (including GPS location) removed.
- `latest/media/first-transition-poster.jpg`: its frame at 47 s, overhead in fixed-wing flight.
- `latest/media/first-transition.telemetry.json`: readouts synced to the clip,
  built from that flight's log (`APM/LOGS/00000062.BIN` in the same session
  folder) by `tools/apm_telemetry.py`; the command and how the log was lined
  up with the video are in that script's header.

```bash
VF="fps=30,crop=2160:2700:0:0,scale=1080:1350:flags=lanczos,format=yuv420p,setsar=1"
ffmpeg -i IMG_3814.MOV -vf "$VF" -an -c:v libx264 -preset slow -b:v 8200k \
  -maxrate 14M -bufsize 20M -pass 1 -f null /dev/null
ffmpeg -i IMG_3814.MOV -vf "$VF" -an -map_metadata -1 -c:v libx264 -preset slow \
  -b:v 8200k -maxrate 14M -bufsize 20M -pass 2 -pix_fmt yuv420p -color_range tv \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart \
  latest/media/first-transition.mp4
```

### Indoor hover test (2026-11-16)

- `latest/media/indoor-hover.mp4`: one flight filmed by two phones, side by
  side in one file so the views cannot drift apart. Left is 2:39.00–3:08.98 of
  `PXL_20261117_050904666.mp4`, right is 2:41.02–3:11.00 of `IMG_3771.MOV`
  (both in the 2026-11-16 indoor session in the team Drive). No audio, phone
  metadata removed, H.264 CRF 20, with a 16 px bar between the views.
- The two were lined up on the picture: the aircraft's up-and-down movement in
  each view, which agrees to within a frame. The iPhone recording runs 2.02 s
  ahead of the Pixel one. (Lining up on the motor sound gave 1.89 s, four
  frames out.)
- `latest/media/indoor-hover-poster.jpg`: its frame at 6 s.
- `latest/media/indoor-hover.telemetry.json`: readouts synced to the clip,
  built from that flight's log (`APM/LOGS/00000041.BIN` in the same session
  folder) by `tools/apm_telemetry.py`; the command and how the log was lined
  up with the video are in that script's header. Altitude is the downward
  rangefinder's, because indoors there is no GPS. The heading shows turns
  well, but indoors the compass is disturbed, so its north is not checked.

```bash
ffmpeg -ss 159 -t 29.98 -i PXL_20261117_050904666.mp4 \
  -ss 161.02 -t 29.98 -i IMG_3771.MOV -filter_complex \
  "[0:v]fps=30,scale=1920:1080:in_range=pc:out_range=tv:flags=lanczos,format=yuv420p,setsar=1[a];\
   [1:v]fps=30,scale=608:1080:flags=lanczos,format=yuv420p,setsar=1,pad=624:1080:16:0:color=0x0a0c0f[b];\
   [a][b]hstack=inputs=2[v]" \
  -map "[v]" -an -map_metadata -1 -c:v libx264 -crf 20 -preset slow \
  -pix_fmt yuv420p -color_range tv -colorspace bt709 -movflags +faststart \
  latest/media/indoor-hover.mp4
```

### First flight (2026-11-01)


- `latest/media/first-flight.mp4`: trimmed web clip (12.0–36.5 s of the
  original in `assets/flight-test-2/`, no audio, H.264 CRF 23).
- `latest/media/first-flight.telemetry.json`: readouts synced to the clip,
  built from the onboard ArduPilot log by `tools/apm_telemetry.py`. See that
  script's header for how the video and log were lined up. The log itself is
  not in git; keep it at `assets/flight-test-2/APM/` locally.
- `latest/telemetry.js`: updates the readouts every video frame, for every
  readout panel on the page (`data-for` names its video).

If you re-trim the clip, rebuild the telemetry with the new `--clip-start` and
`--duration`:

```bash
python3 tools/apm_telemetry.py assets/flight-test-2/APM/LOGS/00000001.BIN \
  latest/media/first-flight.telemetry.json \
  --offset 503.3 --clip-start 12.0 --duration 24.5 --touchdown 536.25
```
