// managers/StatisticsLayerManager.js
import {
    LAYER_IDS,
    SOURCE_IDS,
    ZOOM_STYLES,
    COLOR_SCHEME,
    ZOOM_LEVELS,
    MAP_CONFIG,
    COLOR_MAPPING_CONFIG
} from './StatisticsMapConstants.jsx';

class StatisticsLayerManager {
    constructor(map) {
        this.map = map;
        this.selectedObcinaName = null; // Dodamo tracking za izbrano občino

        // Lista občin ki imajo katastre
        this.OBCINE_Z_KATASTRI = ['LJUBLJANA', 'MARIBOR'];

        // Flag za prisilni prikaz katastrov
        this.forceShowMunicipalities = false;
    }

    // Dodaj sloje občin za nizke zoom nivoje
    addObcineLayers(obcineData) {
        if (this.map.getSource(SOURCE_IDS.OBCINE)) {
            return;
        }

        try {
            // Dodaj podatkovni vir
            this.map.addSource(SOURCE_IDS.OBCINE, {
                type: 'geojson',
                data: obcineData
            });

            // Dodaj fill sloj - nevidljiv, za klike
            this.map.addLayer({
                id: LAYER_IDS.OBCINE.FILL,
                type: 'fill',
                source: SOURCE_IDS.OBCINE,
                paint: {
                    'fill-color': 'rgba(220, 220, 220, 0.3)',
                    'fill-opacity': 1
                },
                layout: {
                    'visibility': 'visible'
                }
            });

            // Dodaj obrobe sloj z izboljšanimi privzetimi stili
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

        } catch (error) {
            console.error('Error adding občine layers:', error);
            throw error;
        }
    }

    // Preveri ali občina ima katastre
    obcinaHasKatastre(obcinaName) {
        if (!obcinaName) return false;
        return this.OBCINE_Z_KATASTRI.includes(obcinaName.toUpperCase());
    }

