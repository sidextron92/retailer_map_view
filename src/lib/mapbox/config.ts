export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

if (!MAPBOX_TOKEN) {
  console.warn('Missing Mapbox access token. Please check your .env.local file.');
}

// Default map configuration
export const DEFAULT_MAP_CONFIG = {
  initialViewState: {
    longitude: -122.4, // San Francisco (change to your default city)
    latitude: 37.8,
    zoom: 11,
  },
  mapStyle: 'mapbox://styles/mapbox/streets-v12',
  // Alternative styles:
  // 'mapbox://styles/mapbox/light-v11'
  // 'mapbox://styles/mapbox/dark-v11'
  // 'mapbox://styles/mapbox/satellite-streets-v12'
};

// Clustering configuration
export const CLUSTER_CONFIG = {
  clusterMaxZoom: 16, // Max zoom to cluster points on (increased to allow clustering at higher zoom)
  clusterRadius: 30, // Radius of each cluster when clustering points (reduced from 50 to 30 pixels for tighter clustering)
};

// Map controls configuration
export const MAP_CONTROLS = {
  showZoomControls: true,
  showGeolocationControl: true,
  showFullscreenControl: false,
  showNavigationControl: true,
};
