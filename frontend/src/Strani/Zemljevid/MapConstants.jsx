// API konfiguracija
export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_BACKEND_URL,
    ENDPOINTS: {
        PROPERTIES: "/properties/geojson",
        CLUSTER_DETAILS: "/cluster", 
        STATISTICS: "/api/statistike/splosne"
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
        CIRCLE: '#8ec5ff',
        STROKE: '#4a5565',
        CLUSTER: ['#8ec5ff', '#7ab8ff', '#6ba3ff', '#5c94ff']
    },
    NAJEM: {
        CIRCLE: '#00d492',
        STROKE: '#4a5565',
        CLUSTER: ['#33dd9f', '#00d492', '#00b87a', '#009c62']
    },
    OBCINA: {
        DEFAULT: '#808080',    // Svetla siva - manj opazna
        SELECTED: '#000000',   // Črna barva za selected
        HOVER: '#000000'       // Črna barva za hover
    }
};

// Layer IDs
export const LAYER_IDS = {
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
    OBCINE: 'obcine',
    PROPERTIES: 'properties',
    CLUSTERS: 'clusters',
    EXPANDED_PREFIX: 'expanded-'
};

// UPDATED: Zoom leveli za new logic
export const ZOOM_LEVELS = {
    OBCINE_LABELS_THRESHOLD: 9,     // When to show občine labels
    AUTO_LOAD_PROPERTIES: 6        // When to auto-load properties
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
    
    OBCINE: {
        DEFAULT_LINE_WIDTH: [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 1.0,    // Tanjše default
            7, 1.3,
            9, 1.2,
            12, 1.0,
            15, 0.8
        ],
        DEFAULT_OPACITY: [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0.5,    // Bolj prozorne
            7, 0.7,
            9, 0.5,
            12, 0.4,
            15, 0.3
        ],
        HOVER_LINE_WIDTH: [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 2.0,    // Močno povečanje za hover
            7, 2.5,
            9, 2.3,
            12, 2.0,
            15, 1.8
        ],
        SELECTED_LINE_WIDTH: [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 3.5,    // Povečano: Še debelejše za selected (prej 2.5)
            7, 4.0,    // Povečano: (prej 3.0)
            9, 3.8,    // Povečano: (prej 2.8)
            12, 3.5,   // Povečano: (prej 2.5)
            15, 3.0    // Povečano: (prej 2.0)
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