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
    createMunicipalityOutlineStyle,
    createClusterColorExpression
} from './MapUtils.jsx';

class LayerManager {
    constructor(map) {
        this.map = map;
        
        /* 
         * LAYER Z-ORDER HIERARCHY (bottom to top):
         * 1. Base map
         * 2. Municipalities (katastrske občine) - fill, outline, labels
         * 3. Občine - fill, outline, labels (ABOVE municipalities for context)
         * 4. Properties - circles, text
         * 5. Clusters - circles, count
         * 6. Expanded properties - circles, text
         */
    }

    // Občine layers (for lower zoom levels)
    addObcineLayers(obcineData) {
        if (this.map.getSource(SOURCE_IDS.OBCINE)) {
            console.log('Občine already loaded');
            return;
        }

        try {
            // Add source
            this.map.addSource(SOURCE_IDS.OBCINE, {
                type: 'geojson',
                data: obcineData
            });

            // Add fill layer (invisible, for clicks)
            this.map.addLayer({
                id: LAYER_IDS.OBCINE.FILL,
                type: 'fill',
                source: SOURCE_IDS.OBCINE,
                paint: {
                    'fill-color': 'transparent',
                    'fill-opacity': 0
                },
                layout: {
                    'visibility': 'visible'
                }
            });

            // Add outline layer with improved default styles
            this.map.addLayer({
                id: LAYER_IDS.OBCINE.OUTLINE,
                type: 'line',
                source: SOURCE_IDS.OBCINE,
                paint: {
                    'line-color': COLOR_SCHEME.OBCINA.DEFAULT,
                    'line-width': ZOOM_STYLES.OBCINE.DEFAULT_LINE_WIDTH,
                    'line-opacity': ZOOM_STYLES.OBCINE.DEFAULT_OPACITY
                },
                layout: {
                    'visibility': 'visible'
                }
            });

            // Add labels layer
            this.map.addLayer({
                id: LAYER_IDS.OBCINE.LABELS,
                type: 'symbol',
                source: SOURCE_IDS.OBCINE,
                layout: {
                    'text-field': ['get', 'OB_UIME'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5, 10,
                        7, 12,
                        9, 14
                    ],
                    'text-anchor': 'center',
                    'text-max-width': 8,
                    'text-allow-overlap': false,
                    'text-ignore-placement': false,
                    'text-padding': 2,
                    'visibility': 'visible'
                },
                paint: {
                    'text-color': '#374151',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2,
                    'text-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        5, 0.7,
                        7, 0.9,
                        9, 1
                    ]
                }
            });

            console.log('Občine layers added successfully');
        } catch (error) {
            console.error('Error adding občine layers:', error);
            throw error;
        }
    }

    updateObcinaSelection(selectedObcinaId = null) {
        if (!this.map.getLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        // Update outline style for selected občina
        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'OB_ID'], selectedObcinaId || -1],
            COLOR_SCHEME.OBCINA.SELECTED,
            COLOR_SCHEME.OBCINA.DEFAULT
        ]);

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'OB_ID'], selectedObcinaId || -1],
            ZOOM_STYLES.OBCINE.SELECTED_LINE_WIDTH,
            ZOOM_STYLES.OBCINE.DEFAULT_LINE_WIDTH
        ]);

        // Update opacity for better visibility of selected
        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'OB_ID'], selectedObcinaId || -1],
            1.0,  // Popolna vidnost za selected
            ZOOM_STYLES.OBCINE.DEFAULT_OPACITY
        ]);

        // Update click filter - disable clicks on selected občina, but only control the fill layer
        if (selectedObcinaId) {
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, [
                '!=', ['get', 'OB_ID'], selectedObcinaId
            ]);
        } else {
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, null);
        }
    }

    // NEW: Update občina hover state
    updateObcinaHover(hoveredObcinaId = null) {
        if (!this.map.getLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        // Update outline style for hovered občina
        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'OB_ID'], hoveredObcinaId || -1],
            COLOR_SCHEME.OBCINA.HOVER,
            COLOR_SCHEME.OBCINA.DEFAULT
        ]);

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'OB_ID'], hoveredObcinaId || -1],
            ZOOM_STYLES.OBCINE.HOVER_LINE_WIDTH,
            ZOOM_STYLES.OBCINE.DEFAULT_LINE_WIDTH
        ]);

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'OB_ID'], hoveredObcinaId || -1],
            0.9,  // Povečana vidnost za hover
            ZOOM_STYLES.OBCINE.DEFAULT_OPACITY
        ]);
    }

    // Control visibility based on zoom level
    updateLayerVisibilityByZoom(currentZoom) {
        const showObcineLabels = currentZoom < ZOOM_LEVELS.OBCINE_THRESHOLD;
        const showObcineFill = currentZoom < ZOOM_LEVELS.OBCINE_THRESHOLD; // Only allow clicks when zoomed out
        const showMunicipalities = currentZoom >= ZOOM_LEVELS.OBCINE_THRESHOLD;

        // Control občine layers visibility
        if (this.hasLayer(LAYER_IDS.OBCINE.FILL)) {
            // Fill layer (for clicks) - only when zoomed out
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.FILL, 'visibility', showObcineFill ? 'visible' : 'none');
            
            // Outline layer - ALWAYS visible for context
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.OUTLINE, 'visibility', 'visible');
            
            // Labels layer - only when zoomed out
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.LABELS, 'visibility', showObcineLabels ? 'visible' : 'none');
        }

        // Control municipalities layers visibility
        if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.FILL)) {
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'visibility', showMunicipalities ? 'visible' : 'none');
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'visibility', showMunicipalities ? 'visible' : 'none');
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.LABELS, 'visibility', showMunicipalities ? 'visible' : 'none');
        }

        console.log(`Zoom ${currentZoom}: Občine outline always visible, labels ${showObcineLabels ? 'visible' : 'hidden'}, fill ${showObcineFill ? 'clickable' : 'disabled'}, Municipalities ${showMunicipalities ? 'visible' : 'hidden'}`);
    }
    
    addMunicipalitiesLayers(municipalitiesData) {
        if (this.map.getSource(SOURCE_IDS.MUNICIPALITIES)) {
            console.log('Municipalities already loaded');
            return;
        }

        try {
            // Add source
            this.map.addSource(SOURCE_IDS.MUNICIPALITIES, {
                type: 'geojson',
                data: municipalitiesData
            });

            // Add fill layer (invisible, for clicks)
            this.map.addLayer({
                id: LAYER_IDS.MUNICIPALITIES.FILL,
                type: 'fill',
                source: SOURCE_IDS.MUNICIPALITIES,
                paint: {
                    'fill-color': 'transparent',
                    'fill-opacity': 0
                }
            });

            // Add outline layer with improved default styles
            this.map.addLayer({
                id: LAYER_IDS.MUNICIPALITIES.OUTLINE,
                type: 'line',
                source: SOURCE_IDS.MUNICIPALITIES,
                paint: {
                    'line-color': COLOR_SCHEME.MUNICIPALITY.DEFAULT,
                    'line-width': ZOOM_STYLES.MUNICIPALITIES.LINE_WIDTH,
                    'line-opacity': ZOOM_STYLES.MUNICIPALITIES.LINE_OPACITY
                }
            });

            console.log('Municipalities layers added successfully');
        } catch (error) {
            console.error('Error adding municipalities layers:', error);
            throw error;
        }
    }

    updateMunicipalitySelection(selectedSifko = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.OUTLINE)) return;

        // Use createMunicipalityOutlineStyle for consistent styling
        const outlineStyle = createMunicipalityOutlineStyle(selectedSifko);
        
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-color', outlineStyle['line-color']);
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-width', outlineStyle['line-width']);

        // Update opacity for selected municipality
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            1.0,  // Popolna vidnost za selected
            ZOOM_STYLES.MUNICIPALITIES.LINE_OPACITY
        ]);

        // Update click filter
        if (selectedSifko) {
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, [
                '!=', ['get', 'SIFKO'], selectedSifko
            ]);
        } else {
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, null);
        }
    }

    // NEW: Update municipality hover state
    updateMunicipalityHover(hoveredSifko = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.OUTLINE)) return;

        // Update outline style for hovered municipality
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'SIFKO'], hoveredSifko || -1],
            COLOR_SCHEME.MUNICIPALITY.HOVER,
            COLOR_SCHEME.MUNICIPALITY.DEFAULT
        ]);

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'SIFKO'], hoveredSifko || -1],
            ZOOM_STYLES.MUNICIPALITIES.HOVER_LINE_WIDTH,
            ZOOM_STYLES.MUNICIPALITIES.LINE_WIDTH
        ]);

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'SIFKO'], hoveredSifko || -1],
            1.0,  // Popolna vidnost za hover
            ZOOM_STYLES.MUNICIPALITIES.LINE_OPACITY
        ]);
    }

    // Properties layers
    addPropertiesLayers(features, dataSourceType) {
        this.removePropertiesLayers();

        if (features.length === 0) return;

        const colors = getColorScheme(dataSourceType);

        try {
            // Add source
            this.map.addSource(SOURCE_IDS.PROPERTIES, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: features
                }
            });

            // Add circle layer
            this.map.addLayer({
                id: LAYER_IDS.PROPERTIES.MAIN,
                type: 'circle',
                source: SOURCE_IDS.PROPERTIES,
                paint: {
                    'circle-radius': ZOOM_STYLES.PROPERTIES.CIRCLE_RADIUS,
                    'circle-color': colors.CIRCLE,
                    'circle-opacity': 0.7,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': colors.STROKE
                }
            });

            // Add text layer
            this.map.addLayer({
                id: LAYER_IDS.PROPERTIES.TEXT,
                type: 'symbol',
                source: SOURCE_IDS.PROPERTIES,
                layout: {
                    'text-field': createPriceExpression(dataSourceType),
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': ZOOM_STYLES.PROPERTIES.TEXT_SIZE,
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

            console.log(`Added properties layers with ${features.length} features`);
        } catch (error) {
            console.error('Error adding properties layers:', error);
            throw error;
        }
    }

    removePropertiesLayers() {
        this.removeLayerAndSource(
            [LAYER_IDS.PROPERTIES.TEXT, LAYER_IDS.PROPERTIES.MAIN],
            SOURCE_IDS.PROPERTIES
        );
    }

    // Clusters layers
    addClustersLayers(features, dataSourceType) {
        this.removeClustersLayers();

        if (features.length === 0) return;

        const colors = getColorScheme(dataSourceType);

        try {
            // Add source
            this.map.addSource(SOURCE_IDS.CLUSTERS, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: features
                }
            });

            // Add circle layer
            this.map.addLayer({
                id: LAYER_IDS.CLUSTERS.MAIN,
                type: 'circle',
                source: SOURCE_IDS.CLUSTERS,
                paint: {
                    'circle-radius': ZOOM_STYLES.CLUSTERS.RADIUS,
                    'circle-color': createClusterColorExpression(colors.CLUSTER),
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });

            // Add count layer
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
                    'text-color': '#ffffff'
                }
            });

            console.log(`Added clusters layers with ${features.length} features`);
        } catch (error) {
            console.error('Error adding clusters layers:', error);
            throw error;
        }
    }

    removeClustersLayers() {
        this.removeLayerAndSource(
            [LAYER_IDS.CLUSTERS.COUNT, LAYER_IDS.CLUSTERS.MAIN],
            SOURCE_IDS.CLUSTERS
        );
    }

    // Expanded clusters layers
    addExpandedClusterLayers(clusterId, features, dataSourceType) {
        const sourceId = `${SOURCE_IDS.EXPANDED_PREFIX}${clusterId}`;
        const layerId = `${LAYER_IDS.EXPANDED.PREFIX}${clusterId}`;
        const textLayerId = `${layerId}${LAYER_IDS.EXPANDED.TEXT_SUFFIX}`;

        this.removeExpandedClusterLayers(clusterId);

        const colors = getColorScheme(dataSourceType);

        try {
            // Add source
            this.map.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: features
                }
            });

            // Add circle layer
            this.map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                paint: {
                    'circle-radius': ZOOM_STYLES.EXPANDED.CIRCLE_RADIUS,
                    'circle-color': colors.CIRCLE,
                    'circle-opacity': 0.9,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': colors.STROKE
                }
            });

            // Add text layer
            this.map.addLayer({
                id: textLayerId,
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-field': createPriceExpression(dataSourceType),
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': ZOOM_STYLES.EXPANDED.TEXT_SIZE,
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

            console.log(`Added expanded cluster layers for ${clusterId}`);
            return { layerId, textLayerId };
        } catch (error) {
            console.error(`Error adding expanded cluster layers for ${clusterId}:`, error);
            throw error;
        }
    }

    removeExpandedClusterLayers(clusterId) {
        const sourceId = `${SOURCE_IDS.EXPANDED_PREFIX}${clusterId}`;
        const layerId = `${LAYER_IDS.EXPANDED.PREFIX}${clusterId}`;
        const textLayerId = `${layerId}${LAYER_IDS.EXPANDED.TEXT_SUFFIX}`;

        this.removeLayerAndSource([textLayerId, layerId], sourceId);
    }

    // Utility method for removing layers and sources
    removeLayerAndSource(layerIds, sourceId) {
        const layersArray = Array.isArray(layerIds) ? layerIds : [layerIds];
        
        layersArray.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
        });

        if (this.map.getSource(sourceId)) {
            this.map.removeSource(sourceId);
        }
    }

    // Check if layer exists
    hasLayer(layerId) {
        return !!this.map.getLayer(layerId);
    }

    // Check if source exists
    hasSource(sourceId) {
        return !!this.map.getSource(sourceId);
    }

    // Cleanup all layers
    cleanup() {
        console.log('LayerManager: Starting cleanup...');

        // Remove občine layers
        this.removeLayerAndSource(
            [LAYER_IDS.OBCINE.LABELS, LAYER_IDS.OBCINE.OUTLINE, LAYER_IDS.OBCINE.FILL],
            SOURCE_IDS.OBCINE
        );

        // Remove municipalities layers
        this.removeLayerAndSource(
            [LAYER_IDS.MUNICIPALITIES.LABELS, LAYER_IDS.MUNICIPALITIES.OUTLINE, LAYER_IDS.MUNICIPALITIES.FILL],
            SOURCE_IDS.MUNICIPALITIES
        );

        // Remove properties layers
        this.removePropertiesLayers();

        // Remove clusters layers
        this.removeClustersLayers();

        console.log('LayerManager: Cleanup completed');
    }
}

export default LayerManager;