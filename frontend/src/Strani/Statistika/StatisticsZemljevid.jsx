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
import municipalitiesData from '../../Občine/KatObčine.json';
import obcineData from '../../Občine/OB.json';

export default function StatisticsZemljevid({ 
    onMunicipalitySelect, 
    onObcinaSelect, 
    selectedMunicipality, 
    selectedObcina 
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

    // ===========================================
    // KATASTER IN REGION HANDLERJI
    // ===========================================

    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);

        console.log('Municipality clicked:', municipalityName, 'SIFKO:', sifko);

        // Clear municipality hover when selecting
        setHoveredMunicipality(null);
        if (layerManager.current) {
            layerManager.current.updateMunicipalityHover(null);
        }

        // Skalkulira boundse ampak ne zoomne in (lahko dodama nazaj myb)
        const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);

        const municipalityData = {
            name: municipalityName,
            sifko: sifko,
            bounds: bounds
        };

        // Callback to parent
        if (onMunicipalitySelect) {
            onMunicipalitySelect(municipalityData);
        }

    }, [onMunicipalitySelect]);

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) {
            console.log(`Občina ${obcinaName} already selected - ignoring click`);
            return;
        }

        console.log('Občina clicked:', obcinaName, 'ID:', obcinaId);

        // Clear občina hover
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

        // Callback to parent
        if (onObcinaSelect) {
            onObcinaSelect(obcinaData);
        }

        // 🚀 TAKOJ prikaži katastri - PRED zoom animacijo!
        if (layerManager.current) {
            layerManager.current.updateLayerVisibilityByZoom(map.current.getZoom(), true);
        }

        // Zoom to občina
        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });

        // 🔒 Lock view to the selected občina
        map.current.setMaxBounds(bounds);

        // 🎭 Add or update dark overlay mask outside of selected občina
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
            // Update opacity condition
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

    const loadObcine = useCallback(() => {
        if (!map.current || obcineLoaded || !layerManager.current) return;

        try {
            console.log('Loading občine layer...');

            layerManager.current.addObcineLayers(obcineData);
            setupObcinaEventHandlers();

            setObcineLoaded(true);
            console.log('Občine layer loaded successfully');

        } catch (error) {
            console.error('Error loading občine:', error);
        }
    }, [obcineLoaded]);

    const loadMunicipalities = useCallback(() => {
        if (!map.current || municipalitiesLoaded || !layerManager.current) return;

        try {
            console.log('Loading municipalities layer...');

            layerManager.current.addMunicipalitiesLayers(municipalitiesData);
            setupMunicipalityEventHandlers();

            setMunicipalitiesLoaded(true);
            console.log('Municipalities layer loaded successfully');

        } catch (error) {
            console.error('Error loading municipalities:', error);
        }
    }, [municipalitiesLoaded]);

    const handleReset = useCallback(() => {
        setHoveredRegion(null);
        setHoveredMunicipality(null);

        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
            layerManager.current.updateMunicipalityHover(null);
        }

        const overlayLayerId = 'obcina-mask';
        if (map.current.getLayer(overlayLayerId)) {
            map.current.removeLayer(overlayLayerId);
        }

        map.current.setMaxBounds(null);

        if (layerManager.current) {
            layerManager.current.updateLayerVisibilityByZoom(MAP_CONFIG.INITIAL_ZOOM, false);
        }

        map.current.flyTo({
            center: MAP_CONFIG.INITIAL_CENTER,
            zoom: MAP_CONFIG.INITIAL_ZOOM,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
        });

        // Notify parent about reset
        if (onMunicipalitySelect) {
            onMunicipalitySelect(null);
        }
        if (onObcinaSelect) {
            onObcinaSelect(null);
        }
    }, [onMunicipalitySelect, onObcinaSelect]);

    // ===========================================
    // EVENT HANDLERS SETUP
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

                    setHoveredRegion({
                        name: hoveredObcinaName,
                        type: 'Občina'
                    });

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
    }, [selectedObcina, handleObcinaClick]);

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
        }, 30); // debounce za hitrejsi hover (spremeni mogoce na 35)

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

    // ===========================================
    // ZOOM HANDLER 
    // ===========================================

    const setupZoomHandler = () => {
        const handleZoomEnd = () => {
            const currentZoom = map.current.getZoom();

            if (layerManager.current) {
                layerManager.current.updateLayerVisibilityByZoom(currentZoom);
            }
        };

        map.current.on('zoomend', handleZoomEnd);
        map.current._zoomEndHandler = handleZoomEnd;
    };

    // ===========================================
    // UTILITY FUNKCIJE - POENOSTAVLJENE
    // ===========================================

    const cleanup = () => {
        if (map.current) {
            // Pocisti zoom handler
            if (map.current._zoomEndHandler) {
                map.current.off('zoomend', map.current._zoomEndHandler);
            }

            // Pocisti obcina handler
            if (map.current._obcinaHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._obcinaHandlers;
                map.current.off('mousemove', 'obcine-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'obcine-fill', hoverLeaveHandler);
                map.current.off('click', 'obcine-fill', clickHandler);
                delete map.current._obcinaHandlers;
            }

            // Pocisti kataster handler
            if (map.current._municipalityHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._municipalityHandlers;
                map.current.off('mousemove', 'municipalities-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'municipalities-fill', hoverLeaveHandler);
                map.current.off('click', 'municipalities-fill', clickHandler);
                delete map.current._municipalityHandlers;
            }

            // Cleanup managerji
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
            layerManager.current.updateObcinaSelection(selectedObcina?.obcinaId);
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
                minZoom: 2, // Omogočimo zoom out
                maxZoom: 15, // Omogočimo zoom in za občine/katastre
                attributionControl: false,
                scrollZoom: false, // Onemogočeno scrollanje za zoom
                boxZoom: false, // Onemogočeno box zoom
                doubleClickZoom: false, // Onemogočeno double click zoom
                touchZoomRotate: false, // Onemogočeno touch zoom
                dragRotate: false, // Onemogočeno rotiranje
                keyboard: false, // Onemogočeno keyboard navigation
                touchPitch: false, // Onemogočeno pitch na touch napravah
                dragPan: false
            });

            map.current.on('load', () => {
                layerManager.current = new LayerManager(map.current);
                loadObcine();
                loadMunicipalities();
                layerManager.current.updateLayerVisibilityByZoom(MAP_CONFIG.INITIAL_ZOOM);
                setupZoomHandler(); // Ponovno dodano za layer visibility
            });
        }

        return cleanup;
    }, []);

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

            {/* Hover preview box za občine */}
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
                </div>
            )}

            {/* Hover preview box za katastrske občine */}
            {hoveredMunicipality && selectedObcina && !selectedMunicipality && (
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
        </div>
    );
}