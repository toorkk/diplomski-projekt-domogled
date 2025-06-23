import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import debounce from "lodash/debounce";

// Importanje managerjev
import LayerManager from "./StatisticsLayerManager.jsx";
import {
    MAP_CONFIG,
    ZOOM_LEVELS,
    SOURCE_IDS,
    LAYER_IDS
} from './StatisticsMapConstants.jsx';

//Importanje vseh utils
import {
    getMunicipalityName,
    getObcinaName,
    getObcinaId,
    calculateBoundsFromGeometry
} from './StatisticsMapUtils.jsx';

// Stili in JSON podatki (katastri, občine)
import '../Stili/Zemljevid.css';
import municipalitiesData from '../../Občine/Katastri_Maribor_Ljubljana.json';
import obcineData from '../../Občine/OB.json';

export default function StatisticsZemljevid({ 
    onMunicipalitySelect, 
    onObcinaSelect, 
    selectedMunicipality, 
    selectedObcina,
    selectedRegionFromNavigation,
    activeTab = 'prodaja'
}) {
    // Refs
    const mapContainer = useRef(null);
    const map = useRef(null);
    const layerManager = useRef(null);

    // States
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [hoveredMunicipality, setHoveredMunicipality] = useState(null);
    
    // Novi states za barvanje občin
    const [obcinePosliData, setObcinePosliData] = useState(null);
    const [coloringLoaded, setColoringLoaded] = useState(false);
    
    // 🔧 POPRAVLJEN State za shranjevanje prejšnjega zoom/center
    const [previousMapState, setPreviousMapState] = useState({
        center: MAP_CONFIG.INITIAL_CENTER,
        zoom: MAP_CONFIG.INITIAL_ZOOM
    });

    // Lista občin z katastri
    const OBCINE_Z_KATASTRI = ['LJUBLJANA', 'MARIBOR'];

    // Preverimo ali občina ima katastre
    const obcinaHasKatastre = (obcinaName) => {
        if (!obcinaName) return false;
        return OBCINE_Z_KATASTRI.includes(obcinaName.toUpperCase());
    };

    // ===========================================
    // EFFECT ZA PRAVILNO SHRANJEVANJE STANJA
    // ===========================================
    useEffect(() => {
        if (map.current && !selectedObcina && !selectedMunicipality) {
            // Shrani trenutno stanje samo če ni nobene regije izbrane
            const currentCenter = map.current.getCenter();
            const currentZoom = map.current.getZoom();
            
            setPreviousMapState({
                center: [currentCenter.lng, currentCenter.lat],
                zoom: currentZoom
            });
            
        }
    }, [map.current?.loaded, selectedObcina, selectedMunicipality]);

    // ===========================================
    // API FUNKCIJE ZA PRIDOBITEV PODATKOV O POSLIH
    // ===========================================

    const fetchObcinePosliData = async () => {
        try {
            
            // Poskusi najprej z 2025, potem z latest
            let response = await fetch('http://localhost:8000/api/statistike/vse-obcine-posli-2025');
            
            if (!response.ok) {
                console.warn('2025 data not available, trying latest year...');
                response = await fetch('http://localhost:8000/api/statistike/vse-obcine-posli-latest');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                setObcinePosliData(data.obcine_posli);
                return data.obcine_posli;
            } else {
                throw new Error(data.message || 'Napaka pri pridobivanju podatkov o poslih');
            }
        } catch (error) {
            console.error('Napaka pri pridobivanju podatkov o poslih:', error);
            return null;
        }
    };

    // ===========================================
    // PERCENTILNE FUNKCIJE ZA BARVANJE OBČIN
    // ===========================================

    // Levenshtein distance za closest string match
    const levenshteinDistance = (str1, str2) => {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    };

    // Najdi najbližje ime občine
    const findClosestObcinaName = (geojsonName, apiNames) => {
        const geojsonUpper = geojsonName.toUpperCase();
        
        // Najprej poskusi exact match
        if (apiNames.includes(geojsonUpper)) {
            return geojsonUpper;
        }
        
        // Če ne najde exact match, poišči najbližjega
        let closestName = null;
        let minDistance = Infinity;
        
        for (const apiName of apiNames) {
            const distance = levenshteinDistance(geojsonUpper, apiName);
            if (distance < minDistance && distance <= 2) { // Maksimalno 2 znaka razlike
                minDistance = distance;
                closestName = apiName;
            }
        }
        
        return closestName;
    };

    // Percentil funkcija za barvanje
    const getColorForValuePercentiles = (value, allValues, colorType = 'prodaja') => {
        if (!value || value === 0) return 'rgba(200, 200, 200, 0.3)'; // Siva za 0
        
        // Izračunaj percentile iz vseh vrednosti (samo pozitivne)
        const sortedValues = allValues.filter(v => v > 0).sort((a, b) => a - b);
        
        if (sortedValues.length === 0) return 'rgba(200, 200, 200, 0.3)';
        
        const p20 = sortedValues[Math.floor(sortedValues.length * 0.2)] || 0;
        const p40 = sortedValues[Math.floor(sortedValues.length * 0.4)] || 0;
        const p60 = sortedValues[Math.floor(sortedValues.length * 0.6)] || 0;
        const p80 = sortedValues[Math.floor(sortedValues.length * 0.8)] || 0;
                
        // Določi barvo glede na percentil
        if (colorType === 'prodaja') {
            if (value <= p20) return 'rgba(219, 234, 254, 0.8)';      // Najnižjih 20% - zelo svetlo modra
            else if (value <= p40) return 'rgba(147, 197, 253, 0.8)'; // 20-40% - svetlo modra
            else if (value <= p60) return 'rgba(59, 130, 246, 0.8)';  // 40-60% - srednja modra
            else if (value <= p80) return 'rgba(37, 99, 235, 0.8)';   // 60-80% - temna modra
            else return 'rgba(29, 78, 216, 0.9)';                     // Najvišjih 20% - zelo temna modra
        } else {
            if (value <= p20) return 'rgba(209, 250, 229, 0.8)';      // Najnižjih 20% - zelo svetlo zelena
            else if (value <= p40) return 'rgba(110, 231, 183, 0.8)'; // 20-40% - svetlo zelena
            else if (value <= p60) return 'rgba(16, 185, 129, 0.8)';  // 40-60% - srednja zelena
            else if (value <= p80) return 'rgba(5, 150, 105, 0.8)';   // 60-80% - temna zelena
            else return 'rgba(4, 120, 87, 0.9)';                      // Najvišjih 20% - zelo temna zelena
        }
    };

    // Pridobitev vrednosti za legendo
    const getColorScalePercentiles = (colorType = 'prodaja', percentileStats = null) => {

        // Dejanske vrednosti iz statistik
        if (colorType === 'prodaja') {
            return [
                { range: '0', color: 'rgba(200, 200, 200, 0.3)', label: '0 prodaj' },
                { range: `1-${percentileStats.p20}`, color: 'rgba(219, 234, 254, 0.8)', label: `1-${percentileStats.p20} prodaj` },
                { range: `${percentileStats.p20 + 1}-${percentileStats.p40}`, color: 'rgba(147, 197, 253, 0.8)', label: `${percentileStats.p20 + 1}-${percentileStats.p40} prodaj` },
                { range: `${percentileStats.p40 + 1}-${percentileStats.p60}`, color: 'rgba(59, 130, 246, 0.8)', label: `${percentileStats.p40 + 1}-${percentileStats.p60} prodaj` },
                { range: `${percentileStats.p60 + 1}-${percentileStats.p80}`, color: 'rgba(37, 99, 235, 0.8)', label: `${percentileStats.p60 + 1}-${percentileStats.p80} prodaj` },
                { range: `${percentileStats.p80 + 1}+`, color: 'rgba(29, 78, 216, 0.9)', label: `${percentileStats.p80 + 1}+ prodaj` }
            ];
        } else {
            return [
                { range: '0', color: 'rgba(200, 200, 200, 0.3)', label: '0 najemov' },
                { range: `1-${percentileStats.p20}`, color: 'rgba(209, 250, 229, 0.8)', label: `1-${percentileStats.p20} najemov` },
                { range: `${percentileStats.p20 + 1}-${percentileStats.p40}`, color: 'rgba(110, 231, 183, 0.8)', label: `${percentileStats.p20 + 1}-${percentileStats.p40} najemov` },
                { range: `${percentileStats.p40 + 1}-${percentileStats.p60}`, color: 'rgba(16, 185, 129, 0.8)', label: `${percentileStats.p40 + 1}-${percentileStats.p60} najemov` },
                { range: `${percentileStats.p60 + 1}-${percentileStats.p80}`, color: 'rgba(5, 150, 105, 0.8)', label: `${percentileStats.p60 + 1}-${percentileStats.p80} najemov` },
                { range: `${percentileStats.p80 + 1}+`, color: 'rgba(4, 120, 87, 0.9)', label: `${percentileStats.p80 + 1}+ najemov` }
            ];
        }
    };

    // Funkcija za barve percentilov
    const updateObcineFillColors = useCallback((activeTabParam = activeTab) => {
        if (!map.current || !obcinePosliData || !map.current.getLayer(LAYER_IDS.OBCINE.FILL)) {
            return;
        }

        // Pridobi vse vrednosti za izračun percentil
        const allValues = [];
        const nameMapping = new Map();
        const mappingDetails = [];
        
        // Ustvari mapping in zberi vse vrednosti
        const apiNames = Object.keys(obcinePosliData);
        
        obcineData.features.forEach(feature => {
            const geojsonName = feature.properties.OB_UIME;
            const closestApiName = findClosestObcinaName(geojsonName, apiNames);
            
            if (closestApiName) {
                nameMapping.set(geojsonName, closestApiName);
                const value = obcinePosliData[closestApiName][activeTabParam]?.skupaj || 0;
                
                mappingDetails.push({
                    geojsonName,
                    apiName: closestApiName,
                    value,
                    match: geojsonName === closestApiName ? 'EXACT' : 'FUZZY'
                });
                
                if (value > 0) allValues.push(value);
            } else {
                mappingDetails.push({
                    geojsonName,
                    apiName: 'NO_MATCH',
                    value: 0,
                    match: 'FAILED'
                });
            }
        });

        // Izračunaj in prikaži statistike
        const sortedValues = allValues.sort((a, b) => a - b);
        const stats = {
            count: allValues.length,
            min: Math.min(...allValues),
            max: Math.max(...allValues),
            median: sortedValues[Math.floor(sortedValues.length / 2)],
            avg: Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length),
            p20: sortedValues[Math.floor(sortedValues.length * 0.2)],
            p40: sortedValues[Math.floor(sortedValues.length * 0.4)],
            p60: sortedValues[Math.floor(sortedValues.length * 0.6)],
            p80: sortedValues[Math.floor(sortedValues.length * 0.8)]
        };

        // Shrani statistike za legendo
        window.currentPercentileStats = stats; // Globalno dostopne statistike

        // Ustvari expression za mapbox style
        const colorExpression = ['case'];
        
        nameMapping.forEach((apiName, geojsonName) => {
            const obcinaData = obcinePosliData[apiName];
            const value = obcinaData[activeTabParam]?.skupaj || 0;
            
            // 🎯 UPORABI PERCENTILNO BARVANJE
            const color = getColorForValuePercentiles(value, allValues, activeTabParam);
            
            colorExpression.push(['==', ['get', 'OB_UIME'], geojsonName]);
            colorExpression.push(color);
        });
        
        // Default color za občine brez podatkov
        colorExpression.push('rgba(200, 200, 200, 0.1)');

        // Aplikacija na mapi
        map.current.setFilter(LAYER_IDS.OBCINE.FILL, null);
        map.current.setPaintProperty(LAYER_IDS.OBCINE.FILL, 'fill-color', colorExpression);
        map.current.setPaintProperty(LAYER_IDS.OBCINE.FILL, 'fill-opacity', 0.8);
        map.current.setLayoutProperty(LAYER_IDS.OBCINE.FILL, 'visibility', 'visible');

        setColoringLoaded(true);
    }, [obcinePosliData, activeTab]);

    // ===========================================
    // EFFECT ZA SPREMINJANJE BARV PRI SWITCHU TABOV
    // ===========================================

    useEffect(() => {
        if (obcinePosliData && obcineLoaded) {
            updateObcineFillColors(activeTab);
        }
    }, [activeTab, obcinePosliData, obcineLoaded, updateObcineFillColors]);

    // ===========================================
    // NOVI EFFECTS ZA AVTOMATSKI ZOOM
    // ===========================================

    useEffect(() => {
        if (selectedMunicipality && municipalitiesLoaded && layerManager.current && 
            selectedRegionFromNavigation?.autoZoomToRegion && 
            selectedRegionFromNavigation.type === 'katastrska_obcina') {
            
            const municipalityFeature = municipalitiesData.features.find(
                feature => feature.properties.SIFKO === selectedMunicipality.sifko
            );
            
            if (municipalityFeature) {
                
                const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);
                
                if (selectedObcina) {
                    map.current.fitBounds(bounds, {
                        padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
                        duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
                        essential: true
                    });
                }
            }
        }
    }, [selectedMunicipality, municipalitiesLoaded, selectedRegionFromNavigation, selectedObcina]);

    useEffect(() => {
        if (selectedObcina && obcineLoaded && layerManager.current && 
            selectedRegionFromNavigation?.autoZoomToRegion && 
            selectedRegionFromNavigation.type === 'obcina') {
            
            const obcinaFeature = obcineData.features.find(
                feature => getObcinaId(feature) === selectedObcina.obcinaId
            );
            
            if (obcinaFeature) {
                
                const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);
                
                const hasKatastre = obcinaHasKatastre(selectedObcina.name);
                if (hasKatastre) {
                    layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, selectedObcina.name);
                }

                map.current.fitBounds(bounds, {
                    padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
                    duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
                    essential: true
                });

                map.current.setMaxBounds(bounds);

                const overlayLayerId = 'obcina-mask';
                const sourceId = SOURCE_IDS.OBCINE;

                if (!map.current.getLayer(overlayLayerId)) {
                    map.current.addLayer({
                        id: overlayLayerId,
                        type: 'fill',
                        source: sourceId,
                        paint: {
                            'fill-color': 'rgba(0, 0, 0, 0.6)',
                            'fill-opacity': [
                                'case',
                                ['==', ['get', 'OB_ID'], selectedObcina.obcinaId],
                                0,
                                1
                            ]
                        }
                    }, LAYER_IDS.OBCINE.OUTLINE);
                } else {
                    map.current.setPaintProperty(overlayLayerId, 'fill-opacity', [
                        'case',
                        ['==', ['get', 'OB_ID'], selectedObcina.obcinaId],
                        0,
                        1
                    ]);
                }
                
                layerManager.current.updateObcinaSelection(
                    selectedObcina.obcinaId, 
                    selectedObcina.name
                );
            }
        }
    }, [selectedObcina, obcineLoaded, selectedRegionFromNavigation]);

    // ===========================================
    // KATASTER IN REGION HANDLERJI
    // ===========================================

    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);

        setHoveredMunicipality(null);
        if (layerManager.current) {
            layerManager.current.updateMunicipalityHover(null);
        }

        const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);

        const municipalityData = {
            name: municipalityName,
            sifko: sifko,
            bounds: bounds
        };

        if (onMunicipalitySelect) {
            onMunicipalitySelect(municipalityData);
        }

    }, [onMunicipalitySelect]);

    // handleObcinaClick funkcija
    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) {
            return;
        }

        // Shrani trenutno stanje SAMO če še ni občine izbrane
        if (!selectedObcina) {
            const currentCenter = map.current.getCenter();
            const currentZoom = map.current.getZoom();
            
            setPreviousMapState({
                center: [currentCenter.lng, currentCenter.lat],
                zoom: currentZoom
            });
            
        }

        setHoveredRegion(null);
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
        }

        const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);

        const obcinaData = {
            name: obcinaName,
            obcinaId: obcinaId,
            bounds: bounds
        };

        if (onObcinaSelect) {
            onObcinaSelect(obcinaData);
        }

        const hasKatastre = obcinaHasKatastre(obcinaName);
        if (layerManager.current) {
            if (hasKatastre) {
                layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, obcinaName);
            } else {
                layerManager.current.hideMunicipalities();
            }
        }

        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });

        map.current.setMaxBounds(bounds);

        const overlayLayerId = 'obcina-mask';
        const sourceId = SOURCE_IDS.OBCINE;

        if (!map.current.getLayer(overlayLayerId)) {
            map.current.addLayer({
                id: overlayLayerId,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': 'rgba(0, 0, 0, 0.6)',
                    'fill-opacity': [
                        'case',
                        ['==', ['get', 'OB_ID'], obcinaId],
                        0,
                        1
                    ]
                }
            }, LAYER_IDS.OBCINE.OUTLINE);
        } else {
            map.current.setPaintProperty(overlayLayerId, 'fill-opacity', [
                'case',
                ['==', ['get', 'OB_ID'], obcinaId],
                0,
                1
            ]);
        }
    }, [selectedObcina, onObcinaSelect]);

    // ===========================================
    // MAP LAYER MANAGEMENT
    // ===========================================

    const loadObcine = useCallback(async () => {
        if (!map.current || obcineLoaded || !layerManager.current) return;

        try {

            layerManager.current.addObcineLayers(obcineData);
            setupObcinaEventHandlers();

            setObcineLoaded(true);

            const posliData = await fetchObcinePosliData();
            if (posliData) {

            }

        } catch (error) {
            console.error('Error loading občine:', error);
        }
    }, [obcineLoaded]);

    const loadMunicipalities = useCallback(() => {
        if (!map.current || municipalitiesLoaded || !layerManager.current) return;

        try {

            layerManager.current.addMunicipalitiesLayers(municipalitiesData);
            setupMunicipalityEventHandlers();

            setMunicipalitiesLoaded(true);
            console.log('Municipalities layer loaded successfully');

        } catch (error) {
            console.error('Error loading municipalities:', error);
        }
    }, [municipalitiesLoaded]);

    // handleReset funkcija
    const handleReset = useCallback(() => {
        
        setHoveredRegion(null);
        setHoveredMunicipality(null);

        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
            layerManager.current.updateMunicipalityHover(null);
            layerManager.current.resetFilters();
        }

        const overlayLayerId = 'obcina-mask';
        if (map.current.getLayer(overlayLayerId)) {
            map.current.removeLayer(overlayLayerId);
        }

        // Odstrani maxBounds omejitev
        map.current.setMaxBounds(null);

        if (layerManager.current) {
            layerManager.current.updateLayerVisibilityByZoom(previousMapState.zoom, false, null);
        }

        if (obcinePosliData) {
            updateObcineFillColors(activeTab);
        }

        const resetCenter = previousMapState.center && previousMapState.center.length === 2 
            ? previousMapState.center 
            : MAP_CONFIG.INITIAL_CENTER;
        
        const resetZoom = previousMapState.zoom && previousMapState.zoom > 0 
            ? previousMapState.zoom 
            : MAP_CONFIG.INITIAL_ZOOM;

        map.current.flyTo({
            center: resetCenter,
            zoom: resetZoom,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
        });

        if (onMunicipalitySelect) {
            onMunicipalitySelect(null);
        }
        if (onObcinaSelect) {
            onObcinaSelect(null);
        }
    }, [onMunicipalitySelect, onObcinaSelect, obcinePosliData, activeTab, updateObcineFillColors, previousMapState]);

    // ===========================================
    // EVENT HANDLERJI
    // ===========================================

    const setupObcinaEventHandlers = useCallback(() => {
        if (!map.current) return;

        let currentHoveredObcinaId = null;

        const hoverMoveHandler = (e) => {
            const hoveredObcinaId = e.features[0]?.properties?.OB_ID;
            const hoveredObcinaName = e.features[0]?.properties?.OB_UIME;

            if (hoveredObcinaId !== currentHoveredObcinaId) {
                currentHoveredObcinaId = hoveredObcinaId;

                if (!selectedObcina || selectedObcina.obcinaId !== hoveredObcinaId) {
                    map.current.getCanvas().style.cursor = 'pointer';

                    let hoverInfo = {
                        name: hoveredObcinaName,
                        type: 'Občina'
                    };

                    if (obcinePosliData) {
                        // Uporabi closest match za hover podatke
                        const apiNames = Object.keys(obcinePosliData);
                        const closestApiName = findClosestObcinaName(hoveredObcinaName, apiNames);
                        
                        if (closestApiName && obcinePosliData[closestApiName]) {
                            const posliInfo = obcinePosliData[closestApiName][activeTab];
                            hoverInfo.posli = posliInfo?.skupaj || 0;
                            hoverInfo.activeTab = activeTab;
                        }
                    }

                    setHoveredRegion(hoverInfo);

                    if (layerManager.current) {
                        layerManager.current.updateObcinaHover(hoveredObcinaId);
                    }
                }
            }
        };

        const hoverLeaveHandler = () => {
            currentHoveredObcinaId = null;
            map.current.getCanvas().style.cursor = '';
            setHoveredRegion(null);

            if (layerManager.current) {
                layerManager.current.updateObcinaHover(null);
            }
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredRegion(null);
                if (layerManager.current) {
                    layerManager.current.updateObcinaHover(null);
                }
                handleObcinaClick(e.features[0]);
            }
        };

        map.current.on('mousemove', 'obcine-fill', hoverMoveHandler);
        map.current.on('mouseleave', 'obcine-fill', hoverLeaveHandler);
        map.current.on('click', 'obcine-fill', clickHandler);

        map.current._obcinaHandlers = {
            hoverMoveHandler,
            hoverLeaveHandler,
            clickHandler
        };
    }, [selectedObcina, handleObcinaClick, obcinePosliData, activeTab]);

    const setupMunicipalityEventHandlers = useCallback(() => {
        if (!map.current) return;

        let currentHoveredSifko = null;

        const debouncedHoverUpdate = debounce((hoveredSifko, hoveredMunicipalityName) => {
            if (!selectedMunicipality || selectedMunicipality.sifko !== hoveredSifko) {
                setHoveredMunicipality({
                    name: hoveredMunicipalityName,
                    type: 'Kataster'
                });

                if (layerManager.current) {
                    layerManager.current.updateMunicipalityHover(hoveredSifko);
                }
            }
        }, 30);

        const hoverMoveHandler = (e) => {
            const hoveredSifko = e.features[0]?.properties?.SIFKO;
            const hoveredMunicipalityName = getMunicipalityName(e.features[0]);

            if (!hoveredSifko || hoveredSifko === currentHoveredSifko) return;

            currentHoveredSifko = hoveredSifko;
            map.current.getCanvas().style.cursor = 'pointer';

            debouncedHoverUpdate(hoveredSifko, hoveredMunicipalityName);
        };

        const hoverLeaveHandler = () => {
            currentHoveredSifko = null;
            map.current.getCanvas().style.cursor = '';
            setHoveredMunicipality(null);

            debouncedHoverUpdate.cancel();

            if (layerManager.current) {
                layerManager.current.updateMunicipalityHover(null);
            }
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredMunicipality(null);
                debouncedHoverUpdate.cancel();

                if (layerManager.current) {
                    layerManager.current.updateMunicipalityHover(null);
                }

                handleMunicipalityClick(e.features[0]);
            }
        };

        map.current.on('mousemove', 'municipalities-fill', hoverMoveHandler);
        map.current.on('mouseleave', 'municipalities-fill', hoverLeaveHandler);
        map.current.on('click', 'municipalities-fill', clickHandler);

        map.current._municipalityHandlers = {
            hoverMoveHandler,
            hoverLeaveHandler,
            clickHandler
        };
    }, [selectedMunicipality, handleMunicipalityClick]);

    const setupZoomHandler = () => {
        const handleZoomEnd = () => {
            const currentZoom = map.current.getZoom();

            if (layerManager.current) {
                if (selectedObcina) {

                    return;
                } else {
                    layerManager.current.updateLayerVisibilityByZoom(currentZoom, null, null);
                }
            }
        };

        map.current.on('zoomend', handleZoomEnd);
        map.current._zoomEndHandler = handleZoomEnd;
    };

    // ===========================================
    // UTILITY FUNKCIJE
    // ===========================================

    const cleanup = () => {
        if (map.current) {
            if (map.current._zoomEndHandler) {
                map.current.off('zoomend', map.current._zoomEndHandler);
            }

            if (map.current._obcinaHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._obcinaHandlers;
                map.current.off('mousemove', 'obcine-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'obcine-fill', hoverLeaveHandler);
                map.current.off('click', 'obcine-fill', clickHandler);
                delete map.current._obcinaHandlers;
            }

            if (map.current._municipalityHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._municipalityHandlers;
                map.current.off('mousemove', 'municipalities-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'municipalities-fill', hoverLeaveHandler);
                map.current.off('click', 'municipalities-fill', clickHandler);
                delete map.current._municipalityHandlers;
            }

            if (layerManager.current) {
                layerManager.current.cleanup();
            }

            map.current.remove();
            map.current = null;
        }
    };

    // ===========================================
    // EFFECTS
    // ===========================================

    useEffect(() => {
        if (map.current && layerManager.current) {
            layerManager.current.updateMunicipalitySelection(selectedMunicipality?.sifko);
        }
    }, [selectedMunicipality]);

    useEffect(() => {
        if (map.current && layerManager.current) {
            layerManager.current.updateObcinaSelection(
                selectedObcina?.obcinaId, 
                selectedObcina?.name
            );
        }
    }, [selectedObcina]);

    // Inicializacija mape
    useEffect(() => {
        if (!map.current && mapContainer.current) {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: MAP_CONFIG.STYLE_URL,
                center: MAP_CONFIG.INITIAL_CENTER,
                zoom: MAP_CONFIG.INITIAL_ZOOM,
                minZoom: 2,
                maxZoom: 15,
                attributionControl: false,
                scrollZoom: false,
                boxZoom: false,
                doubleClickZoom: false,
                touchZoomRotate: false,
                dragRotate: false,
                keyboard: false,
                touchPitch: false,
                dragPan: false
            });

            map.current.on('load', () => {
                layerManager.current = new LayerManager(map.current);
                loadObcine();
                loadMunicipalities();
                layerManager.current.updateLayerVisibilityByZoom(MAP_CONFIG.INITIAL_ZOOM, false, null);
                setupZoomHandler();
                
                setPreviousMapState({
                    center: MAP_CONFIG.INITIAL_CENTER,
                    zoom: MAP_CONFIG.INITIAL_ZOOM
                });
            });
        }

        return cleanup;
    }, []);

    // Legenda za barvno shemo
    const PercentileLegend = () => {
        if (!coloringLoaded || selectedObcina || selectedMunicipality) return null;
        
        // Uporabi shranjene statistike ali fallback
        const stats = window.currentPercentileStats || null;
        const colorScale = getColorScalePercentiles(activeTab, stats);
        
        return (
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-3">
                <div className="text-xs font-medium text-gray-700 mb-3">
                    {activeTab === 'prodaja' ? 'Prodaje za leto' : 'Najemi za leto' } (2025)
                </div>
                <div className="space-y-2">
                    {colorScale.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <div 
                                className="w-4 h-3 rounded border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="text-xs text-gray-600 min-w-0">
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
                {stats && (
                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        Občin z podatki: {stats.count} | Povprečje: {stats.avg}
                    </div>
                )}
            </div>
        );
    };

    // ===========================================
    // RENDER
    // ===========================================

    return (
        <div className="relative w-full h-full">
            <div
                ref={mapContainer}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 0
                }}
            />

            {/* Hover preview box za občine z informacijami o poslih */}
            {hoveredRegion && !selectedMunicipality && !selectedObcina && (
                <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 font-medium">
                            {hoveredRegion.type}:
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                            {hoveredRegion.name}
                        </span>
                    </div>
                    {hoveredRegion.posli !== undefined && (
                        <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500">
                                {hoveredRegion.activeTab === 'prodaja' ? 'Prodaje' : 'Najemi'}:
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                                {hoveredRegion.posli}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Hover preview box za katastrske občine */}
            {hoveredMunicipality && selectedObcina && !selectedMunicipality && 
             obcinaHasKatastre(selectedObcina.name) && (
                <div className="absolute bottom-16 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 font-medium">
                            {hoveredMunicipality.type}:
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                            {hoveredMunicipality.name}
                        </span>
                    </div>
                </div>
            )}

            {/* Indikator ce je izbrana obcina ali kataster */}
            {(selectedMunicipality || selectedObcina) && (
                <div className="absolute bottom-4 right-4 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 max-w-sm">
                    <div className="flex items-center justify-between space-x-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-gray-700 truncate">
                                    {selectedMunicipality
                                        ? `Kataster: ${selectedMunicipality.name}`
                                        : `Občina: ${selectedObcina.name}`
                                    }
                                </span>
                                {selectedObcina && !obcinaHasKatastre(selectedObcina.name) && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        Brez katastrov
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Legenda za barve*/}
            <PercentileLegend />
        </div>
    );
}