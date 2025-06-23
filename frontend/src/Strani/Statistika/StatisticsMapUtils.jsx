// utils/StatisticsMapUtils.js
import maplibregl from "maplibre-gl";

// Bounds utility funkcije
export const addCoordinatesToBounds = (bounds, coordinates) => {
    if (Array.isArray(coordinates[0])) {
        coordinates.forEach(coord => addCoordinatesToBounds(bounds, coord));
    } else {
        bounds.extend(coordinates);
    }
};

export const calculateBoundsFromGeometry = (geometry) => {
    const bounds = new maplibregl.LngLatBounds();
    addCoordinatesToBounds(bounds, geometry.coordinates);
    return bounds;
};

// Kataster utilities
export const getMunicipalityName = (municipalityFeature) => {
  const name = municipalityFeature.properties.NAZIV || municipalityFeature.properties.IMEKO;
  const code = municipalityFeature.properties.SIFKO;
  
  if (name && code) {
    return `${name} (${code})`;
  } else if (name) {
    return name;
  } else if (code) {
    return `KO ${code}`;
  } else {
    return 'Neznana občina';
  }
};


// Občina utilities
export const getObcinaName = (obcinaFeature) => {
    return obcinaFeature.properties.OB_UIME;
};

export const getObcinaId = (obcinaFeature) => {
    return obcinaFeature.properties.OB_ID;
};