# Bike traffic: Boston + Cambridge

An interactive Mapbox visualization of Bluebikes station traffic and bike lanes
in Boston and Cambridge. The time slider filters March 2024 trips to starts and
ends within 60 minutes of the selected time. Station circles are sized by total
traffic and colored from blue (lower traffic) to red (higher traffic).

## Run locally

1. For local testing, add your Mapbox **public** access token to `map-config.js`.
   Do not commit the token.
2. From this folder, start a local static web server (for example,
   `python -m http.server 8000`).
3. Open `http://localhost:8000` in a browser.

Mapbox access tokens are intended for client-side use, but restrict the token to
your local and published site URLs in the Mapbox dashboard. Do not use a secret
or server-side token here.

## Publish on GitHub Pages

1. In the repository, open **Settings → Secrets and variables → Actions** and
   create a repository secret named `MAPBOX_ACCESS_TOKEN` containing your
   Mapbox **public** token (starts with `pk.`).
2. Open **Settings → Pages** and select **GitHub Actions** as the build and
   deployment source.
3. Push to `main`. The workflow in `.github/workflows/pages.yml` deploys the
   site and writes the secret into the generated client-side config during the
   build. The token is not committed to the repository.

Restrict the token to your published site URL in the Mapbox dashboard. A
browser-facing public token is visible to site visitors by design; never use a
secret/server-side token.

The app loads data from the Bluebikes lab datasets, Boston Open Data, and the
City of Cambridge GIS ArcGIS service. An internet connection is required.
