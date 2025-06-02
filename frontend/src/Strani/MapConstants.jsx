// constants/mapConstants.js

// API konfiguracija
export const API_CONFIG = {
    BASE_URL: 'http://localhost:8000',
    ENDPOINTS: {
        PROPERTIES: '/properties/geojson',
        CLUSTER_DETAILS: '/cluster'
    }
};

// Maptiler konfiguracija
export const MAP_CONFIG = {
    STYLE_URL: "https://api.maptiler.com/maps/0196d56b-a9a2-7fd7-90c8-96455f98e5e4/style.json?key=VxVsHKinUjiHiI3FPcfq",
    INITIAL_CENTER: [14.9, 46.14],
    INITIAL_ZOOM: 7.8,
    MUNICIPALITY_ZOOM: {
        PADDING: 50,
        DURATION: 1500
    },
    SEARCH_ZOOM: 17,
    SEARCH_DURATION: 1500
};

// Data source mapping
export const DATA_SOURCE_CONFIG = {
    TYPES: {
        PRODAJA: 'prodaja',
        NAJEM: 'najem'
    },
    API_MAPPING: {
        prodaja: 'kpp',
        najem: 'np'
    }
};

// Barve za različne tipe podatkov
export const COLOR_SCHEME = {
    PRODAJA: {
        CIRCLE: '#3B82F6',
        STROKE: '#1D4ED8',
        CLUSTER: ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF']
    },
    NAJEM: {
        CIRCLE: '#10B981',
        STROKE: '#059669',
        CLUSTER: ['#34D399', '#10B981', '#059669', '#047857']
    },
    MUNICIPALITY: {
        DEFAULT: '#64748b',
        SELECTED: '#3B82F6'
    },
    OBCINA: {
        DEFAULT: '#00008B',
        SELECTED: '#7C3AED',
        HOVER: '#A78BFA'
    }
};

// Layer IDs
export const LAYER_IDS = {
    MUNICIPALITIES: {
        FILL: 'municipalities-fill',
        OUTLINE: 'municipalities-outline',
        LABELS: 'municipalities-labels'
    },
    OBCINE: {
        FILL: 'obcine-fill',
        OUTLINE: 'obcine-outline',
        LABELS: 'obcine-labels'
    },
    PROPERTIES: {
        MAIN: 'properties-layer',
        TEXT: 'properties-text-layer'
    },
    CLUSTERS: {
        MAIN: 'clusters-layer',
        COUNT: 'cluster-count-layer'
    },
    EXPANDED: {
        PREFIX: 'expanded-layer-',
        TEXT_SUFFIX: '-text'
    }
};

// Source IDs
export const SOURCE_IDS = {
    MUNICIPALITIES: 'municipalities',
    OBCINE: 'obcine',
    PROPERTIES: 'properties',
    CLUSTERS: 'clusters',
    EXPANDED_PREFIX: 'expanded-'
};

// Zoom levels for different data types
export const ZOOM_LEVELS = {
    OBCINE_THRESHOLD: 9, // Below this zoom show občine, above show municipalities
    MUNICIPALITY_DETAIL: 12 // When to load property data
};

// Zoom-dependent styling
export const ZOOM_STYLES = {
    PROPERTIES: {
        CIRCLE_RADIUS: [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 3,
            12, 6,
            16, 10
        ],
        TEXT_SIZE: [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 6,
            12, 8,
            16, 10
        ]
    },
    MUNICIPALITIES: {
        LINE_WIDTH: [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 0.5,
            8, 0.8,
            10, 1,
            12, 1.2,
            14, 1.5
        ],
        LINE_OPACITY: [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 0.3,
            8, 0.5,
            10, 0.7,
            12, 0.8
        ],
        LABEL_SIZE: [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 10,
            11, 12,
            13, 14,
            15, 16
        ],
        LABEL_OPACITY: [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0,
            9, 0.7,
            11, 1
        ]
    },
    CLUSTERS: {
        RADIUS: [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            1, 10,
            100, 18,
            1000, 25,
            10000, 35
        ],
        COUNT_SIZE: [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            1, 10,
            100, 12,
            1000, 14,
            10000, 16
        ]
    },
    EXPANDED: {
        CIRCLE_RADIUS: [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, 6,
            13, 9,
            17, 12
        ],
        TEXT_SIZE: [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, 6,
            13, 8,
            17, 9
        ]
    }
};

// Cluster konfiguracija
export const CLUSTER_CONFIG = {
    EXPANSION: {
        SINGLE_CIRCLE_MAX: 10,
        INNER_CIRCLE_MAX: 10,
        INNER_CIRCLE_PERCENTAGE: 0.35,
        RADIUS_MULTIPLIERS: {
            BASE: 0.005,
            INNER: 1.2,
            OUTER: 2.0
        }
    },
    TYPES: {
        BUILDING: 'b_',
        DISTRICT: 'd_'
    }
};

// Timeout konfiguracija
export const TIMEOUTS = {
    ZOOM_DEBOUNCE: 300,
    POPUP_SETUP: 100
};

// UI konfiguracija
export const UI_CONFIG = {
    POPUP: {
        MAX_WIDTH: '320px',
        CLASS_NAME: 'custom-popup'
    },
    CONTROLS: {
        POSITION: 'top-right',
        TOP_OFFSET: '260px',
        BUTTON_SIZE: '47px',
        BORDER_RADIUS: '8px'
    }
};