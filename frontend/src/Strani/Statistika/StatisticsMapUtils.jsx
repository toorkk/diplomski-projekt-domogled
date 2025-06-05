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

// Municipality utilities
export const getMunicipalityName = (municipalityFeature) => {
    const sifko = municipalityFeature.properties.SIFKO;
    return municipalityFeature.properties.IMEKO || `KO ${sifko}`;
};

// Občina utilities
export const getObcinaName = (obcinaFeature) => {
    return obcinaFeature.properties.OB_UIME;
};

export const getObcinaId = (obcinaFeature) => {
    return obcinaFeature.properties.OB_ID;
};