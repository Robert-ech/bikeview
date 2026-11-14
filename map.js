import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { MAPBOX_ACCESS_TOKEN } from './map-config.js';

const DATA_URLS = {
  stations: 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json',
  trips: 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
  bostonLanes:
    'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  cambridgeLanes:
    'https://services1.arcgis.com/WnzC35krSYGuYov4/arcgis/rest/services/draft_2020_Bike_Network_Vision/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&outSR=4326',
};

const status = document.querySelector('#map-status');
const slider = document.querySelector('#time-slider');
const selectedTime = document.querySelector('#selected-time');
const anyTimeLabel = document.querySelector('#any-time');
const bostonToggle = document.querySelector('#boston-lanes-toggle');
const cambridgeToggle = document.querySelector('#cambridge-lanes-toggle');
const svg = d3.select('.station-overlay');
const minutesPerDay = 24 * 60;
const departuresByMinute = Array.from({ length: minutesPerDay }, () => []);
const arrivalsByMinute = Array.from({ length: minutesPerDay }, () => []);
const lineStyle = {
  'line-color': '#16845f',
  'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3.5],
  'line-opacity': 0.62,
};

let map;
let stations = [];
let radiusScale;
let trafficColorScale;
let circles;
let loadedLayers = new Set();
let dataReady = false;

