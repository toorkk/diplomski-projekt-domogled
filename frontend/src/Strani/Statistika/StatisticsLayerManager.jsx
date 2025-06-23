// managers/StatisticsLayerManager.js
import {
    LAYER_IDS,
    SOURCE_IDS,
    ZOOM_STYLES,
    COLOR_SCHEME,
    ZOOM_LEVELS,
    MAP_CONFIG
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
            console.log('Občine already loaded');
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

            console.log('Občine layers added successfully');
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

        // Nastavi prisilni prikaz flag če je izbrana občina z katastri
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

        // Posodobi filter klikov - onemogoči klike na izbrano občino
        if (selectedObcinaId) {
            this.map.setFilter(LAYER_IDS.OBCINE.FILL, [
                '!=', ['get', 'OB_ID'], selectedObcinaId
            ]);
        } else {
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

        console.log('Municipalities hidden - občina nima katastrov');
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
            
            console.log(`Municipalities filtered for občina: ${obcinaName}`);
        } else {
            // Prikaži vse katastre ali jih skrij
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.FILL, null);
            this.map.setFilter(LAYER_IDS.MUNICIPALITIES.OUTLINE, null);
            
            if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
                this.map.setFilter(LAYER_IDS.MUNICIPALITIES.LABELS, null);
            }
            
            console.log('Municipality filters cleared');
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

    // Kontrola vidnosti slojev glede na zoom - odstranjena coloringLoaded referenca
    updateLayerVisibilityByZoom(currentZoom, forceShowMunicipalitiesParam = null, selectedObcinaName = null) {
        const showObcineLabels = currentZoom < ZOOM_LEVELS.OBCINE_THRESHOLD;
        // Odstranjena nedefinirana coloringLoaded spremenljivka
        const showObcineFill = currentZoom < ZOOM_LEVELS.OBCINE_THRESHOLD;
        
        // Če je forceShowMunicipalitiesParam eksplicitno poslan, uporabi to
        // Sicer uporabi internal flag ali zoom logiko
        let shouldShowMunicipalities;
        
        if (forceShowMunicipalitiesParam !== null) {
            // Eksplicitni parameter - nastavi tudi internal flag
            this.forceShowMunicipalities = forceShowMunicipalitiesParam && this.obcinaHasKatastre(selectedObcinaName);
            shouldShowMunicipalities = this.forceShowMunicipalities;
        } else {
            // Če ni eksplicitnega parametra, uporabi logiko
            const zoomBasedShow = currentZoom >= ZOOM_LEVELS.OBCINE_THRESHOLD;
            shouldShowMunicipalities = (zoomBasedShow || this.forceShowMunicipalities) && 
                                     this.obcinaHasKatastre(selectedObcinaName || this.selectedObcinaName);
        }

        // Kontrola vidnosti slojev občin
        if (this.hasLayer(LAYER_IDS.OBCINE.FILL)) {
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.FILL, 'visibility', showObcineFill ? 'visible' : 'none');
            this.map.setLayoutProperty(LAYER_IDS.OBCINE.OUTLINE, 'visibility', 'visible'); // Vedno vidne za kontekst
            
            if (this.hasLayer(LAYER_IDS.OBCINE.LABELS)) {
                this.map.setLayoutProperty(LAYER_IDS.OBCINE.LABELS, 'visibility', showObcineLabels ? 'visible' : 'none');
            }
        }

        // Kontrola vidnosti slojev katastrov
        if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.FILL)) {
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.FILL, 'visibility', shouldShowMunicipalities ? 'visible' : 'none');
            this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.OUTLINE, 'visibility', shouldShowMunicipalities ? 'visible' : 'none');
            
            if (this.hasLayer(LAYER_IDS.MUNICIPALITIES.LABELS)) {
                this.map.setLayoutProperty(LAYER_IDS.MUNICIPALITIES.LABELS, 'visibility', shouldShowMunicipalities ? 'visible' : 'none');
            }
        }

        console.log(`Zoom ${currentZoom}: Občine ${showObcineFill ? 'clickable' : 'disabled'}, Municipalities ${shouldShowMunicipalities ? 'visible' : 'hidden'}, Force: ${this.forceShowMunicipalities}, Selected: ${selectedObcinaName || this.selectedObcinaName}`);
    }
    
    addMunicipalitiesLayers(municipalitiesData) {
        if (this.map.getSource(SOURCE_IDS.MUNICIPALITIES)) {
            console.log('Municipalities already loaded');
            return;
        }

        try {
            // Dodaj podatkovni vir
            this.map.addSource(SOURCE_IDS.MUNICIPALITIES, {
                type: 'geojson',
                data: municipalitiesData
            });

            // Dodaj fill sloj - nevidljiv, za klike
            this.map.addLayer({
                id: LAYER_IDS.MUNICIPALITIES.FILL,
                type: 'fill',
                source: SOURCE_IDS.MUNICIPALITIES,
                paint: {
                    'fill-color': 'transparent',
                    'fill-opacity': 0
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
        console.log('StatisticsLayerManager: Starting cleanup...');

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

        console.log('StatisticsLayerManager: Cleanup completed');
    }
}

export default StatisticsLayerManager;