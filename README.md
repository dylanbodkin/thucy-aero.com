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

Open `index.html` in a browser, or run a simple local server:

```bash
npx serve .
```