    updateObcinaSelection(selectedObcinaId = null, selectedObcinaName = null) {
        if (!this.map.getLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        // Shrani ime izbrane občine za filtriranje katastrov
        this.selectedObcinaName = selectedObcinaName;

        // Nastavi prisilni prikaz flag samo če je izbrana občina z katastri
        this.forceShowMunicipalities = this.obcinaHasKatastre(selectedObcinaName);

        // Posodobi obrobni stil za izbrano občino
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

        // Posodobi prosojnost za boljšo vidnost izbrane občine
        this.map.setPaintProperty(LAYER_IDS.OBCINE.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'OB_ID'], selectedObcinaId || -1],
            1.0,
            ZOOM_STYLES.OBCINE.DEFAULT_OPACITY
        ]);

        // NOVA LOGIKA: Filter klikov samo za občine z katastri
        if (selectedObcinaId && this.obcinaHasKatastre(selectedObcinaName)) {
            // Če ima občina katastre, onemogoči klike (kot prej)
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, [
                '!=', ['get', 'OB_ID'], selectedObcinaId
            ]);
        } else {
            // Če občina nima katastrov ali ni izbrane občine, omogoči vse klike
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, null);
        }

        // Filtriraj katastre samo če občina ima katastre
        if (this.obcinaHasKatastre(selectedObcinaName)) {
            this.filterMunicipalitiesByObcina(selectedObcinaName);
        } else {
            // Če občina nima katastrov, jih skrij
            this.hideMunicipalities();
            this.forceShowMunicipalities = false;
        }
    }

    // Skrij katastre
    hideMunicipalities() {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.FILL)) return;

        // Skrij vse katastre
        this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'visibility', 'none');
        this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'visibility', 'none');

        if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.LABELS, 'visibility', 'none');
        }
    }

    // Filtriraj katastre glede na občino
    filterMunicipalitiesByObcina(obcinaName = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.FILL)) return;

        if (obcinaName && this.obcinaHasKatastre(obcinaName)) {
            // Prikaži samo katastre ki spadajo pod izbrano občino
            const filter = ['==', ['get', 'OBCINA'], obcinaName.toUpperCase()];

            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, filter);
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.OUTLINE, filter);

            // Prikaži sloje
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'visibility', 'visible');
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'visibility', 'visible');

            if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
                this.map.setFilter(LAYER_IDS.MUNICIPALITIES.LABELS, filter);
                this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.LABELS, 'visibility', 'visible');
            }

        } else {
            // Prikaži vse katastre ali jih skrij
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, null);
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.OUTLINE, null);

            if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
                this.map.setFilter(LAYER_IDS.MUNICIPALITIES.LABELS, null);
            }
        }
    }

    // Posodobi hover stanje občine
    updateObcinaHover(hoveredObcinaId = null) {
        if (!this.map.getLayer(LAYER_IDS.OBCINE.OUTLINE)) return;

        // Posodobi obrobni stil za hover občino
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
            0.9,
            ZOOM_STYLES.OBCINE.DEFAULT_OPACITY
        ]);
    }

    // ========================================
    // OPTIMIZIRANA updateLayerVisibilityByZoom
    // ========================================

    // Helper metoda za določitev ali naj se prikaže municipalities
    _calculateMunicipalitiesVisibility(currentZoom, forceParam, selectedObcinaName) {
        const obcinaName = selectedObcinaName || this.selectedObcinaName;
        const hasKatastre = this.obcinaHasKatastre(obcinaName);

        // Če ni katastrov, ne prikaži
        if (!hasKatastre) return false;

        // Če je eksplicitni parameter, uporabi tega
        if (forceParam !== null) {
            this.forceShowMunicipalities = forceParam;
            return this.forceShowMunicipalities;
        }

        // Sicer uporabi zoom logiko ali force flag
        const zoomBasedShow = currentZoom >= ZOOM_LEVELS.OBCINE_THRESHOLD;
        return zoomBasedShow || this.forceShowMunicipalities;
    }

    // Helper metoda za nastavljanje vidnosti posameznega sloja
    _setLayerVisibility(layerId, isVisible) {
        if (this.hasLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
        }
    }

    // Helper metoda za kreiranje visibility konfiguracije
    _createVisibilityConfig(currentZoom, forceParam, selectedObcinaName) {
        const isLowZoom = currentZoom < ZOOM_LEVELS.OBCINE_THRESHOLD;
        const shouldShowMunicipalities = this._calculateMunicipalitiesVisibility(
            currentZoom,
            forceParam,
            selectedObcinaName
        );

        // POPRAVKA: Občine fill layer naj bo viden:
        // 1. Pri nizkem zoom-u (kot prej)
        // 2. Če je izbrana občina (ne glede na to ali ima katastre)
        const shouldShowObcineFill = isLowZoom || !!this.selectedObcinaName;

        return {
            obcine: {
                fill: shouldShowObcineFill, // Spremenjeno - viden tudi za občine brez katastrov
                outline: true, // Vedno vidne za kontekst
                labels: isLowZoom
            },
            municipalities: {
                fill: shouldShowMunicipalities,
                outline: shouldShowMunicipalities,
                labels: shouldShowMunicipalities
            }
        };
    }

    // Helper metoda za aplikacijo visibility konfiguracije
    _applyVisibilityConfig(config) {
        // Nastavi občine
        this._setLayerVisibility(LAYER_IDS.OBCINE.FILL, config.obcine.fill);
        this._setLayerVisibility(LAYER_IDS.OBCINE.OUTLINE, config.obcine.outline);
        this._setLayerVisibility(LAYER_IDS.OBCINE.LABELS, config.obcine.labels);

        // Nastavi municipalities
        this._setLayerVisibility(LAYER_IDS.MUNICIPALITIES.FILL, config.municipalities.fill);
        this._setLayerVisibility(LAYER_IDS.MUNICIPALITIES.OUTLINE, config.municipalities.outline);
        this._setLayerVisibility(LAYER_IDS.MUNICIPALITIES.LABELS, config.municipalities.labels);
    }

    // Glavna funkcija - sedaj drastično poenostavljena
    updateLayerVisibilityByZoom(currentZoom, forceShowMunicipalitiesParam = null, selectedObcinaName = null) {
        const config = this._createVisibilityConfig(currentZoom, forceShowMunicipalitiesParam, selectedObcinaName);
        this._applyVisibilityConfig(config);
    }

    // ========================================
    // OSTALE FUNKCIJE - POSODOBLJENE ZA BARVANJE
    // ========================================

    addMunicipalitiesLayers(municipalitiesData) {
        if (this.map.getSource(SOURCE_IDS.MUNICIPALITIES)) {
            return;
        }

        try {
            // Dodaj podatkovni vir
            this.map.addSource(SOURCE_IDS.MUNICIPALITIES, {
                type: 'geojson',
                data: municipalitiesData
            });

            // Dodaj fill sloj - VIDLJIV za barvanje (namesto transparent)
            this.map.addLayer({
                id: LAYER_IDS.MUNICIPALITIES.FILL,
                type: 'fill',
                source: SOURCE_IDS.MUNICIPALITIES,
                paint: {
                    'fill-color': 'rgba(255, 255, 255, 0.8)', // Spremeni na belo
                    'fill-opacity': 0.8 // Vidna prosojnost za barvanje
                },
                layout: {
                    'visibility': 'none' // Na začetku skrit, prikaže se z zoom ali selection
                }
            });

            // Dodaj obrobe sloj z izboljšanimi privzetimi stili
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
                    'visibility': 'none' // Na začetku skrit
                }
            });

        } catch (error) {
            console.error('Error adding municipalities layers:', error);
            throw error;
        }
    }

    // POPRAVLJENA metoda za barvanje katastrov z boljšim error handling-om
    updateMunicipalitiesFillColors(colorExpression) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.FILL)) {
            console.warn('Municipalities fill layer not found');
            return;
        }

        try {
            // Preveri ali je colorExpression veljaven
            if (!colorExpression || !Array.isArray(colorExpression)) {
                console.warn('Invalid color expression, using default color');
                this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'fill-color', 'rgba(255, 255, 255, 0.8)');
                return;
            }

            // Preveri če ima expression dovolj argumentov
            if (colorExpression.length < 3) {
                console.warn('Color expression too short, using default color');
                this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'fill-color', 'rgba(255, 255, 255, 0.8)');
                return;
            }

            // Aplikacija color expression
            this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'fill-color', colorExpression);
            this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'fill-opacity', 0.8);

            console.log('Municipality colors updated successfully');

        } catch (error) {
            console.error('Error updating municipality fill colors:', error);
            // Fallback na osnovne barve
            this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'fill-color', COLOR_MAPPING_CONFIG.DEFAULT_FALLBACK);
        }
    }

    updateMunicipalitySelection(selectedSifko = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.OUTLINE)) return;

        // Posodobi obrobni stil za izbrani kataster
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-color', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            COLOR_SCHEME.MUNICIPALITY.SELECTED,
            COLOR_SCHEME.MUNICIPALITY.DEFAULT
        ]);

        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-width', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            3,
            ZOOM_STYLES.MUNICIPALITIES.LINE_WIDTH
        ]);

        // Posodobi prosojnost za izbrani kataster
        this.map.setPaintProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'line-opacity', [
            'case',
            ['==', ['get', 'SIFKO'], selectedSifko || -1],
            1.0,
            ZOOM_STYLES.MUNICIPALITIES.LINE_OPACITY
        ]);

        // Posodobi filter klikov za katastre - samo če ni izbrane občine
        if (selectedSifko && !this.selectedObcinaName) {
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, [
                '!=', ['get', 'SIFKO'], selectedSifko
            ]);
        } else if (!this.selectedObcinaName) {
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, null);
        }
        // Če je izbrana občina, pusti filter kot je - samo katastri te občine
    }

    // Posodobi hover stanje katastra
    updateMunicipalityHover(hoveredSifko = null) {
        if (!this.map.getLayer(LAYER_IDS.MUNICIPALITIES.OUTLINE)) return;

        // Posodobi obrobni stil za hover kataster
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
            1.0,
            ZOOM_STYLES.MUNICIPALITIES.LINE_OPACITY
        ]);
    }

    // Resetiraj filtre
    resetFilters() {
        this.selectedObcinaName = null;
        this.forceShowMunicipalities = false; // Resetiraj tudi prisilni flag
        this.filterMunicipalitiesByObcina(null);
    }

    // Pomožna metoda za odstranjevanje slojev in virov
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

    hasLayer(layerId) {
        return !!this.map.getLayer(layerId);
    }

    hasSource(sourceId) {
        return !!this.map.getSource(sourceId);
    }

    // Počisti vse sloje
    cleanup() {
        // Resetiraj stanje
        this.selectedObcinaName = null;
        this.forceShowMunicipalities = false; // Resetiraj tudi prisilni flag

        // Odstrani sloje občin
        this.removeLayerAndSource(
            [LAYER_IDS.OBCINE.LABELS, LAYER_IDS.OBCINE.OUTLINE, LAYER_IDS.OBCINE.FILL],
            SOURCE_IDS.OBCINE
        );

        // Odstrani sloje katastrov
        this.removeLayerAndSource(
            [LAYER_IDS.MUNICIPALITIES.LABELS, LAYER_IDS.MUNICIPALITIES.OUTLINE, LAYER_IDS.MUNICIPALITIES.FILL],
            SOURCE_IDS.MUNICIPALITIES
        );
    }
}

export default StatisticsLayerManager;