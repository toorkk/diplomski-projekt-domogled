// utils/mapUtils.js
import maplibregl from "maplibre-gl";
import { DATA_SOURCE_CONFIG, COLOR_SCHEME, API_CONFIG } from './MapConstants.jsx';

// Mapiranje data source tipov
export const getApiDataSource = (dataSourceType) => {
    return DATA_SOURCE_CONFIG.API_MAPPING[dataSourceType] || 'kpp';
};

export const getDataSourceType = (apiDataSource) => {
    const mapping = Object.entries(DATA_SOURCE_CONFIG.API_MAPPING);
    const found = mapping.find(([type, api]) => api === apiDataSource);
    return found ? found[0] : 'prodaja';
};

// Pridobivanje barv glede na data source
export const getColorScheme = (dataSourceType) => {
    return dataSourceType === 'prodaja' ? COLOR_SCHEME.PRODAJA : COLOR_SCHEME.NAJEM;
};

export const getColorsFromDataSource = (apiDataSource) => {
    const dataSourceType = getDataSourceType(apiDataSource);
    return getColorScheme(dataSourceType);
};

// Maplibre expression za formatiranje cen
export const createPriceExpression = (dataSourceType) => {
    if (dataSourceType === 'prodaja') {
        return [
            'case',
            ['has', 'zadnja_cena'],
            [
                'concat',
                '€',
                [
                    'number-format',
                    ['/', ['get', 'zadnja_cena'], 1000],
                    { 'max-fraction-digits': 0 }
                ],
                'k'
            ],
            'N/A'
        ];
    } else {
        return [
            'case',
            ['has', 'zadnja_najemnina'],
            [
                'concat',
                '€',
                [
                    'number-format',
                    ['get', 'zadnja_najemnina'],
                    { 'max-fraction-digits': 0 }
                ],
                '/m'
            ],
            'N/A'
        ];
    }
};

// Gradnja API URL-jev
export const buildPropertiesUrl = (bbox, zoom, dataSource, sifko = null) => {
    const bboxParam = bbox || '0,0,0,0';
    let url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROPERTIES}?bbox=${bboxParam}&zoom=${zoom}&data_source=${dataSource}`;
    
    if (sifko) {
        url += `&sifko=${sifko}`;
    }
    
    return url;
};

export const buildClusterDetailsUrl = (clusterId, dataSource, zoom) => {
    return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLUSTER_DETAILS}/${clusterId}/properties?data_source=${dataSource}&zoom=${zoom}`;
};

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

// Geometrijske kalkulacije za cluster expansion
export const calculateClusterCenter = (properties, originalClusterProperties = null) => {
    // Poskusi dobiti center iz originalnih cluster properties
    if (originalClusterProperties?.geometry?.coordinates) {
        const [lng, lat] = originalClusterProperties.geometry.coordinates;
        return [lng, lat];
    }

    // Izračunaj povprečje iz vseh properties
    let centerLng = 0, centerLat = 0, validCoords = 0;
    
    properties.forEach(prop => {
        if (prop.geometry?.coordinates && 
            prop.geometry.coordinates[0] !== 0 && 
            prop.geometry.coordinates[1] !== 0) {
            centerLng += prop.geometry.coordinates[0];
            centerLat += prop.geometry.coordinates[1];
            validCoords++;
        }
    });

    if (validCoords > 0) {
        return [centerLng / validCoords, centerLat / validCoords];
    }

    return null;
};

export const calculateExpansionRadius = (zoom, baseRadius = 0.005) => {
    return baseRadius / Math.pow(2, Math.max(0, zoom - 13));
};

// Maplibre layer style helpers
export const createMunicipalityOutlineStyle = (selectedSifko = null) => ({
    'line-color': [
        'case',
        ['==', ['get', 'SIFKO'], selectedSifko || -1],
        COLOR_SCHEME.MUNICIPALITY.SELECTED,
        COLOR_SCHEME.MUNICIPALITY.DEFAULT
    ],
    'line-width': [
        'case',
        ['==', ['get', 'SIFKO'], selectedSifko || -1],
        3,
        [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 0.5,
            8, 0.8,
            10, 1,
            12, 1.2,
            14, 1.5
        ]
    ]
});

export const createClusterColorExpression = (colorScheme) => ([
    'interpolate',
    ['linear'],
    ['get', 'point_count'],
    1, colorScheme[0],
    100, colorScheme[1],
    1000, colorScheme[2],
    10000, colorScheme[3]
]);

// Debugging utilities
export const logClusterDebug = (clusterId, clusterProperties, dataSource) => {
    console.log('=== CLUSTER DEBUG ===');
    console.log('Cluster ID:', clusterId);
    console.log('Cluster type:', clusterProperties.cluster_type);
    console.log('Point count:', clusterProperties.point_count);
    console.log('Data source:', dataSource);
    console.log('Deduplicated IDs:', clusterProperties.deduplicated_ids);
};

export const logPropertyArrangement = (index, coords, type = 'single') => {
    console.log(`${type} circle - Property ${index}: coords=[${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}]`);
};

// Error handling utilities
export const handleApiError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    throw error;
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