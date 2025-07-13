import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import debounce from "lodash/debounce";
import { API_CONFIG } from '../Zemljevid/MapConstants.jsx';

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
import { useIsMobile } from "../../hooks/useIsMobile.jsx";

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

    // Stanja
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [coloringLoaded, setColoringLoaded] = useState(false);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [hoveredMunicipality, setHoveredMunicipality] = useState(null);
    const [viewMode, setViewMode] = useState('posli');

    // Mobile stanja - poenostavljeno (samo občine)
    const isMobile = useIsMobile();
    const [selectedObcinaDropdown, setSelectedObcinaDropdown] = useState('');

    // Nova stanja za cursor tooltip
    const [cursorTooltip, setCursorTooltip] = useState(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Podatki za barvanje
    const [obcinePosliData, setObcinePosliData] = useState(null);
    const [katastrskePosliData, setKatastrskePosliData] = useState(null);
    const [obcineCeneData, setObcineCeneData] = useState(null);
    const [katastrskeCeneData, setKatastrskeCeneData] = useState(null);

    // Kontinuirano sledenje stanja zemljevida
    const [currentMapState, setCurrentMapState] = useState({
        center: MAP_CONFIG.INITIAL_CENTER,
        zoom: MAP_CONFIG.INITIAL_ZOOM
    });

    const [previousMapState, setPreviousMapState] = useState({
        center: MAP_CONFIG.INITIAL_CENTER,
        zoom: MAP_CONFIG.INITIAL_ZOOM
    });

    // Event listener za kontinuirano sledenje sprememb zemljevida
    useEffect(() => {
        if (!map.current) return;

        const updateCurrentMapState = () => {
            const center = map.current.getCenter();
            const zoom = map.current.getZoom();

            const newState = {
                center: [center.lng, center.lat],
                zoom: zoom
            };

            setCurrentMapState(newState);
        };

        // Posodobi ob vsakem premiku ali zoom-u
        map.current.on('moveend', updateCurrentMapState);
        map.current.on('zoomend', updateCurrentMapState);

        // Posodobi takoj ob nastavitvi
        updateCurrentMapState();

        return () => {
            if (map.current) {
                map.current.off('moveend', updateCurrentMapState);
                map.current.off('zoomend', updateCurrentMapState);
            }
        };
    }, [map.current?.loaded]);

    // Pripravi podatke za dropdown
    const getObcineOptions = () => {
        if (!obcineData) return [];

        const options = obcineData.features
            .map(feature => ({
                id: getObcinaId(feature),
                name: getObcinaName(feature),
                feature: feature
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'sl'));

        return options;
    };

    const getKatastriOptions = (obcinaName) => {
        if (!municipalitiesData || !obcinaName) return [];

        const supportedMunicipalities = COLOR_MAPPING_CONFIG.SUPPORTED_MUNICIPALITIES;
        if (!supportedMunicipalities.includes(obcinaName.toUpperCase())) {
            return [];
        }

        return municipalitiesData.features
            .filter(feature => {
                const municipalityName = getMunicipalityName(feature);
                return municipalityName.toLowerCase().includes(obcinaName.toLowerCase());
            })
            .map(feature => ({
                sifko: feature.properties.SIFKO,
                name: getMunicipalityName(feature),
                feature: feature
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'sl'));
    };

    // Mobile dropdown handler - poenostavljen
    const handleObcinaDropdownChange = (obcinaId) => {
        const allOptions = getObcineOptions();

        setSelectedObcinaDropdown(obcinaId);

        if (!obcinaId) {
            onObcinaSelect?.(null);
            return;
        }

        const obcinaOption = allOptions.find(opt => opt.id.toString() === obcinaId.toString());
        if (obcinaOption) {
            const obcinaIdValue = getObcinaId(obcinaOption.feature);
            const obcinaName = getObcinaName(obcinaOption.feature);
            const bounds = calculateBoundsFromGeometry(obcinaOption.feature.geometry);

            const obcinaData = {
                name: obcinaName,
                obcinaId: obcinaIdValue,
                bounds: bounds
            };

            if (onObcinaSelect) {
                onObcinaSelect(obcinaData);
            }

            handleObcinaClick(obcinaOption.feature);
        }
    };

    // Mobile Overlay Component - poenostavljen brez katastrov
    const MobileOverlay = () => {
        if (!isMobile) return null;

        const obcineOptions = getObcineOptions();

        return (
            <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col">
                <div className="flex-1 flex flex-col justify-center px-4 py-6 space-y-6">
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4">
                        <label
                            htmlFor="obcina-select"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Izberite občino:
                        </label>
                        <select
                            id="obcina-select"
                            value={selectedObcinaDropdown}
                            onChange={(e) => handleObcinaDropdownChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            aria-describedby="obcina-help"
                        >
                            <option value="">-- Izberi občino --</option>
                            {obcineOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                </option>
                            ))}
                        </select>
                        <div id="obcina-help" className="sr-only">
                            Izberite občino iz seznama za prikaz podatkov
                        </div>
                    </div>

                    {/* Samo prikaz izbrane občine */}
                    {selectedObcina && (
                        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">
                                        Izbrano:
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Občina: {selectedObcina?.name}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedObcinaDropdown('');
                                        onObcinaSelect?.(null);
                                        handleReset();
                                    }}
                                    className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-red-50 rounded-lg transition-colors"
                                    aria-label="Počisti izbiro občine"
                                >
                                    Počisti
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-3">
                    <p className="text-xs text-center text-gray-500">
                        Interaktivne funkcije so na voljo na računalniku
                    </p>
                </div>
            </div>
        );
    };

    // Utility funkcije
    const obcinaHasKatastre = (obcinaName) => {
        if (!obcinaName) return false;
        return COLOR_MAPPING_CONFIG.SUPPORTED_MUNICIPALITIES.includes(obcinaName.toUpperCase());
    };

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

    const getColorForValuePercentiles = (value, allValues, colorType = 'prodaja') => {
        if (!value || value === 0) return 'rgba(255, 255, 255, 0.8)';

        const sortedValues = allValues.filter(v => v > 0).sort((a, b) => a - b);
        if (sortedValues.length === 0) return 'rgba(255, 255, 255, 0.8)';

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

    // API funkcija
    const fetchAllData = async () => {
        try {
            const [posliResponse, ceneResponse] = await Promise.all([
                fetch(`${API_CONFIG.BASE_URL}/api/statistike/vse-obcine-posli-zadnjih-12m?vkljuci_katastrske=true`),
                fetch(`${API_CONFIG.BASE_URL}/api/statistike/vse-obcine-cene-m2-zadnjih-12m?vkljuci_katastrske=true`)
            ]);

            if (!posliResponse.ok || !ceneResponse.ok) {
                throw new Error(`HTTP error - Posli: ${posliResponse.status}, Cene: ${ceneResponse.status}`);
            }

            const [posliData, ceneData] = await Promise.all([
                posliResponse.json(),
                ceneResponse.json()
            ]);

            if (posliData.status === 'success') {
                setObcinePosliData(posliData.obcine_posli);
                setKatastrskePosliData(posliData.katastrske_obcine_posli || {});
            }

            if (ceneData.status === 'success') {
                setObcineCeneData(ceneData.obcine_cene);
                setKatastrskeCeneData(ceneData.katastrske_obcine_cene || {});
            }

            return { posliData, ceneData };
        } catch (error) {
            console.error('Napaka pri pridobivanju podatkov:', error);
            return null;
        }
    };

    const updateRegionColors = useCallback((
        regionType,
        activeTabParam = activeTab,
        viewModeParam = viewMode
    ) => {
        const isObcine = regionType === 'obcine';
        const layerId = isObcine ? LAYER_IDS.OBCINE.FILL : LAYER_IDS.MUNICIPALITIES.FILL;

        if (!map.current || !map.current.getLayer(layerId)) return;

        const dataSource = viewModeParam === 'cene'
            ? (isObcine ? obcineCeneData : katastrskeCeneData)
            : (isObcine ? obcinePosliData : katastrskePosliData);

        if (!dataSource) return;

        const allValues = [];
        const colorExpression = ['case'];

        if (isObcine) {
            const nameMapping = new Map();
            const apiNames = Object.keys(dataSource);
            const maxDistance = 2;

            obcineData.features.forEach(feature => {
                const geojsonName = feature.properties.OB_UIME;
                if (!geojsonName) return;

                const closestApiName = findClosestName(geojsonName, apiNames, maxDistance);

                if (closestApiName) {
                    nameMapping.set(geojsonName, closestApiName);
                    const value = viewModeParam === 'cene'
                        ? dataSource[closestApiName][activeTabParam]?.skupna_povprecna_cena_m2 || 0
                        : dataSource[closestApiName][activeTabParam]?.skupaj || 0;

                    if (value > 0) allValues.push(value);
                }
            });

            nameMapping.forEach((apiName, geojsonName) => {
                const regionData = dataSource[apiName];
                const value = viewModeParam === 'cene'
                    ? regionData[activeTabParam]?.skupna_povprecna_cena_m2 || 0
                    : regionData[activeTabParam]?.skupaj || 0;

                const color = getColorForValuePercentiles(value, allValues, activeTabParam);

                colorExpression.push(['==', ['get', 'OB_UIME'], geojsonName]);
                colorExpression.push(color);
            });
        } else {
            municipalitiesData.features.forEach(feature => {
                const sifko = feature.properties.SIFKO;
                if (!sifko) return;

                if (dataSource[sifko]) {
                    const value = viewModeParam === 'cene'
                        ? dataSource[sifko][activeTabParam]?.skupna_povprecna_cena_m2 || 0
                        : dataSource[sifko][activeTabParam]?.skupaj || 0;

                    if (value > 0) allValues.push(value);
                }
            });

            municipalitiesData.features.forEach(feature => {
                const sifko = feature.properties.SIFKO;
                if (!sifko || !dataSource[sifko]) return;

                const regionData = dataSource[sifko];
                const value = viewModeParam === 'cene'
                    ? regionData[activeTabParam]?.skupna_povprecna_cena_m2 || 0
                    : regionData[activeTabParam]?.skupaj || 0;

                const color = getColorForValuePercentiles(value, allValues, activeTabParam);

                colorExpression.push(['==', ['get', 'SIFKO'], sifko]);
                colorExpression.push(color);
            });
        }

        colorExpression.push(COLOR_MAPPING_CONFIG.DEFAULT_FALLBACK);

        if (isObcine) {
            const sortedValues = allValues.sort((a, b) => a - b);
            const stats = {
                count: allValues.length,
                avg: Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length),
                p20: sortedValues[Math.floor(sortedValues.length * 0.2)],
                p40: sortedValues[Math.floor(sortedValues.length * 0.4)],
                p60: sortedValues[Math.floor(sortedValues.length * 0.6)],
                p80: sortedValues[Math.floor(sortedValues.length * 0.8)]
            };

            if (typeof window !== "undefined") {
                window.currentPercentileStats = stats;
                window.currentViewMode = viewModeParam;
            }
        }

        if (isObcine) {
            map.current.setFilter(layerId, null);
            map.current.setPaintProperty(layerId, 'fill-color', colorExpression);
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.9);
            map.current.setLayoutProperty(layerId, 'visibility', 'visible');

            if (selectedObcina) {
                const maskLayerId = 'obcina-mask';
                if (map.current.getLayer(maskLayerId)) {
                    map.current.moveLayer(layerId, maskLayerId);
                }
            }

            setColoringLoaded(true);
        } else {
            if (colorExpression.length >= 3 && layerManager.current) {
                layerManager.current.updateMunicipalitiesFillColors(colorExpression);
            }
        }
    }, [obcinePosliData, obcineCeneData, katastrskePosliData, katastrskeCeneData, activeTab, viewMode]);

    // Handler za mouse position tracking
    const handleMouseMove = useCallback((e) => {
        setMousePosition({ x: e.clientX, y: e.clientY });
    }, []);

    const createHoverHandlers = useCallback((regionType) => {
        const isObcine = regionType === 'obcine';
        const layerId = isObcine ? 'obcine-fill' : 'municipalities-fill';
        const idProperty = isObcine ? 'OB_ID' : 'SIFKO';
        const nameProperty = isObcine ? 'OB_UIME' : 'NAZIV';

        let currentHoveredId = null;
        const debouncedUpdate = debounce((hoveredId, hoveredName, hoveredSifko) => {
            const selected = isObcine ? selectedObcina : selectedMunicipality;
            const selectedId = isObcine ? selected?.obcinaId : selected?.sifko;

            if (!selected || selectedId !== hoveredId) {
                let hoverInfo = {
                    name: isObcine ? hoveredName : getMunicipalityName({ properties: { [nameProperty]: hoveredName } }),
                    type: isObcine ? 'Občina' : 'Kataster'
                };

                const dataSource = viewMode === 'cene'
                    ? (isObcine ? obcineCeneData : katastrskeCeneData)
                    : (isObcine ? obcinePosliData : katastrskePosliData);

                if (dataSource) {
                    let apiKey;
                    if (isObcine) {
                        const searchName = hoveredName;
                        const apiNames = Object.keys(dataSource);
                        apiKey = findClosestName(searchName, apiNames, 2);
                    } else {
                        apiKey = hoveredSifko;
                    }

                    if (apiKey && dataSource[apiKey]) {
                        const regionData = dataSource[apiKey][activeTab];

                        if (viewMode === 'cene') {
                            hoverInfo.value = regionData?.skupna_povprecna_cena_m2 || 0;
                            hoverInfo.unit = '€/m²';
                        } else {
                            hoverInfo.value = regionData?.skupaj || 0;
                            hoverInfo.unit = activeTab === 'prodaja' ? 'prodaj' : 'najemov';
                        }
                        hoverInfo.viewMode = viewMode;
                        hoverInfo.activeTab = activeTab;
                    }
                }

                setCursorTooltip(hoverInfo);

                if (isObcine) {
                    setHoveredRegion(hoverInfo);
                    layerManager.current?.updateObcinaHover(hoveredId);
                } else {
                    setHoveredMunicipality(hoverInfo);
                    layerManager.current?.updateMunicipalityHover(hoveredId);
                }
            }
        }, 30);

        return {
            move: (e) => {
                const hoveredId = e.features[0]?.properties?.[idProperty];
                const hoveredName = e.features[0]?.properties?.[nameProperty];
                const hoveredSifko = e.features[0]?.properties?.SIFKO;

                if (hoveredId !== currentHoveredId) {
                    currentHoveredId = hoveredId;
                    map.current.getCanvas().style.cursor = 'pointer';
                    debouncedUpdate(hoveredId, hoveredName, hoveredSifko);
                }
            },
            leave: () => {
                currentHoveredId = null;
                map.current.getCanvas().style.cursor = '';
                debouncedUpdate.cancel();

                setCursorTooltip(null);

                if (isObcine) {
                    setHoveredRegion(null);
                    layerManager.current?.updateObcinaHover(null);
                } else {
                    setHoveredMunicipality(null);
                    layerManager.current?.updateMunicipalityHover(null);
                }
            },
            click: (e) => {
                if (e.features?.[0]) {
                    debouncedUpdate.cancel();
                    setCursorTooltip(null);

                    if (isObcine) {
                        setHoveredRegion(null);
                        layerManager.current?.updateObcinaHover(null);
                        handleObcinaClick(e.features[0]);
                    } else {
                        setHoveredMunicipality(null);
                        layerManager.current?.updateMunicipalityHover(null);
                        handleMunicipalityClick(e.features[0]);
                    }
                }
            }
        };
    }, [selectedObcina, selectedMunicipality, obcinePosliData, obcineCeneData, katastrskePosliData, katastrskeCeneData, activeTab, viewMode]);

    //  handleMunicipalityClick
    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);
        const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);

        if (layerManager.current && selectedObcina) {
            layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, selectedObcina.name);
        }

        onMunicipalitySelect?.({
            name: municipalityName,
            sifko: sifko,
            bounds: bounds,
            preserveObcina: true
        });
    }, [onMunicipalitySelect, selectedObcina]);

    // flag za sledenje ali je klik direkten
    const [isDirectClick, setIsDirectClick] = useState(false);

    // handleObcinaClick - označi direktni klik
    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) return;

        const hasKatastre = obcinaHasKatastre(obcinaName);

        setIsDirectClick(true);

        const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);

        onObcinaSelect?.({
            name: obcinaName,
            obcinaId: obcinaId,
            bounds: bounds
        });

        if (layerManager.current) {
            if (hasKatastre) {
                layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, obcinaName);
            } else {
                layerManager.current.hideMunicipalities();
            }
        }

        // Zoom samo če ima občina katastre
        if (hasKatastre) {
            map.current.fitBounds(bounds, {
                padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
                duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
                essential: true
            });

            map.current.setMaxBounds(bounds);
            addObcinaMask(obcinaId);
        }

        setTimeout(() => {
            setIsDirectClick(false);
        }, MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION + 100);

    }, [selectedObcina, onObcinaSelect, currentMapState, previousMapState, selectedRegionFromNavigation]);

    // Setup funkcije
    const setupEventHandlers = useCallback((regionType) => {
        if (!map.current) return;

        const isObcine = regionType === 'obcine';
        const layerId = isObcine ? 'obcine-fill' : 'municipalities-fill';
        const handlers = createHoverHandlers(regionType);

        map.current.on('mousemove', layerId, handlers.move);
        map.current.on('mouseleave', layerId, handlers.leave);
        map.current.on('click', layerId, handlers.click);

        map.current[`_${regionType}Handlers`] = handlers;
    }, [createHoverHandlers]);

    const addObcinaMask = (obcinaId) => {
        const overlayLayerId = 'obcina-mask';
        const sourceId = SOURCE_IDS.OBCINE;

        if (!map.current.getLayer(overlayLayerId)) {
            map.current.addLayer({
                id: overlayLayerId,
                type: 'fill',
                source: sourceId,
                paint: {
                    'fill-color': 'rgba(0, 0, 0, 0.75)',
                    'fill-opacity': [
                        'case',
                        ['==', ['get', 'OB_ID'], obcinaId],
                        0,
                        0.85
                    ]
                }
            }, LAYER_IDS.OBCINE.OUTLINE);
        } else {
            map.current.setPaintProperty(overlayLayerId, 'fill-opacity', [
                'case',
                ['==', ['get', 'OB_ID'], obcinaId],
                0,
                0.85
            ]);

            map.current.setPaintProperty(overlayLayerId, 'fill-color', 'rgba(0, 0, 0, 0.75)');
        }
    };

    const loadObcine = useCallback(async () => {
        if (!map.current || obcineLoaded || !layerManager.current) return;

        try {
            layerManager.current.addObcineLayers(obcineData);
            setupEventHandlers('obcine');
            setObcineLoaded(true);
            await fetchAllData();
        } catch (error) {
            console.error('Napaka pri nalaganju občin:', error);
        }

    }, [obcineLoaded, setupEventHandlers]);

    const loadMunicipalities = useCallback(() => {
        if (!map.current || municipalitiesLoaded || !layerManager.current) return;

        try {
            layerManager.current.addMunicipalitiesLayers(municipalitiesData);
            setupEventHandlers('municipalities');
            setMunicipalitiesLoaded(true);
        } catch (error) {
            console.error('Napaka pri nalaganju katastrskih občin:', error);
        }
    }, [municipalitiesLoaded, setupEventHandlers]);

    const handleReset = useCallback(() => {
        const shouldResetZoom = selectedObcina && obcinaHasKatastre(selectedObcina.name);

        setHoveredRegion(null);
        setHoveredMunicipality(null);
        setCursorTooltip(null);

        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
            layerManager.current.updateMunicipalityHover(null);
            layerManager.current.resetFilters();
        }

        const overlayLayerId = 'obcina-mask';
        if (map.current.getLayer(overlayLayerId)) {
            map.current.removeLayer(overlayLayerId);
        }

        map.current.setMaxBounds(null);

        if (layerManager.current) {
            layerManager.current.updateLayerVisibilityByZoom(previousMapState.zoom, false, null);
        }

        updateRegionColors('obcine', activeTab, viewMode);
        updateRegionColors('municipalities', activeTab, viewMode);

        if (shouldResetZoom) {
            const resetTarget = {
                center: previousMapState.center || MAP_CONFIG.INITIAL_CENTER,
                zoom: previousMapState.zoom || MAP_CONFIG.INITIAL_ZOOM
            };

            map.current.flyTo({
                center: resetTarget.center,
                zoom: resetTarget.zoom,
                duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
            });
        }

        onMunicipalitySelect?.(null);
        onObcinaSelect?.(null);
    }, [onMunicipalitySelect, onObcinaSelect, activeTab, viewMode, updateRegionColors, previousMapState, selectedObcina]);

    // Legenda komponenta
    const getColorScalePercentiles = (colorType = 'prodaja', percentileStats = null, viewModeParam = 'posli') => {
        const isRental = colorType === 'najem';
        const isPriceView = viewModeParam === 'cene';

        const unit = isPriceView ? '€/m²' : (isRental ? 'najemov' : 'prodaj');
        const colors = isRental ? PERCENTILE_COLOR_PALETTES.najem : PERCENTILE_COLOR_PALETTES.prodaja;

        const formatRange = (start, end) => {
            if (isPriceView) {
                return `${Math.round(start)}-${Math.round(end)}€/m²`;
            }
            return `${start}-${end} ${unit}`;
        };

        return [
            { color: 'rgba(255, 255, 255, 0.8)', label: `0 ${isPriceView ? 'cena/m²' : unit}` },
            { color: colors[0], label: formatRange(1, percentileStats?.p20 || '?') },
            { color: colors[1], label: formatRange((percentileStats?.p20 || 0) + 1, percentileStats?.p40 || '?') },
            { color: colors[2], label: formatRange((percentileStats?.p40 || 0) + 1, percentileStats?.p60 || '?') },
            { color: colors[3], label: formatRange((percentileStats?.p60 || 0) + 1, percentileStats?.p80 || '?') },
            { color: colors[4], label: `${Math.round((percentileStats?.p80 || 0) + 1)}+ ${unit}` }
        ];
    };

    const PercentileLegenda = () => {
        if (!coloringLoaded || isMobile) return null;

        const getCurrentStats = () => {
            const dataSource = viewMode === 'cene' ? obcineCeneData : obcinePosliData;
            if (!dataSource) return null;

            const allValues = [];
            const apiNames = Object.keys(dataSource);

            obcineData.features.forEach(feature => {
                const geojsonName = feature.properties.OB_UIME;
                const closestApiName = findClosestName(geojsonName, apiNames);

                if (closestApiName) {
                    const value = viewMode === 'cene'
                        ? dataSource[closestApiName][activeTab]?.skupna_povprecna_cena_m2 || 0
                        : dataSource[closestApiName][activeTab]?.skupaj || 0;
                    if (value > 0) allValues.push(value);
                }
            });

            if (allValues.length === 0) return null;

            const sortedValues = allValues.sort((a, b) => a - b);
            return {
                count: allValues.length,
                avg: Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length),
                p20: sortedValues[Math.floor(sortedValues.length * 0.2)],
                p40: sortedValues[Math.floor(sortedValues.length * 0.4)],
                p60: sortedValues[Math.floor(sortedValues.length * 0.6)],
                p80: sortedValues[Math.floor(sortedValues.length * 0.8)]
            };
        };

        const stats = getCurrentStats();
        const colorScale = getColorScalePercentiles(activeTab, stats, viewMode);

        const getLegendTitle = () => {
            const transaction = activeTab === 'prodaja' ? 'Prodaje' : 'Najemi';
            const metric = viewMode === 'cene' ? 'povprečne cene/m²' : 'število poslov';

            return `${transaction} - ${metric} (zadnjih 12 mesecev)`;
        };

        return (
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-3 hidden sm:block">
                <div className="text-xs font-medium text-gray-700 mb-3">
                    {getLegendTitle()}
                </div>
                <div className="space-y-2">
                    {colorScale.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            <div
                                className={`w-4 h-3 rounded flex-shrink-0 ${item.color === 'rgba(255, 255, 255, 0.8)'
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
                         Povprečje: {
                            viewMode === 'cene'
                                ? `${Math.round(stats.avg)}€/m²`
                                : stats.avg
                        }
                    </div>
                )}
            </div>
        );
    };

    // Cursor Tooltip komponenta - sledi miški
    const CursorTooltip = ({ tooltip, position }) => {
        if (!tooltip || isMobile) return null;

        return (
            <div
                className="fixed z-50 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2 pointer-events-none text-sm"
                style={{
                    left: position.x + 15,
                    top: position.y - 10,
                    transform: 'translateY(-100%)'
                }}
            >
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 font-medium">{tooltip.type}:</span>
                    <span className="font-medium text-gray-700">{tooltip.name}</span>
                </div>
                {tooltip.value !== undefined && (
                    <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500">
                            {tooltip.viewMode === 'cene' ? 'Cena/m²' :
                                (tooltip.activeTab === 'prodaja' ? 'Prodaje' : 'Najemi')}:
                        </span>
                        <span className="font-semibold text-gray-800">
                            {tooltip.viewMode === 'cene'
                                ? `${Math.round(tooltip.value)}€/m²`
                                : tooltip.value
                            }
                        </span>
                    </div>
                )}
            </div>
        );
    };

    // Effects - Update dropdown states when selections change - poenostavljeno
    useEffect(() => {
        if (selectedObcina) {
            setSelectedObcinaDropdown(selectedObcina.obcinaId);
        } else {
            setSelectedObcinaDropdown('');
        }
    }, [selectedObcina]);

    // Ostali effects
    useEffect(() => {
        const currentObcineData = viewMode === 'cene' ? obcineCeneData : obcinePosliData;
        if (currentObcineData && obcineLoaded) {
            updateRegionColors('obcine', activeTab, viewMode);
        }
    }, [activeTab, viewMode, obcinePosliData, obcineCeneData, obcineLoaded, updateRegionColors]);

    useEffect(() => {
        const currentKatastrData = viewMode === 'cene' ? katastrskeCeneData : katastrskePosliData;
        if (currentKatastrData && municipalitiesLoaded) {
            updateRegionColors('municipalities', activeTab, viewMode);
        }
    }, [activeTab, viewMode, katastrskePosliData, katastrskeCeneData, municipalitiesLoaded, updateRegionColors]);

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
        if (selectedRegionFromNavigation && !selectedObcina && !selectedMunicipality) {
            if (map.current && map.current.loaded) {
                const currentCenter = map.current.getCenter();
                const currentZoom = map.current.getZoom();

                const initialState = {
                    center: [currentCenter.lng, currentCenter.lat],
                    zoom: currentZoom
                };

                setPreviousMapState(initialState);
            } else {
                setPreviousMapState({
                    center: MAP_CONFIG.INITIAL_CENTER,
                    zoom: MAP_CONFIG.INITIAL_ZOOM
                });
            }
        }
    }, [selectedRegionFromNavigation, selectedObcina, selectedMunicipality, previousMapState]);

    useEffect(() => {
        if (selectedObcina && obcineLoaded && layerManager.current &&
            selectedRegionFromNavigation?.autoZoomToRegion &&
            selectedRegionFromNavigation.type === 'obcina' &&
            !isDirectClick) {

            const obcinaFeature = obcineData.features.find(
                feature => getObcinaId(feature) === selectedObcina.obcinaId
            );

            if (obcinaFeature) {
                const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);
                const hasKatastre = obcinaHasKatastre(selectedObcina.name);

                if (hasKatastre) {
                    layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true, selectedObcina.name);

                    map.current.fitBounds(bounds, {
                        padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
                        duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
                        essential: true
                    });

                    map.current.setMaxBounds(bounds);
                    addObcinaMask(selectedObcina.obcinaId);
                } else {
                    layerManager.current.hideMunicipalities();
                }

                layerManager.current.updateObcinaSelection(selectedObcina.obcinaId, selectedObcina.name);
            }
        }
    }, [selectedObcina, obcineLoaded, selectedRegionFromNavigation, isDirectClick]);

    useEffect(() => {
        if (map.current && layerManager.current) {
            layerManager.current.updateMunicipalitySelection(selectedMunicipality?.sifko);

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

    // GLAVNA INICIALIZACIJA
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

                map.current.on('zoomend', () => {
                    const currentZoom = map.current.getZoom();
                    if (layerManager.current && !selectedObcina) {
                        layerManager.current.updateLayerVisibilityByZoom(currentZoom, null, null);
                    }
                });

                setCurrentMapState({
                    center: MAP_CONFIG.INITIAL_CENTER,
                    zoom: MAP_CONFIG.INITIAL_ZOOM
                });
                setPreviousMapState({
                    center: MAP_CONFIG.INITIAL_CENTER,
                    zoom: MAP_CONFIG.INITIAL_ZOOM
                });
            });
        }

        return () => {
            if (map.current) {
                ['obcine', 'municipalities'].forEach(regionType => {
                    const handlers = map.current[`_${regionType}Handlers`];
                    if (handlers) {
                        const layerId = regionType === 'obcine' ? 'obcine-fill' : 'municipalities-fill';
                        map.current.off('mousemove', layerId, handlers.move);
                        map.current.off('mouseleave', layerId, handlers.leave);
                        map.current.off('click', layerId, handlers.click);
                    }
                });

                layerManager.current?.cleanup();
                map.current.remove();
                map.current = null;
            }
        };
    }, [isMobile]);

    useEffect(() => {
        const container = mapContainer.current;
        if (container && !isMobile) {
            container.addEventListener('mousemove', handleMouseMove);
            return () => {
                container.removeEventListener('mousemove', handleMouseMove);
            };
        }
    }, [handleMouseMove, isMobile]);

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

            {/* Mobile Overlay */}
            <MobileOverlay />

            <CursorTooltip tooltip={cursorTooltip} position={mousePosition} />

            {!isMobile && (
                <div className="absolute top-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 p-2">
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setViewMode('posli')}
                            className={`px-3 py-2 text-xs font-medium rounded transition-colors ${viewMode === 'posli'
                                ? 'text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            style={viewMode === 'posli' ? {
                                backgroundColor: activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)'
                            } : {}}
                        >
                            {activeTab === 'prodaja' ? 'Število prodaj' : 'Število najemov'}
                        </button>
                        <button
                            onClick={() => setViewMode('cene')}
                            className={`px-3 py-2 text-xs font-medium rounded transition-colors ${viewMode === 'cene'
                                ? 'text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            style={viewMode === 'cene' ? {
                                backgroundColor: activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)'
                            } : {}}
                        >
                            Cena/m²
                        </button>
                    </div>
                </div>
            )}

            {/* Desktop info panel - poenostavljeno */}
            {!isMobile && (selectedMunicipality || selectedObcina) && (
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
                            </div>
                        </div>
                        <button
                            onClick={handleReset}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <PercentileLegenda />
        </div>
    );
}