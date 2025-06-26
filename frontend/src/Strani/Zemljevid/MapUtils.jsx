// utils/mapUtils.jsx
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
                    ['round', ['/', ['get', 'zadnja_cena'], 1000]],
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
                    ['round', ['get', 'zadnja_najemnina']],
                    { 'max-fraction-digits': 0 }
                ],
                '/m'
            ],
            'N/A'
        ];
    }
};

// Helper funkcija ki builda query parametre za filter
export const buildFilterParams = (filters = {}) => {
    const params = new URLSearchParams();
    

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.append(key, value);
        }
    });
    
    return params.toString();
};

// Gradnja API URL-jev z podporo za filtre
export const buildPropertiesUrl = (bbox, zoom, dataSource, sifko = null, municipality = null, filters = {}) => {
    const bboxParam = bbox || '0,0,0,0';
    const params = new URLSearchParams({
        bbox: bboxParam,
        zoom: zoom.toString(),
        data_source: dataSource
    });
    
    if (sifko) {
        params.append('sifko', sifko.toString());
    }
    
    if (municipality) {
        params.append('municipality', municipality);
    }
    
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.append(key, value.toString());
        }
    });
    
    return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROPERTIES}?${params.toString()}`;
};

export const buildClusterDetailsUrl = (clusterId, dataSource, zoom, filters = {}) => {
    const params = new URLSearchParams({
        data_source: dataSource,
        zoom: zoom.toString()
    });
    
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.append(key, value.toString());
        }
    });
    
    return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CLUSTER_DETAILS}/${clusterId}/properties?${params.toString()}`;
};

// NOVO: API funkcija za pridobivanje statistik
export const fetchStatistics = async (tipRegije, regija) => {
    try {
        // Spremeni ime regije v uppercase pred pošiljanjem
        const regijaUppercase = regija.toUpperCase();
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATISTICS}/${tipRegije}/${encodeURIComponent(regijaUppercase)}`;
        console.log(`Fetching statistics from: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching statistics for ${tipRegije} ${regija}:`, error);
        return null;
    }
};

// NOVO: Utility funkcija za formatiranje statistik
export const formatStatistics = (statistics, dataSourceType) => {
    if (!statistics || !statistics.splosne_statistike || !statistics.splosne_statistike.pregled) {
        return null;
    }
    
    const pregled = statistics.splosne_statistike.pregled;
    
    // Določi kateri tip posla nas zanima (prodaja ali najem)
    const tipPosla = dataSourceType === 'prodaja' ? 'prodaja' : 'najem';
    
    // Poišči podatke za stanovanja in hiše
    const stanovanjaKey = `${tipPosla}_stanovanje`;
    const hiseKey = `${tipPosla}_hisa`;
    
    const stanovanjaData = pregled[stanovanjaKey];
    const hiseData = pregled[hiseKey];
    
    return {
        stanovanja: stanovanjaData ? {
            stevilo_poslov: stanovanjaData.stevilo_poslov || 0,
            povprecna_cena_m2: stanovanjaData.povprecna_cena_m2,
            povprecna_skupna_cena: stanovanjaData.povprecna_skupna_cena,
            povprecna_velikost_m2: stanovanjaData.povprecna_velikost_m2,
            povprecna_starost_stavbe: stanovanjaData.povprecna_starost_stavbe,
            trenutno_v_najemu: stanovanjaData.trenutno_v_najemu
        } : null,
        hise: hiseData ? {
            stevilo_poslov: hiseData.stevilo_poslov || 0,
            povprecna_cena_m2: hiseData.povprecna_cena_m2,
            povprecna_skupna_cena: hiseData.povprecna_skupna_cena,
            povprecna_velikost_m2: hiseData.povprecna_velikost_m2,
            povprecna_starost_stavbe: hiseData.povprecna_starost_stavbe,
            trenutno_v_najemu: hiseData.trenutno_v_najemu
        } : null,
        tipPosla,
        hasData: (stanovanjaData && (stanovanjaData.stevilo_poslov > 0 || stanovanjaData.aktivna_v_letu > 0)) || (hiseData && (hiseData.stevilo_poslov > 0 || hiseData.aktivna_v_letu > 0))
    };
};

// Validira filter vrednosti
export const validateFilters = (filters, dataSourceType) => {
    const validated = {};
    
    // Year validacija
    if (filters.filter_leto && filters.filter_leto >= 2000 && filters.filter_leto <= new Date().getFullYear()) {
        validated.filter_leto = parseInt(filters.filter_leto);
    }
    
    // Price validacija
    if (filters.min_cena && filters.min_cena >= 0) {
        validated.min_cena = parseFloat(filters.min_cena);
    }
    
    if (filters.max_cena && filters.max_cena >= 0) {
        validated.max_cena = parseFloat(filters.max_cena);
    }
    
    // Ensure min <= max for price
    if (validated.min_cena && validated.max_cena && validated.min_cena > validated.max_cena) {
        console.warn('Min cena je višja od max cena - popravljam');
        [validated.min_cena, validated.max_cena] = [validated.max_cena, validated.min_cena];
    }
    
    // Surface area validation
    if (filters.min_povrsina && filters.min_povrsina >= 0) {
        validated.min_povrsina = parseFloat(filters.min_povrsina);
    }
    
    if (filters.max_povrsina && filters.max_povrsina >= 0) {
        validated.max_povrsina = parseFloat(filters.max_povrsina);
    }
    
    // Ensure min <= max for surface area
    if (validated.min_povrsina && validated.max_povrsina && validated.min_povrsina > validated.max_povrsina) {
        console.warn('Min površina je višja od max površina - popravljam');
        [validated.min_povrsina, validated.max_povrsina] = [validated.max_povrsina, validated.min_povrsina];
    }
    
    return validated;
};


export const formatFilterSummary = (filters, dataSourceType) => {
    const parts = [];
    
    if (filters.filter_leto) {
        parts.push(`Leto: ${filters.filter_leto}`);
    }
    else parts.push(`Leto: 2025`);
    
    if (filters.min_cena || filters.max_cena) {
        const currency = dataSourceType === 'prodaja' ? ' €' : ' € / mes';
        const min = filters.min_cena ? `${filters.min_cena}` : '0';
        const max = filters.max_cena ? `${filters.max_cena}` : '∞';
        parts.push(`Cena: ${min} - ${max} ${currency}`);
    }
    
    if (filters.min_povrsina || filters.max_povrsina) {
        const min = filters.min_povrsina || '0';
        const max = filters.max_povrsina || '∞';
        parts.push(`Površina: ${min} m² - ${max} m²`);
    }
    
    return parts.join(', ');
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

// Maplibre stili
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