function setStatus(message, visible = true) {
  status.textContent = message;
  status.hidden = !visible;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function minuteOfDay(dateTime) {
  const match = /(?:T|\s)(\d{2}):(\d{2})/.exec(dateTime);
  if (!match) {
    throw new Error(`Could not read trip time: ${dateTime}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function addToTimeBuckets(trips) {
  for (const trip of trips) {
    const departureMinute = minuteOfDay(trip.started_at);
    const arrivalMinute = minuteOfDay(trip.ended_at);
    departuresByMinute[departureMinute].push(trip);
    arrivalsByMinute[arrivalMinute].push(trip);
  }
}

function filterByMinute(tripsByMinute, selectedMinute) {
  if (selectedMinute === -1) {
    return tripsByMinute.flat();
  }

  const filteredTrips = [];
  for (let offset = -60; offset <= 60; offset += 1) {
    const minute = (selectedMinute + offset + minutesPerDay) % minutesPerDay;
    filteredTrips.push(...tripsByMinute[minute]);
  }
  return filteredTrips;
}

function computeStationTraffic(timeFilter = -1) {
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter),
    (trips) => trips.length,
    (trip) => trip.start_station_id,
  );
  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter),
    (trips) => trips.length,
    (trip) => trip.end_station_id,
  );

  return stations.map((station) => {
    const departureCount = departures.get(station.short_name) ?? 0;
    const arrivalCount = arrivals.get(station.short_name) ?? 0;
    return {
      ...station,
      departures: departureCount,
      arrivals: arrivalCount,
      totalTraffic: departureCount + arrivalCount,
    };
  });
}

function getCoords(station) {
  const point = map.project([Number(station.lon), Number(station.lat)]);
  return { cx: point.x, cy: point.y };
}

function updatePositions() {
  if (!circles) return;
  circles
    .attr('cx', (station) => getCoords(station).cx)
    .attr('cy', (station) => getCoords(station).cy);
}

function updateScatterPlot(timeFilter) {
  const filteredStations = computeStationTraffic(timeFilter);
  const maximumTraffic = d3.max(filteredStations, (station) => station.totalTraffic) ?? 0;
  radiusScale.domain([0, maximumTraffic || 1]);
  radiusScale.range(timeFilter === -1 ? [0, 25] : [2, 48]);
  trafficColorScale.domain([0, maximumTraffic || 1]);

  circles = svg
    .selectAll('circle')
    .data(filteredStations, (station) => station.short_name)
    .join(
      (enter) => {
        const newCircles = enter.append('circle');
        newCircles.append('title');
        return newCircles;
      },
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr('r', (station) => radiusScale(station.totalTraffic))
    .style('fill', (station) => trafficColorScale(station.totalTraffic))
    .each(function (station) {
      d3.select(this)
        .select('title')
        .text(
          `${station.name}: ${station.totalTraffic.toLocaleString()} trips ` +
            `(${station.departures.toLocaleString()} departures, ` +
            `${station.arrivals.toLocaleString()} arrivals)`,
        );
    });

  updatePositions();
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60) % 12 || 12;
  const minute = String(minutes % 60).padStart(2, '0');
  const period = minutes < 720 ? 'AM' : 'PM';
  return `${hour}:${minute} ${period}`;
}

function updateTimeDisplay() {
  const timeFilter = Number(slider.value);
  const hasTimeFilter = timeFilter !== -1;
  selectedTime.textContent = hasTimeFilter ? formatTime(timeFilter) : '';
  anyTimeLabel.hidden = hasTimeFilter;
  if (dataReady) updateScatterPlot(timeFilter);
}

function setLayerToggle(toggle, layerId) {
  toggle.disabled = !loadedLayers.has(layerId);
  if (!toggle.disabled) {
    map.setLayoutProperty(layerId, 'visibility', toggle.checked ? 'visible' : 'none');
  }
}

async function loadBikeLaneLayer(id, sourceId, url, label) {
  try {
    const geojson = await d3.json(url);
    if (!geojson || !Array.isArray(geojson.features)) {
      throw new Error('The response was not a GeoJSON FeatureCollection.');
    }

    map.addSource(sourceId, { type: 'geojson', data: geojson });
    map.addLayer({ id, type: 'line', source: sourceId, paint: lineStyle });
    loadedLayers.add(id);
    return null;
  } catch (error) {
    console.error(`Unable to load ${label} bike lanes:`, error);
    return `${label}: ${getErrorMessage(error)}`;
  }
}

async function loadData() {
  setStatus('Loading Bluebikes stations and March 2024 trip data…');
  try {
    const [stationData, trips] = await Promise.all([
      d3.json(DATA_URLS.stations),
      d3.csv(DATA_URLS.trips),
    ]);

    if (!Array.isArray(stationData?.data?.stations)) {
      throw new Error('The station response did not contain a stations list.');
    }
    if (trips.length === 0) {
      throw new Error('The Bluebikes trip dataset is empty.');
    }

    stations = stationData.data.stations;
    addToTimeBuckets(trips);
    radiusScale = d3.scaleSqrt().range([0, 25]);
    trafficColorScale = d3.scaleLinear().range(['#3182f6', '#e34b43']).clamp(true);
    dataReady = true;
    updateTimeDisplay();
    setStatus(
      `${stations.length.toLocaleString()} stations · ${trips.length.toLocaleString()} trips loaded`,
      false,
    );

    const laneResults = await Promise.all([
      loadBikeLaneLayer('boston-bike-lanes', 'boston-routes', DATA_URLS.bostonLanes, 'Boston'),
      loadBikeLaneLayer(
        'cambridge-bike-lanes',
        'cambridge-routes',
        DATA_URLS.cambridgeLanes,
        'Cambridge',
      ),
    ]);

    setLayerToggle(bostonToggle, 'boston-bike-lanes');
    setLayerToggle(cambridgeToggle, 'cambridge-bike-lanes');
    const laneErrors = laneResults.filter(Boolean);
    if (laneErrors.length > 0) {
      setStatus(`Some bike-lane data could not be loaded: ${laneErrors.join(' · ')}`);
    } else {
      setStatus('', false);
    }
  } catch (error) {
    console.error('Unable to load Bluebikes data:', error);
    setStatus(`Could not load Bluebikes data: ${getErrorMessage(error)}`);
  }
}

if (!MAPBOX_ACCESS_TOKEN.trim()) {
  setStatus(
    'Add your Mapbox public token to map-config.js, then reload. Use a public token with URL restrictions.',
  );
} else {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN.trim();
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 10,
    maxZoom: 18,
    attributionControl: false,
  });
  map.addControl(new mapboxgl.NavigationControl(), 'top-left');
  map.on('load', loadData);
  map.on('move', updatePositions);
  map.on('resize', updatePositions);
  map.on('error', (event) => {
    if (!dataReady && event.error) {
      console.error('Mapbox map error:', event.error);
      setStatus(`Mapbox could not load the map: ${getErrorMessage(event.error)}`);
    }
  });
}

slider.addEventListener('input', updateTimeDisplay);
bostonToggle.addEventListener('change', () =>
  setLayerToggle(bostonToggle, 'boston-bike-lanes'),
);
cambridgeToggle.addEventListener('change', () =>
  setLayerToggle(cambridgeToggle, 'cambridge-bike-lanes'),
);
updateTimeDisplay();
