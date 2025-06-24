import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import debounce from "lodash/debounce";

import LayerManager from "./StatisticsLayerManager.jsx";
import {
    MAP_CONFIG,
    SOURCE_IDS,
    LAYER_IDS,
    PERCENTILE_COLOR_PALETTES,
    COLOR_MAPPING_CONFIG
} from './StatisticsMapConstants.jsx';

import {
    getMunicipalityName,
    getObcinaName,
    getObcinaId,
    calculateBoundsFromGeometry
} from './StatisticsMapUtils.jsx';

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
    // Reference
    const mapContainer = useRef(null);
    const map = useRef(null);
    const layerManager = useRef(null);

    // Stanja za nalaganje podatkov
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [coloringLoaded, setColoringLoaded] = useState(false);
    
    // Stanja za hover efekte
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [hoveredMunicipality, setHoveredMunicipality] = useState(null);
    
    // Podatki za barvanje
    const [obcinePosliData, setObcinePosliData] = useState(null);
    const [katastrskePosliData, setKatastrskePosliData] = useState(null);
    
    // Shranjeno stanje mape pred zoomom
    const [previousMapState, setPreviousMapState] = useState({
        center: MAP_CONFIG.INITIAL_CENTER,
        zoom: MAP_CONFIG.INITIAL_ZOOM
    });

    // Preveri ali občina podpira katastre
    const obcinaHasKatastre = (obcinaName) => {
        if (!obcinaName) return false;
        return COLOR_MAPPING_CONFIG.SUPPORTED_MUNICIPALITIES.includes(obcinaName.toUpperCase());
    };

    // Shranjevanje stanja mape pred zoomom
    useEffect(() => {
        if (map.current && !selectedObcina && !selectedMunicipality) {
            const currentCenter = map.current.getCenter();
            const currentZoom = map.current.getZoom();
            
            setPreviousMapState({
                center: [currentCenter.lng, currentCenter.lat],
                zoom: currentZoom
            });
        }
    }, [map.current?.loaded, selectedObcina, selectedMunicipality]);

    // Pridobitev podatkov o poslih iz API
    const fetchObcinePosliData = async () => {
        try {
            let response = await fetch('http://localhost:8000/api/statistike/vse-obcine-posli-2025?vkljuci_katastrske=true');
            
            if (!response.ok) {
                response = await fetch('http://localhost:8000/api/statistike/vse-obcine-posli-latest?vkljuci_katastrske=true');
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'success') {
                setObcinePosliData(data.obcine_posli);
                setKatastrskePosliData(data.katastrske_obcine_posli || {});
                return { obcine: data.obcine_posli, katastrske: data.katastrske_obcine_posli };
            } else {
                throw new Error(data.message || 'Napaka pri pridobivanju podatkov');
            }
        } catch (error) {
            console.error('Napaka pri pridobivanju podatkov o poslih:', error);
            return null;
        }
    };

    // Levenshtein razdalja za podobnost imen
    const levenshteinDistance = (str1, str2) => {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
        
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

    // Iskanje najbližjega imena v API podatkih
    const findClosestName = (geojsonName, apiNames, maxDistance = 2) => {
        const geojsonUpper = geojsonName.toUpperCase();
        
        if (apiNames.includes(geojsonUpper)) {
            return geojsonUpper;
        }
        
        let closestName = null;
        let minDistance = Infinity;
        
        for (const apiName of apiNames) {
            const distance = levenshteinDistance(geojsonUpper, apiName);
            if (distance < minDistance && distance <= maxDistance) {
                minDistance = distance;
                closestName = apiName;
            }
        }
        
        return closestName;
    };

    // Določitev barve na podlagi percentila
    const getColorForValuePercentiles = (value, allValues, colorType = 'prodaja') => {
        // Če je vrednost 0, vrni belo barvo namesto sive
        if (!value || value === 0) return 'rgba(255, 255, 255, 0.8)'; // Bela barva
        
        const sortedValues = allValues.filter(v => v > 0).sort((a, b) => a - b);
        if (sortedValues.length === 0) return 'rgba(255, 255, 255, 0.8)'; // Bela barva
        
        const [p20, p40, p60, p80] = COLOR_MAPPING_CONFIG.PERCENTILE_THRESHOLDS.map(threshold => 
            sortedValues[Math.floor(sortedValues.length * threshold)] || 0
        );
        
        const getPercentileRange = (val) => {
            if (val <= p20) return 0;
            if (val <= p40) return 1; 
            if (val <= p60) return 2;
            if (val <= p80) return 3;
            return 4;
        };
        
        return PERCENTILE_COLOR_PALETTES[colorType][getPercentileRange(value)];
    };

    // Generiranje podatkov za legendo
    const getColorScalePercentiles = (colorType = 'prodaja', percentileStats = null) => {
        const isRental = colorType === 'najem';
        const unit = isRental ? 'najemov' : 'prodaj';
        const colors = isRental ? PERCENTILE_COLOR_PALETTES.najem : PERCENTILE_COLOR_PALETTES.prodaja;
        
        return [
            { range: '0', color: 'rgba(255, 255, 255, 0.8)', label: `0 ${unit}` }, // Bela barva za 0
            { range: `1-${percentileStats?.p20 || '?'}`, color: colors[0], label: `1-${percentileStats?.p20 || '?'} ${unit}` },
            { range: `${(percentileStats?.p20 || 0) + 1}-${percentileStats?.p40 || '?'}`, color: colors[1], label: `${(percentileStats?.p20 || 0) + 1}-${percentileStats?.p40 || '?'} ${unit}` },
            { range: `${(percentileStats?.p40 || 0) + 1}-${percentileStats?.p60 || '?'}`, color: colors[2], label: `${(percentileStats?.p40 || 0) + 1}-${percentileStats?.p60 || '?'} ${unit}` },
            { range: `${(percentileStats?.p60 || 0) + 1}-${percentileStats?.p80 || '?'}`, color: colors[3], label: `${(percentileStats?.p60 || 0) + 1}-${percentileStats?.p80 || '?'} ${unit}` },
            { range: `${(percentileStats?.p80 || 0) + 1}+`, color: colors[4], label: `${(percentileStats?.p80 || 0) + 1}+ ${unit}` }
        ];
    };

    // Posodobitev barv občin
    const updateObcineFillColors = useCallback((activeTabParam = activeTab) => {
        if (!map.current || !obcinePosliData || !map.current.getLayer(LAYER_IDS.OBCINE.FILL)) {
            return;
        }

        const allValues = [];
        const nameMapping = new Map();
        const apiNames = Object.keys(obcinePosliData);
        
        obcineData.features.forEach(feature => {
            const geojsonName = feature.properties.OB_UIME;
            const closestApiName = findClosestName(geojsonName, apiNames);
            
            if (closestApiName) {
                nameMapping.set(geojsonName, closestApiName);
                const value = obcinePosliData[closestApiName][activeTabParam]?.skupaj || 0;
                if (value > 0) allValues.push(value);
            }
        });

        // Izračun statistik za legendo
        const sortedValues = allValues.sort((a, b) => a - b);
        const stats = {
            count: allValues.length,
            avg: Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length),
            p20: sortedValues[Math.floor(sortedValues.length * 0.2)],
            p40: sortedValues[Math.floor(sortedValues.length * 0.4)],
            p60: sortedValues[Math.floor(sortedValues.length * 0.6)],
            p80: sortedValues[Math.floor(sortedValues.length * 0.8)]
        };

        window.currentPercentileStats = stats;

        // Ustvarjanje color expression za mapbox
        const colorExpression = ['case'];
        
        nameMapping.forEach((apiName, geojsonName) => {
            const obcinaData = obcinePosliData[apiName];
            const value = obcinaData[activeTabParam]?.skupaj || 0;
            const color = getColorForValuePercentiles(value, allValues, activeTabParam);
            
            colorExpression.push(['==', ['get', 'OB_UIME'], geojsonName]);
            colorExpression.push(color);
        });
        
        colorExpression.push(COLOR_MAPPING_CONFIG.DEFAULT_FALLBACK);

        map.current.setFilter(LAYER_IDS.OBCINE.FILL, null);
        map.current.setPaintProperty(LAYER_IDS.OBCINE.FILL, 'fill-color', colorExpression);
        map.current.setPaintProperty(LAYER_IDS.OBCINE.FILL, 'fill-opacity', 0.8);
        map.current.setLayoutProperty(LAYER_IDS.OBCINE.FILL, 'visibility', 'visible');

        setColoringLoaded(true);
    }, [obcinePosliData, activeTab]);

    // Posodobitev barv katastrskih občin
    const updateMunicipalitiesFillColors = useCallback((activeTabParam = activeTab) => {
        if (!map.current || !katastrskePosliData || !map.current.getLayer(LAYER_IDS.MUNICIPALITIES.FILL)) {
            return;
        }

        const allValues = [];
        const nameMapping = new Map();
        const apiNames = Object.keys(katastrskePosliData);
        
        municipalitiesData.features.forEach(feature => {
            const geojsonName = feature.properties.NAZIV || feature.properties.IMEKO;
            
            if (geojsonName) {
                const closestApiName = findClosestName(geojsonName, apiNames, 3);
                
                if (closestApiName) {
                    nameMapping.set(geojsonName, closestApiName);
                    const value = katastrskePosliData[closestApiName][activeTabParam]?.skupaj || 0;
                    if (value > 0) allValues.push(value);
                }
            }
        });

        const colorExpression = ['case'];
        let hasValidMappings = false;
        
        nameMapping.forEach((apiName, geojsonName) => {
            const municipalityData = katastrskePosliData[apiName];
            const value = municipalityData[activeTabParam]?.skupaj || 0;
            const color = getColorForValuePercentiles(value, allValues, activeTabParam);
            
            colorExpression.push(['==', ['get', 'NAZIV'], geojsonName]);
            colorExpression.push(color);
            hasValidMappings = true;
        });
        
        colorExpression.push(COLOR_MAPPING_CONFIG.DEFAULT_FALLBACK);

        if (!hasValidMappings || colorExpression.length < 3) {
            if (layerManager.current) {
                layerManager.current.updateMunicipalitiesFillColors(null);
            }
            return;
        }

        if (layerManager.current) {
            layerManager.current.updateMunicipalitiesFillColors(colorExpression);
        }
    }, [katastrskePosliData, activeTab]);

    // Učinki za spreminjanje barv pri menjavi tabov
    useEffect(() => {
        if (obcinePosliData && obcineLoaded) {
            updateObcineFillColors(activeTab);
        }
    }, [activeTab, obcinePosliData, obcineLoaded, updateObcineFillColors]);

    useEffect(() => {
        if (katastrskePosliData && municipalitiesLoaded) {
            updateMunicipalitiesFillColors(activeTab);
        }
    }, [activeTab, katastrskePosliData, municipalitiesLoaded, updateMunicipalitiesFillColors]);

    // Avtomatski zoom na izbrano regijo iz navigacije
    useEffect(() => {
        if (selectedMunicipality && municipalitiesLoaded && layerManager.current && 
            selectedRegionFromNavigation?.autoZoomToRegion && 
            selectedRegionFromNavigation.type === 'katastrska_obcina') {
            
            const municipalityFeature = municipalitiesData.features.find(
                feature => feature.properties.SIFKO === selectedMunicipality.sifko
            );
            
            if (municipalityFeature && selectedObcina) {
                const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);
                map.current.fitBounds(bounds, {
                    padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
                    duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
                    essential: true
                });
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
                addObcinaMask(selectedObcina.obcinaId);
                layerManager.current.updateObcinaSelection(selectedObcina.obcinaId, selectedObcina.name);
            }
        }
    }, [selectedObcina, obcineLoaded, selectedRegionFromNavigation]);

    // Dodaj masko za izbrano občino
    const addObcinaMask = (obcinaId) => {
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
    };

    // Klik na katastrsko občino
    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);

        setHoveredMunicipality(null);
        if (layerManager.current) {
            layerManager.current.updateMunicipalityHover(null);
        }

        const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);

        // Zagotovi da katastrski sloji ostanejo vidni po kliku
        if (layerManager.current && selectedObcina) {
            layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, selectedObcina.name);
        }

        if (onMunicipalitySelect) {
            onMunicipalitySelect({
                name: municipalityName,
                sifko: sifko,
                bounds: bounds,
                preserveObcina: true // Dodamo flag da naj se občina ohrani
            });
        }
    }, [onMunicipalitySelect, selectedObcina]);

    // Klik na občino
    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) return;

        // Shrani trenutno stanje samo če še ni občine izbrane
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
        const hasKatastre = obcinaHasKatastre(obcinaName);

        if (onObcinaSelect) {
            onObcinaSelect({
                name: obcinaName,
                obcinaId: obcinaId,
                bounds: bounds
            });
        }

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
        addObcinaMask(obcinaId);
    }, [selectedObcina, onObcinaSelect]);

    // Naložitev podatkov občin
    const loadObcine = useCallback(async () => {
        if (!map.current || obcineLoaded || !layerManager.current) return;

        try {
            layerManager.current.addObcineLayers(obcineData);
            setupObcinaEventHandlers();
            setObcineLoaded(true);
            await fetchObcinePosliData();
        } catch (error) {
            console.error('Napaka pri nalaganju občin:', error);
        }
    }, [obcineLoaded]);

    // Naložitev podatkov katastrskih občin
    const loadMunicipalities = useCallback(() => {
        if (!map.current || municipalitiesLoaded || !layerManager.current) return;

        try {
            layerManager.current.addMunicipalitiesLayers(municipalitiesData);
            setupMunicipalityEventHandlers();
            setMunicipalitiesLoaded(true);
        } catch (error) {
            console.error('Napaka pri nalaganju katastrskih občin:', error);
        }
    }, [municipalitiesLoaded]);

    // Resetiranje izbire
    const handleReset = useCallback(() => {
        setHoveredRegion(null);
        setHoveredMunicipality(null);

        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
            layerManager.current.updateMunicipalityHover(null);
            layerManager.current.resetFilters();
        }

        // Odstrani masko občine
        const overlayLayerId = 'obcina-mask';
        if (map.current.getLayer(overlayLayerId)) {
            map.current.removeLayer(overlayLayerId);
        }

        map.current.setMaxBounds(null);

        if (layerManager.current) {
            layerManager.current.updateLayerVisibilityByZoom(previousMapState.zoom, false, null);
        }

        // Obnovi barve
        if (obcinePosliData) updateObcineFillColors(activeTab);
        if (katastrskePosliData) updateMunicipalitiesFillColors(activeTab);

        // Vrni na prejšnje stanje
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

        if (onMunicipalitySelect) onMunicipalitySelect(null);
        if (onObcinaSelect) onObcinaSelect(null);
    }, [onMunicipalitySelect, onObcinaSelect, obcinePosliData, katastrskePosliData, activeTab, updateObcineFillColors, updateMunicipalitiesFillColors, previousMapState]);

    // Event handlerji za občine
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
                        const apiNames = Object.keys(obcinePosliData);
                        const closestApiName = findClosestName(hoveredObcinaName, apiNames);
                        
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

        map.current._obcinaHandlers = { hoverMoveHandler, hoverLeaveHandler, clickHandler };
    }, [selectedObcina, handleObcinaClick, obcinePosliData, activeTab]);

    // Event handlerji za katastrske občine
    const setupMunicipalityEventHandlers = useCallback(() => {
        if (!map.current) return;

        let currentHoveredSifko = null;

        const debouncedHoverUpdate = debounce((hoveredSifko, hoveredMunicipalityName) => {
            if (!selectedMunicipality || selectedMunicipality.sifko !== hoveredSifko) {
                let hoverInfo = {
                    name: hoveredMunicipalityName,
                    type: 'Kataster'
                };

                if (katastrskePosliData) {
                    const municipalityName = hoveredMunicipalityName.split('(')[0].trim();
                    const apiNames = Object.keys(katastrskePosliData);
                    const closestApiName = findClosestName(municipalityName, apiNames, 3);
                    
                    if (closestApiName && katastrskePosliData[closestApiName]) {
                        const posliInfo = katastrskePosliData[closestApiName][activeTab];
                        hoverInfo.posli = posliInfo?.skupaj || 0;
                        hoverInfo.activeTab = activeTab;
                    }
                }

                setHoveredMunicipality(hoverInfo);

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

        map.current._municipalityHandlers = { hoverMoveHandler, hoverLeaveHandler, clickHandler };
    }, [selectedMunicipality, handleMunicipalityClick, katastrskePosliData, activeTab]);

    // Handler za zoom spremembe
    const setupZoomHandler = () => {
        const handleZoomEnd = () => {
            const currentZoom = map.current.getZoom();

            if (layerManager.current && !selectedObcina) {
                layerManager.current.updateLayerVisibilityByZoom(currentZoom, null, null);
            }
        };

        map.current.on('zoomend', handleZoomEnd);
        map.current._zoomEndHandler = handleZoomEnd;
    };

    // Čiščenje event handlerjev
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

    // Posodabljanje izbire občine/katastra
    useEffect(() => {
        if (map.current && layerManager.current) {
            layerManager.current.updateMunicipalitySelection(selectedMunicipality?.sifko);
            
            // Če je izbran kataster, zagotovi da katastrski sloji ostanejo vidni
            if (selectedMunicipality && selectedObcina) {
                layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, selectedObcina.name);
            }
        }
    }, [selectedMunicipality, selectedObcina]);

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

    // Komponenta za legendo
    const PercentileLegenda = () => {
        if (!coloringLoaded || selectedObcina || selectedMunicipality) return null;
        
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
                                className={`w-4 h-3 rounded flex-shrink-0 ${
                                    item.color === 'rgba(255, 255, 255, 0.8)' 
                                        ? 'border-2 border-gray-300' 
                                        : 'border border-gray-300'
                                }`}
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

            {/* Hover predogled za občine */}
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

            {/* Hover predogled za katastrske občine */}
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
                    {hoveredMunicipality.posli !== undefined && (
                        <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-500">
                                {hoveredMunicipality.activeTab === 'prodaja' ? 'Prodaje' : 'Najemi'}:
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                                {hoveredMunicipality.posli}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Indikator izbrane regije */}
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

            {/* Legenda za barvno shemo */}
            <PercentileLegenda />
        </div>
    );
}