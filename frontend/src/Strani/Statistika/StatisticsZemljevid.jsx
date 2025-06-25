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

    // Podatki za barvanje
    const [obcinePosliData, setObcinePosliData] = useState(null);
    const [katastrskePosliData, setKatastrskePosliData] = useState(null);
    const [obcineCeneData, setObcineCeneData] = useState(null);
    const [katastrskeCeneData, setKatastrskeCeneData] = useState(null);

    const [previousMapState, setPreviousMapState] = useState({
        center: MAP_CONFIG.INITIAL_CENTER,
        zoom: MAP_CONFIG.INITIAL_ZOOM
    });

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

    // Unified barvanje za občine in katastre
    const updateRegionColors = useCallback((
        regionType, // 'obcine' ali 'municipalities'
        activeTabParam = activeTab,
        viewModeParam = viewMode
    ) => {
        const isObcine = regionType === 'obcine';
        const layerId = isObcine ? LAYER_IDS.OBCINE.FILL : LAYER_IDS.MUNICIPALITIES.FILL;

        if (!map.current || !map.current.getLayer(layerId)) return;

        // Izberi pravi podatkovni set
        const dataSource = viewModeParam === 'cene'
            ? (isObcine ? obcineCeneData : katastrskeCeneData)
            : (isObcine ? obcinePosliData : katastrskePosliData);

        if (!dataSource) return;

        const allValues = [];
        const nameMapping = new Map();
        const apiNames = Object.keys(dataSource);
        const geoData = isObcine ? obcineData : municipalitiesData;
        const nameProperty = isObcine ? 'OB_UIME' : 'NAZIV';
        const maxDistance = isObcine ? 2 : 3;

        geoData.features.forEach(feature => {
            const geojsonName = feature.properties[nameProperty] || feature.properties.IMEKO;
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

        // Izračun statistik
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
            window.currentPercentileStats = stats;
            window.currentViewMode = viewModeParam;
        }

        // Ustvarjanje color expression
        const colorExpression = ['case'];

        nameMapping.forEach((apiName, geojsonName) => {
            const regionData = dataSource[apiName];
            const value = viewModeParam === 'cene'
                ? regionData[activeTabParam]?.skupna_povprecna_cena_m2 || 0
                : regionData[activeTabParam]?.skupaj || 0;

            const color = getColorForValuePercentiles(value, allValues, activeTabParam);

            colorExpression.push(['==', ['get', nameProperty], geojsonName]);
            colorExpression.push(color);
        });

        colorExpression.push(COLOR_MAPPING_CONFIG.DEFAULT_FALLBACK);

        // Aplikacija na mapo
        if (isObcine) {
            map.current.setFilter(layerId, null);
            map.current.setPaintProperty(layerId, 'fill-color', colorExpression);
            map.current.setPaintProperty(layerId, 'fill-opacity', 0.8);
            map.current.setLayoutProperty(layerId, 'visibility', 'visible');
            setColoringLoaded(true);
        } else {
            if (colorExpression.length >= 3 && layerManager.current) {
                layerManager.current.updateMunicipalitiesFillColors(colorExpression);
            }
        }
    }, [obcinePosliData, obcineCeneData, katastrskePosliData, katastrskeCeneData, activeTab, viewMode]);

    // Unified hover setup
    const createHoverHandlers = useCallback((regionType) => {
        const isObcine = regionType === 'obcine';
        const layerId = isObcine ? 'obcine-fill' : 'municipalities-fill';
        const idProperty = isObcine ? 'OB_ID' : 'SIFKO';
        const nameProperty = isObcine ? 'OB_UIME' : 'NAZIV';

        let currentHoveredId = null;
        const debouncedUpdate = debounce((hoveredId, hoveredName) => {
            const selected = isObcine ? selectedObcina : selectedMunicipality;
            const selectedId = isObcine ? selected?.obcinaId : selected?.sifko;

            if (!selected || selectedId !== hoveredId) {
                let hoverInfo = {
                    name: isObcine ? hoveredName : getMunicipalityName({ properties: { [nameProperty]: hoveredName } }),
                    type: isObcine ? 'Občina' : 'Kataster'
                };

                // Dodaj podatke
                const dataSource = viewMode === 'cene'
                    ? (isObcine ? obcineCeneData : katastrskeCeneData)
                    : (isObcine ? obcinePosliData : katastrskePosliData);

                if (dataSource) {
                    const searchName = isObcine ? hoveredName : hoveredName.split('(')[0].trim();
                    const apiNames = Object.keys(dataSource);
                    const closestApiName = findClosestName(searchName, apiNames, isObcine ? 2 : 3);

                    if (closestApiName && dataSource[closestApiName]) {
                        const regionData = dataSource[closestApiName][activeTab];

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

                if (hoveredId !== currentHoveredId) {
                    currentHoveredId = hoveredId;
                    map.current.getCanvas().style.cursor = 'pointer';
                    debouncedUpdate(hoveredId, hoveredName);
                }
            },
            leave: () => {
                currentHoveredId = null;
                map.current.getCanvas().style.cursor = '';
                debouncedUpdate.cancel();

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

    // Klik handleri
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

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) return;

        if (!selectedObcina) {
            const currentCenter = map.current.getCenter();
            const currentZoom = map.current.getZoom();
            setPreviousMapState({
                center: [currentCenter.lng, currentCenter.lat],
                zoom: currentZoom
            });
        }

        const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);
        const hasKatastre = obcinaHasKatastre(obcinaName);

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

        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });

        map.current.setMaxBounds(bounds);
        addObcinaMask(obcinaId);
    }, [selectedObcina, onObcinaSelect]);

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

        map.current.setMaxBounds(null);

        if (layerManager.current) {
            layerManager.current.updateLayerVisibilityByZoom(previousMapState.zoom, false, null);
        }

        updateRegionColors('obcine', activeTab, viewMode);
        updateRegionColors('municipalities', activeTab, viewMode);

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

        onMunicipalitySelect?.(null);
        onObcinaSelect?.(null);
    }, [onMunicipalitySelect, onObcinaSelect, activeTab, viewMode, updateRegionColors, previousMapState]);

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
        if (!coloringLoaded || selectedObcina || selectedMunicipality) return null;

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
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-3">
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
                        Občin z podatki: {stats.count} | Povprečje: {
                            viewMode === 'cene'
                                ? `${Math.round(stats.avg)}€/m²`
                                : stats.avg
                        }
                    </div>
                )}
            </div>
        );
    };

    const HoverPreview = ({ region, position = "bottom-4 right-4" }) => (
        <div className={`absolute ${position} z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-2`}>
            <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 font-medium">{region.type}:</span>
                <span className="text-sm font-medium text-gray-700">{region.name}</span>
            </div>
            {region.value !== undefined && (
                <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-gray-500">
                        {region.viewMode === 'cene' ? 'Cena/m²' :
                            (region.activeTab === 'prodaja' ? 'Prodaje' : 'Najemi')}:
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                        {region.viewMode === 'cene'
                            ? `${Math.round(region.value)}€/m²`
                            : region.value
                        }
                    </span>
                </div>
            )}
        </div>
    );

    // Effects
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

                setPreviousMapState({
                    center: MAP_CONFIG.INITIAL_CENTER,
                    zoom: MAP_CONFIG.INITIAL_ZOOM
                });
            });
        }

        return () => {
            if (map.current) {
                // Cleanup event handlers
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
    }, []);

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

            {/* Toggle gumb za prikaz */}
            {!selectedMunicipality && !selectedObcina && (
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
                            Število poslov
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
                            Cene/m²
                        </button>
                    </div>
                </div>
            )}

            {/* Hover predogledi */}
            {hoveredRegion && !selectedMunicipality && !selectedObcina && (
                <HoverPreview region={hoveredRegion} />
            )}

            {hoveredMunicipality && selectedObcina && !selectedMunicipality &&
                obcinaHasKatastre(selectedObcina.name) && (
                    <HoverPreview region={hoveredMunicipality} position="bottom-16 right-4" />
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
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Legenda */}
            <PercentileLegenda />
        </div>
    );
}