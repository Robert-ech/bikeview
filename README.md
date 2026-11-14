# Bike traffic: Boston + Cambridge

An interactive Mapbox visualization of Bluebikes station traffic and bike lanes
in Boston and Cambridge. The time slider filters March 2024 trips to starts and
ends within 60 minutes of the selected time. Station circles are sized by total
traffic and colored by the balance of departures and arrivals.

## Run locally

1. Add your Mapbox **public** access token to `map-config.js`.
2. From this folder, start a local static web server (for example,
   `python -m http.server 8000`).
3. Open `http://localhost:8000` in a browser.

Mapbox access tokens are intended for client-side use, but restrict the token to
your local and published site URLs in the Mapbox dashboard. Do not use a secret
or server-side token here.

The app loads data from the Bluebikes lab datasets, Boston Open Data, and the
City of Cambridge GIS ArcGIS service. An internet connection is required.
