// managers/LayerManager.js
import {
    LAYER_IDS,
    SOURCE_IDS,
    ZOOM_STYLES,
    COLOR_SCHEME,
    ZOOM_LEVELS
} from './MapConstants.jsx';
import {
    getColorScheme,
    createPriceExpression,
    createClusterColorExpression
} from './MapUtils.jsx';

// Konstante za konfiguracijo slogov
const LAYER_STYLES = {
    OBCINA: {
        DEFAULT: { width: 1.2, opacity: 0.6 },
        SELECTED: { width: 3.0, opacity: 1.0 },
        HOVER: { width: 2.5, opacity: 0.9 }
    }
};

// Pomožne funkcije za stiliziranje
const createLineStyle = (colorExpression, widthExpression, opacityExpression) => ({
    'line-color': colorExpression,
    'line-width': widthExpression,
    'line-opacity': opacityExpression
});

const createSelectionExpression = (property, selectedValue, selectedStyle, defaultStyle) => [
    'case',
    ['==', ['get', property], selectedValue || -1],
    selectedStyle,
    defaultStyle
];

const createCircleStyle = (colors, radius) => ({
    'circle-radius': radius,
    'circle-color': colors.CIRCLE,
    'circle-opacity': 0.7,
    'circle-stroke-width': 1,
    'circle-stroke-color': "#ffffff"
});

const createTextStyle = (dataSourceType, colors, size) => ({
    layout: {
        'text-field': createPriceExpression(dataSourceType),
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': size,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-anchor': 'center',
        'text-justify': 'center'
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': colors.STROKE,
        'text-halo-width': 1
    }
});

// Glavna LayerManager razred
class LayerManager {
    constructor(map) {
        this.map = map;
    }

    // === OBČINE SLOJI ===
    
    // Dodaj sloje za občine (vedno vidni)
    addObcineLayers(obcineData) {
        if (this.hasSource(SOURCE_IDS.OBCINE)) {
            return;
        }

        try {
            this.addObcineSource(obcineData);
            this.addObcineFillLayer();
            this.addObcineOutlineLayer();
        } catch (error) {
            throw new Error(`Napaka pri dodajanju slojev občin: ${error.message}`);
        }
    }

    addObcineSource(obcineData) {
        this.map.addSource(SOURCE_IDS.OBCINE, {
            type: 'geojson',
            data: obcineData
        });
    }

    addObcineFillLayer() {
        this.map.addLayer({
            id: LAYER_IDS.OBCINE.FILL,
            type: 'fill',
            source: SOURCE_IDS.OBCINE,
            paint: {
                'fill-color': 'transparent',
                'fill-opacity': 0
            },
            layout: { 'visibility': 'visible' }
        });
    }

    addObcineOutlineLayer() {
        this.map.addLayer({
            id: LAYER_IDS.OBCINE.OUTLINE,
            type: 'line',
            source: SOURCE_IDS.OBCINE,
            paint: createLineStyle(
                COLOR_SCHEME.OBCINA.DEFAULT,
                LAYER_STYLES.OBCINA.DEFAULT.width,
                LAYER_STYLES.OBCINA.DEFAULT.opacity
            ),
            layout: { 'visibility': 'visible' }
        });
    }

