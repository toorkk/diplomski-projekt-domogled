import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Importanje managerjev
import LayerManager from "./StatisticsLayerManager.jsx";
import {
    MAP_CONFIG,
    ZOOM_LEVELS
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

export default function Statistika() {
    // Refs
    const mapContainer = useRef(null);
    const map = useRef(null);
    const layerManager = useRef(null);

    // States
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [hoveredMunicipality, setHoveredMunicipality] = useState(null);

    // ===========================================
    // MUNICIPALITY AND REGION HANDLERS
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

        const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);

        setSelectedMunicipality({
            name: municipalityName,
            sifko: sifko,
            bounds: bounds
        });

        // Zoom na kataster - omogočeno za klikom
        // Zoom na občino - omogočeno za klikom
        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });
    }, []);

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) {
            console.log(`Občina ${obcinaName} already selected - ignoring click`);
            return;
        }

        console.log('Občina clicked:', obcinaName, 'ID:', obcinaId);

        // Clear občina hover when selecting
        setHoveredRegion(null);
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
        }

        setSelectedMunicipality(null);

        const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);
        
        setSelectedObcina({
            name: obcinaName,
            obcinaId: obcinaId,
            bounds: bounds
        });

        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });
    }, [selectedObcina]);

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
        setSelectedMunicipality(null);
        setSelectedObcina(null);
        setHoveredRegion(null);
        setHoveredMunicipality(null);

        // Clear all hover effects
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
            layerManager.current.updateMunicipalityHover(null);
        }

        map.current.flyTo({
            center: MAP_CONFIG.INITIAL_CENTER,
            zoom: MAP_CONFIG.INITIAL_ZOOM,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
        });
    }, []);

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

        const hoverMoveHandler = (e) => {
            const hoveredSifko = e.features[0]?.properties?.SIFKO;
            const hoveredMunicipalityName = getMunicipalityName(e.features[0]);
            
            if (hoveredSifko !== currentHoveredSifko) {
                currentHoveredSifko = hoveredSifko;
                
                if (!selectedMunicipality || selectedMunicipality.sifko !== hoveredSifko) {
                    map.current.getCanvas().style.cursor = 'pointer';
                    
                    setHoveredMunicipality({
                        name: hoveredMunicipalityName,
                        type: 'Kataster'
                    });

                    if (layerManager.current) {
                        layerManager.current.updateMunicipalityHover(hoveredSifko);
                    }
                }
            }
        };

        const hoverLeaveHandler = () => {
            currentHoveredSifko = null;
            map.current.getCanvas().style.cursor = '';
            setHoveredMunicipality(null);
            
            if (layerManager.current) {
                layerManager.current.updateMunicipalityHover(null);
            }
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredMunicipality(null);
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
    // ZOOM HANDLER - PONOVNO DODANO ZA LAYER VISIBILITY
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
    // UTILITY FUNCTIONS - POENOSTAVLJENE
    // ===========================================

    // styleMapControls funkcija odstranjena ker ni več kontrolov

    const cleanup = () => {
        if (map.current) {
            // Cleanup zoom handler
            if (map.current._zoomEndHandler) {
                map.current.off('zoomend', map.current._zoomEndHandler);
            }

            // Cleanup občina handlers
            if (map.current._obcinaHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._obcinaHandlers;
                map.current.off('mousemove', 'obcine-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'obcine-fill', hoverLeaveHandler);
                map.current.off('click', 'obcine-fill', clickHandler);
                delete map.current._obcinaHandlers;
            }

            // Cleanup municipality handlers
            if (map.current._municipalityHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._municipalityHandlers;
                map.current.off('mousemove', 'municipalities-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'municipalities-fill', hoverLeaveHandler);
                map.current.off('click', 'municipalities-fill', clickHandler);
                delete map.current._municipalityHandlers;
            }

            // Cleanup managers
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

    // Map initialization
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
                touchPitch: false // Onemogočeno pitch na touch napravah
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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            {/* Container za zemljevid */}
            <div className="relative w-full max-w-4xl h-96 md:h-[500px] lg:h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
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

                {/* Hover preview box for občine (only when not selected) */}
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

                {/* Hover preview box for katastrske občine (municipalities) */}
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

                {/* Selected municipality or občina indicator */}
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
        </div>
    );
}