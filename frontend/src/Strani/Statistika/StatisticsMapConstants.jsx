// constants/StatisticsMapConstants.js

// Maptiler konfiguracija
export const MAP_CONFIG = {
    STYLE_URL: "https://api.maptiler.com/maps/0196d56b-a9a2-7fd7-90c8-96455f98e5e4/style.json?key=VxVsHKinUjiHiI3FPcfq",
    INITIAL_CENTER: [14.9, 46.14],
    INITIAL_ZOOM: 7.5, // Zmanjšano za bolj zoomed out pogled
    MUNICIPALITY_ZOOM: {
        PADDING: 100, // Povečano padding = manj zoom
        DURATION: 1500
    }
};

// Barve za različne elemente
export const COLOR_SCHEME = {
    MUNICIPALITY: {
        DEFAULT: '#808080',
        SELECTED: '#000000',
        HOVER: '#000000'
    },
    OBCINA: {
        DEFAULT: '#808080',
        SELECTED: '#000000',
        HOVER: '#000000'
    }
};

// Color palettes za percentile barvanje občin
export const PERCENTILE_COLOR_PALETTES = {
    prodaja: [
        'rgba(219, 234, 254, 0.8)', // p20 - zelo svetlo modra
        'rgba(147, 197, 253, 0.8)', // p40 - svetlo modra  
        'rgba(59, 130, 246, 0.8)',  // p60 - srednja modra
        'rgba(37, 99, 235, 0.8)',   // p80 - temna modra
        'rgba(29, 78, 216, 0.9)'    // p100 - zelo temna modra
    ],
    najem: [
        'rgba(209, 250, 229, 0.8)', // p20 - zelo svetlo zelena
        'rgba(110, 231, 183, 0.8)', // p40 - svetlo zelena
        'rgba(16, 185, 129, 0.8)',  // p60 - srednja zelena  
        'rgba(5, 150, 105, 0.8)',   // p80 - temna zelena
        'rgba(4, 120, 87, 0.9)'     // p100 - zelo temna zelena
    ]
};

// Konstante za color mapping
export const COLOR_MAPPING_CONFIG = {
    EMPTY_COLOR: 'rgba(255, 255, 255, 0.8)', // Spremeni na belo
    DEFAULT_FALLBACK: 'rgba(255, 255, 255, 0.8)', // Spremeni na belo
    PERCENTILE_THRESHOLDS: [0.2, 0.4, 0.6, 0.8],
    SUPPORTED_MUNICIPALITIES: ['LJUBLJANA', 'MARIBOR']
};

// Layer IDs
export const LAYER_IDS = {
    MUNICIPALITIES: {
        FILL: 'municipalities-fill',
        OUTLINE: 'municipalities-outline'
    },
    OBCINE: {
        FILL: 'obcine-fill',
        OUTLINE: 'obcine-outline'
    }
};

// Source IDs
export const SOURCE_IDS = {
    MUNICIPALITIES: 'municipalities',
    OBCINE: 'obcine'
};

// Zoom levels for different data types
export const ZOOM_LEVELS = {
    OBCINE_THRESHOLD: 8 // Zmanjšano iz 9 na 8 - katastri se pokažejo prej
};

// Poenostavljeni zoom-dependent styling (samo osnovni)
export const ZOOM_STYLES = {
    MUNICIPALITIES: {
        LINE_WIDTH: 1,
        LINE_OPACITY: 0.6,
        HOVER_LINE_WIDTH: 2
    },
    OBCINE: {
        DEFAULT_LINE_WIDTH: 1.2,
        DEFAULT_OPACITY: 0.6,
        HOVER_LINE_WIDTH: 2.5,
        SELECTED_LINE_WIDTH: 3.5
    }
};