    // Posodobi izbiro občine
    updateObcinaSelection(selectedObcinaId = null) {
        if (!this.hasLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        this.updateObcinaStyle(selectedObcinaId, {
            colorSelected: COLOR_SCHEME.OBCINA.SELECTED,
            colorDefault: COLOR_SCHEME.OBCINA.DEFAULT,
            styles: LAYER_STYLES.OBCINA
        });

        this.updateObcinaFilter(selectedObcinaId);
    }

    // Posodobi hover stanje občine
    updateObcinaHover(hoveredObcinaId = null) {
        if (!this.hasLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-color', 
            createSelectionExpression('OB_ID', hoveredObcinaId, COLOR_SCHEME.OBCINA.HOVER, COLOR_SCHEME.OBCINA.DEFAULT)
        );
        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-width',
            createSelectionExpression('OB_ID', hoveredObcinaId, LAYER_STYLES.OBCINA.HOVER.width, LAYER_STYLES.OBCINA.DEFAULT.width)
        );
        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-opacity',
            createSelectionExpression('OB_ID', hoveredObcinaId, LAYER_STYLES.OBCINA.HOVER.opacity, LAYER_STYLES.OBCINA.DEFAULT.opacity)
        );
    }

    updateObcinaStyle(selectedId, config) {
        const layerId = LAYER_IDS.OBCINE.OUTLINE;
        
        this.map.setPaintProperty(layerId, 'line-color',
            createSelectionExpression('OB_ID', selectedId, config.colorSelected, config.colorDefault)
        );
        this.map.setPaintProperty(layerId, 'line-width',
            createSelectionExpression('OB_ID', selectedId, config.styles.SELECTED.width, config.styles.DEFAULT.width)
        );
        this.map.setPaintProperty(layerId, 'line-opacity',
            createSelectionExpression('OB_ID', selectedId, config.styles.SELECTED.opacity, config.styles.DEFAULT.opacity)
        );
    }

    updateObcinaFilter(selectedObcinaId) {
        const filter = selectedObcinaId ? ['!=', ['get', 'OB_ID'], selectedObcinaId] : null;
        this.map.setFilter(LAYER_IDS.OBCINE.FILL, filter);
    }

    // Posodobi vidnost slojev glede na zoom
    updateLayerVisibilityByZoom(currentZoom) {
        this.updateObcineVisibility();
    }

    updateObcineVisibility() {
        if (!this.hasLayer(LAYER_IDS.OBCINE.FILL)) return;

        // Občine so vedno vidne
        this.setLayerVisibility(LAYER_IDS.OBCINE.FILL, true);
        this.setLayerVisibility(LAYER_IDS.OBCINE.OUTLINE, true);
        
        // Oznake samo pri nižjih zoom nivojih
        if (this.hasLayer(LAYER_IDS.OBCINE.LABELS)) {
            const showLabels = this.map.getZoom() < ZOOM_LEVELS.OBCINE_LABELS_THRESHOLD;
            this.setLayerVisibility(LAYER_IDS.OBCINE.LABELS, showLabels);
        }
    }

    setLayerVisibility(layerId, visible) {
        this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }

    // === NEPREMIČNINE SLOJI ===

    // Dodaj sloje za nepremičnine
    addPropertiesLayers(features, dataSourceType) {
        this.removePropertiesLayers();

        if (features.length === 0) return;

        try {
            const colors = getColorScheme(dataSourceType);
            this.addPropertiesSource(features);
            this.addPropertiesCircleLayer(colors);
            this.addPropertiesTextLayer(colors, dataSourceType);
        } catch (error) {
            throw new Error(`Napaka pri dodajanju slojev nepremičnin: ${error.message}`);
        }
    }

    addPropertiesSource(features) {
        this.map.addSource(SOURCE_IDS.PROPERTIES, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: features
            }
        });
    }

    addPropertiesCircleLayer(colors) {
        this.map.addLayer({
            id: LAYER_IDS.PROPERTIES.MAIN,
            type: 'circle',
            source: SOURCE_IDS.PROPERTIES,
            paint: createCircleStyle(colors, ZOOM_STYLES.PROPERTIES.CIRCLE_RADIUS)
        });
    }

    addPropertiesTextLayer(colors, dataSourceType) {
        const textStyle = createTextStyle(dataSourceType, colors, ZOOM_STYLES.PROPERTIES.TEXT_SIZE);
        
        this.map.addLayer({
            id: LAYER_IDS.PROPERTIES.TEXT,
            type: 'symbol',
            source: SOURCE_IDS.PROPERTIES,
            layout: textStyle.layout,
            paint: textStyle.paint
        });
    }

    removePropertiesLayers() {
        this.removeLayerAndSource(
            [LAYER_IDS.PROPERTIES.TEXT, LAYER_IDS.PROPERTIES.MAIN],
            SOURCE_IDS.PROPERTIES
        );
    }

    // === GROZDOVI SLOJI ===

    // Dodaj sloje za grozdove
    addClustersLayers(features, dataSourceType) {
        this.removeClustersLayers();

        if (features.length === 0) return;

        try {
            const colors = getColorScheme(dataSourceType);
            this.addClustersSource(features);
            this.addClustersCircleLayer(colors);
            this.addClustersCountLayer(colors);
        } catch (error) {
            throw new Error(`Napaka pri dodajanju slojev grozdov: ${error.message}`);
        }
    }

    addClustersSource(features) {
        this.map.addSource(SOURCE_IDS.CLUSTERS, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: features
            }
        });
    }

    addClustersCircleLayer(colors) {
        this.map.addLayer({
            id: LAYER_IDS.CLUSTERS.MAIN,
            type: 'circle',
            source: SOURCE_IDS.CLUSTERS,
            paint: {
                'circle-radius': ZOOM_STYLES.CLUSTERS.RADIUS,
                'circle-color': createClusterColorExpression(colors.CLUSTER),
                'circle-opacity': 0.8,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': '#ffffff'
            }
        });
    }

    addClustersCountLayer(colors) {
        this.map.addLayer({
            id: LAYER_IDS.CLUSTERS.COUNT,
            type: 'symbol',
            source: SOURCE_IDS.CLUSTERS,
            layout: {
                'text-field': '{point_count}',
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': ZOOM_STYLES.CLUSTERS.COUNT_SIZE
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': colors.STROKE,
                'text-halo-width': 1
            }
        });
    }

    removeClustersLayers() {
        this.removeLayerAndSource(
            [LAYER_IDS.CLUSTERS.COUNT, LAYER_IDS.CLUSTERS.MAIN],
            SOURCE_IDS.CLUSTERS
        );
    }

    // === RAZŠIRJENI GROZDOVI ===

    // Dodaj sloje za razširjene grozdove
    addExpandedClusterLayers(clusterId, features, dataSourceType) {
        const { sourceId, layerId, textLayerId } = this.getExpandedClusterIds(clusterId);
        
        this.removeExpandedClusterLayers(clusterId);

        try {
            const colors = getColorScheme(dataSourceType);
            this.addExpandedClusterSource(sourceId, features);
            this.addExpandedClusterCircleLayer(layerId, sourceId, colors);
            this.addExpandedClusterTextLayer(textLayerId, sourceId, colors, dataSourceType);
            
            return { layerId, textLayerId };
        } catch (error) {
            throw new Error(`Napaka pri dodajanju razširjenih slojev grozda ${clusterId}: ${error.message}`);
        }
    }

    getExpandedClusterIds(clusterId) {
        const sourceId = `${SOURCE_IDS.EXPANDED_PREFIX}${clusterId}`;
        const layerId = `${LAYER_IDS.EXPANDED.PREFIX}${clusterId}`;
        const textLayerId = `${layerId}${LAYER_IDS.EXPANDED.TEXT_SUFFIX}`;
        
        return { sourceId, layerId, textLayerId };
    }

    addExpandedClusterSource(sourceId, features) {
        this.map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: features
            }
        });
    }

    addExpandedClusterCircleLayer(layerId, sourceId, colors) {
        this.map.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            paint: createCircleStyle(colors, ZOOM_STYLES.EXPANDED.CIRCLE_RADIUS)
        });
    }

    addExpandedClusterTextLayer(textLayerId, sourceId, colors, dataSourceType) {
        const textStyle = createTextStyle(dataSourceType, colors, ZOOM_STYLES.EXPANDED.TEXT_SIZE);
        
        this.map.addLayer({
            id: textLayerId,
            type: 'symbol',
            source: sourceId,
            layout: textStyle.layout,
            paint: textStyle.paint
        });
    }

    removeExpandedClusterLayers(clusterId) {
        const { sourceId, layerId, textLayerId } = this.getExpandedClusterIds(clusterId);
        this.removeLayerAndSource([textLayerId, layerId], sourceId);
    }

    // === POMOŽNE METODE ===

    // Odstrani sloje in vire
    removeLayerAndSource(layerIds, sourceId) {
        const layersArray = Array.isArray(layerIds) ? layerIds : [layerIds];
        
        layersArray.forEach(layerId => {
            if (this.hasLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
        });

        if (this.hasSource(sourceId)) {
            this.map.removeSource(sourceId);
        }
    }

    // Preveri ali sloj obstaja
    hasLayer(layerId) {
        return !!this.map.getLayer(layerId);
    }

    // Preveri ali vir obstaja
    hasSource(sourceId) {
        return !!this.map.getSource(sourceId);
    }

    // Počisti vse sloje
    cleanup() {
        this.cleanupObcineLayers();
        this.removePropertiesLayers();
        this.removeClustersLayers();
    }

    cleanupObcineLayers() {
        const obcineLayers = [LAYER_IDS.OBCINE.FILL, LAYER_IDS.OBCINE.OUTLINE];
        if (this.hasLayer(LAYER_IDS.OBCINE.LABELS)) {
            obcineLayers.push(LAYER_IDS.OBCINE.LABELS);
        }
        this.removeLayerAndSource(obcineLayers, SOURCE_IDS.OBCINE);
    }
}

export default LayerManager;