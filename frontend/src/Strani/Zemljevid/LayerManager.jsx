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
         * 2. Občine - fill, outline, labels (ALWAYS visible for context)
         * 3. Municipalities (katastrske občine) - fill, outline, labels (ONLY for Ljubljana/Maribor)
         * 4. Properties - circles, text
         * 5. Clusters - circles, count
         * 6. Expanded properties - circles, text
         */
    }

    // Občine layers (ALWAYS visible)
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

            // Add outline layer - ALWAYS visible
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
            3.0,  // Selected line width
            1.2   // Default line width
        ]);

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'OB_ID'], selectedObcinaId || -1],
            1.0,  // Selected opacity
            0.6   // Default opacity
        ]);

        // Update click filter
        if (selectedObcinaId) {
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, [
                '!=', ['get', 'OB_ID'], selectedObcinaId
            ]);
        } else {
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, null);
        }
    }

    updateObcinaHover(hoveredObcinaId = null) {
        if (!this.map.getLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'OB_ID'], hoveredObcinaId || -1],
            COLOR_SCHEME.OBCINA.HOVER,
            COLOR_SCHEME.OBCINA.DEFAULT
        ]);

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'OB_ID'], hoveredObcinaId || -1],
            2.5,  // Hover line width
            1.2   // Default line width
        ]);

        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'OB_ID'], hoveredObcinaId || -1],
            0.9,  // Hover opacity
            0.6   // Default opacity
        ]);
    }

    // NEW: Filter municipalities data to only include Ljubljana and Maribor
    filterMunicipalitiesForSpecificObcine(municipalitiesData) {
        return {
            ...municipalitiesData,
            features: municipalitiesData.features.filter(feature => {
                const obcina = feature.properties.OBCINA;
                return obcina === 'LJUBLJANA' || obcina === 'MARIBOR';
            })
        };
    }

    // Municipalities layers (ONLY for Ljubljana and Maribor)
    addMunicipalitiesLayers(municipalitiesData) {
        if (this.map.getSource(SOURCE_IDS.MUNICIPALITIES)) {
            console.log('Municipalities already loaded');
            return;
        }

        try {
            // Filter data to only include Ljubljana and Maribor katastri
            const filteredData = this.filterMunicipalitiesForSpecificObcine(municipalitiesData);
            
            console.log(`Filtered municipalities: ${filteredData.features.length} out of ${municipalitiesData.features.length} total`);

            // Add source with filtered data
            this.map.addSource(SOURCE_IDS.MUNICIPALITIES, {
                type: 'geojson',
                data: filteredData
            });

            // Add fill layer (invisible, for clicks)
            this.map.addLayer({
                id: LAYER_IDS.MUNICIPALITIES.FILL,
                type: 'fill',
                source: SOURCE_IDS.MUNICIPALITIES,
                paint: {
                    'fill-color': 'transparent',
                    'fill-opacity': 0
                },
                layout: {
                    'visibility': 'visible'
                }
            });

            // Add outline layer - ALWAYS visible when katastri are loaded
            this.map.addLayer({
                id: LAYER_IDS.MUNICIPALITIES.OUTLINE,
                type: 'line',
                source: SOURCE_IDS.MUNICIPALITIES,
                paint: {
                    'line-color': COLOR_SCHEME.MUNICIPALITY.DEFAULT,
                    'line-width': ZOOM_STYLES.MUNICIPALITIES.LINE_WIDTH,
                    'line-opacity': ZOOM_STYLES.MUNICIPALITIES.LINE_OPACITY
                },
                layout: {
                    'visibility': 'visible'
                }
            });

            console.log('Municipalities layers added successfully (Ljubljana & Maribor only)');
        } catch (error) {
            console.error('Error adding municipalities layers:', error);
            throw error;
        }
    }

    // NEW: Updated visibility logic - občine always visible, katastri for Ljubljana/Maribor always visible when zoom is high enough
    updateLayerVisibilityByZoom(currentZoom) {
        // Občine are ALWAYS visible
        if (this.hasLayer(LAYER_IDS.OBCINE.FILL)) {
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.FILL, 'visibility', 'visible');
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.OUTLINE, 'visibility', 'visible');
            
            // Labels only at lower zoom levels
            if (this.hasLayer(LAYER_IDS.OBCINE.LABELS)) {
                const showObcineLabels = currentZoom < ZOOM_LEVELS.OBCINE_THRESHOLD;
                this.map.setLayoutProperty(LAYER_IDS.OBCINE.LABELS, 'visibility', showObcineLabels ? 'visible' : 'none');
            }
        }

        // Katastri (municipalities) visible when zoom is high enough for detail
        const showMunicipalities = currentZoom >= ZOOM_LEVELS.MUNICIPALITY_DETAIL;
        
        if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.FILL)) {
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'visibility', showMunicipalities ? 'visible' : 'none');
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'visibility', showMunicipalities ? 'visible' : 'none');
            
            if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
                this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.LABELS, 'visibility', showMunicipalities ? 'visible' : 'none');
            }
        }

        console.log(`Zoom ${currentZoom}: Občine always visible, Katastri (Ljubljana/Maribor) ${showMunicipalities ? 'visible' : 'hidden'}`);
    }

    updateMunicipalitySelection(selectedSifko = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.OUTLINE)) return;

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            COLOR_SCHEME.MUNICIPALITY.SELECTED,
            COLOR_SCHEME.MUNICIPALITY.DEFAULT
        ]);
        
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            2.5,  // Selected line width
            1.0   // Default line width
        ]);

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            1.0,  // Selected opacity
            0.7   // Default opacity
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

    updateMunicipalityHover(hoveredSifko = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.OUTLINE)) return;

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'SIFKO'], hoveredSifko || -1],
            COLOR_SCHEME.MUNICIPALITY.HOVER,
            COLOR_SCHEME.MUNICIPALITY.DEFAULT
        ]);

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'SIFKO'], hoveredSifko || -1],
            2.0,  // Hover line width
            1.0   // Default line width
        ]);

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'SIFKO'], hoveredSifko || -1],
            1.0,  // Hover opacity
            0.7   // Default opacity
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
                    'circle-stroke-color': "#ffffff"
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
                    'circle-stroke-width': 1.5,
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
                    'text-color': '#ffffff',
                    'text-halo-color': colors.STROKE,
                    'text-halo-width': 1
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
                    'circle-opacity': 0.7,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': "#ffffff"
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
        const obcineLayers = [LAYER_IDS.OBCINE.FILL, LAYER_IDS.OBCINE.OUTLINE];
        if (this.hasLayer(LAYER_IDS.OBCINE.LABELS)) {
            obcineLayers.push(LAYER_IDS.OBCINE.LABELS);
        }
        this.removeLayerAndSource(obcineLayers, SOURCE_IDS.OBCINE);

        // Remove municipalities layers  
        const municipalityLayers = [LAYER_IDS.MUNICIPALITIES.FILL, LAYER_IDS.MUNICIPALITIES.OUTLINE];
        if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
            municipalityLayers.push(LAYER_IDS.MUNICIPALITIES.LABELS);
        }
        this.removeLayerAndSource(municipalityLayers, SOURCE_IDS.MUNICIPALITIES);

        // Remove properties layers
        this.removePropertiesLayers();

        // Remove clusters layers
        this.removeClustersLayers();

        console.log('LayerManager: Cleanup completed');
    }
}

export default LayerManager;