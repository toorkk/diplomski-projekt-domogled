import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Komponente
import Filter from "../../Filter.jsx";
import Switcher from "./Switcher.jsx";
import Iskalnik from "./Iskalnik.jsx";
import Podrobnosti from "./Podrobnosti.jsx";
import PopupManager from "./PopupManager.jsx";
import StatistikePanel from "./StatistikePanel.jsx";
import IntroModal from "./IntroModal.jsx";

// Importanje managerjev
import LayerManager from "./LayerManager.jsx";
import {
    MAP_CONFIG,
    DATA_SOURCE_CONFIG,
    TIMEOUTS,
    UI_CONFIG,
    ZOOM_LEVELS
} from './MapConstants.jsx';

//Importanje vseh utils
import {
    buildPropertiesUrl,
    getApiDataSource,
    getObcinaName,
    getObcinaId,
    calculateBoundsFromGeometry,
    handleApiError,
    validateFilters,
    fetchStatistics
} from './MapUtils.jsx';

// Stili in JSON podatki (občine)
import '../Stili/Zemljevid.css';
import obcineData from '../../Občine/OB.json';
import { useIsMobile } from "../../hooks/useIsMobile.jsx";

export default function Zemljevid({ onNavigateToStatistics }) {
    // Refs
    const mapContainer = useRef(null);
    const map = useRef(null);
    const popupManager = useRef(null);
    const layerManager = useRef(null);
    const dataSourceTypeRef = useRef('prodaja');

    // Definiranje STATOV
    const [isLoading, setIsLoading] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);
    const [dataSourceType, setDataSourceType] = useState('prodaja');
    const [activeFilters, setActiveFilters] = useState({});

    // State za statistike
    const [obcinaStatistics, setObcinaStatistics] = useState(null);
    const [statisticsLoading, setStatisticsLoading] = useState(false);

    // State za intro modal
    const [showIntroModal, setShowIntroModal] = useState(false);

    const activeFiltersRef = useRef({});

    const isMobile = useIsMobile();

    // Preveri ali je uporabnik že videl intro
    useEffect(() => {
        const hasSeenIntro = localStorage.getItem('hasSeenMapIntro');
        if (!hasSeenIntro) {
            setShowIntroModal(true);
        }
    }, []);

    const handleCloseIntro = () => {
        setShowIntroModal(false);
        localStorage.setItem('hasSeenMapIntro', 'true');
    };

    // Updejtanje ref ko se spremeni state
    useEffect(() => {
        dataSourceTypeRef.current = dataSourceType;
    }, [dataSourceType]);

    useEffect(() => {
        activeFiltersRef.current = activeFilters;
    }, [activeFilters]);

    // ===========================================
    // STABILNI HANDLERJI
    // ===========================================

    const handlePropertySelect = useCallback((propertyData) => {
        setSelectedProperty({ ...propertyData });
        setShowPropertyDetails(true);
    }, []);

    // POSODOBLJENA funkcija za navigacijo na statistike
    const handleGoToStatistics = useCallback(() => {
        if (selectedObcina) {
            // Za občino
            const regionData = {
                name: selectedObcina.name,
                type: 'obcina',
                obcinaId: selectedObcina.obcinaId,
                // NOVO: Dodaj flag da naj se avtomatsko zoomira na zemljevidu
                autoZoomToRegion: true
            };
            onNavigateToStatistics?.(regionData);
        }
    }, [selectedObcina, onNavigateToStatistics]);

    const fetchAndSetStatistics = useCallback(async (tipRegije, regija, dataSourceType) => {
        setStatisticsLoading(true);
        try {
            const statistics = await fetchStatistics(tipRegije, regija);

            if (tipRegije === 'obcina') {
                setObcinaStatistics(statistics);
            }

        } finally {
            setStatisticsLoading(false);
        }
    }, []);

    // Funkcija za samodejno nalaganje nepremičnin za trenutni pogled
    const fetchPropertiesForCurrentView = useCallback(async (filters = {}) => {
        if (!map.current || isLoading) return;

        const currentZoom = map.current.getZoom();

        // Preverite ali je zoom dovolj visok za prikaz nepremičnin
        if (currentZoom < ZOOM_LEVELS.AUTO_LOAD_PROPERTIES) {

            // Počisti obstoječe nepremičnine
            if (layerManager.current) {
                layerManager.current.removePropertiesLayers();
                layerManager.current.removeClustersLayers();
            }
            return;
        }

        setIsLoading(true);

        try {
            const currentDataSourceType = dataSourceTypeRef.current;
            const apiDataSource = getApiDataSource(currentDataSourceType);

            // Pridobi trenutni bbox
            const bounds = map.current.getBounds();
            const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;


            const url = buildPropertiesUrl(bbox, currentZoom, apiDataSource, null, null, filters);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();

            const individualFeatures = geojson.features.filter(f => f.properties.type === 'individual');
            const clusterFeatures = geojson.features.filter(f => f.properties.type === 'cluster');

            if (layerManager.current) {
                layerManager.current.addPropertiesLayers(individualFeatures, currentDataSourceType);
                layerManager.current.addClustersLayers(clusterFeatures, currentDataSourceType);
            }

            if (popupManager.current) {
                popupManager.current.setupEventHandlers(handlePropertySelect);
            }

        } catch (error) {
            handleApiError(error, 'loading properties for current view');
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, handlePropertySelect]);

    // ===========================================
    // FILTER AND DATA SOURCE HANDLERJI
    // ===========================================

    const handleFiltersChange = useCallback((newFilters) => {

        const currentDataSourceType = dataSourceTypeRef.current;
        const validatedFilters = validateFilters(newFilters, currentDataSourceType);
        setActiveFilters(validatedFilters);

        if (popupManager.current) {
            popupManager.current.updateFilters(validatedFilters);
        }

        // Bbox loading
        setTimeout(() => {
            fetchPropertiesForCurrentView(validatedFilters);
        }, 100);
    }, [fetchPropertiesForCurrentView]);

    const handleDataSourceChange = useCallback((newType) => {

        if (popupManager.current) {
            popupManager.current.updateDataSourceType(newType);
        }

        dataSourceTypeRef.current = newType;
        setDataSourceType(newType);

        // Resetira filtre ko spremenis data source
        const emptyFilters = {};
        setActiveFilters(emptyFilters);

        if (popupManager.current) {
            popupManager.current.updateFilters(emptyFilters);
        }

        // Bbox loading
        setTimeout(() => {
            fetchPropertiesForCurrentView({});
        }, 100);
    }, [fetchPropertiesForCurrentView]);

    // ===========================================
    // OBČINE HANDLERJI - BREZ ZOOMANJA
    // ===========================================

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        // Pocisti občina hover ko jo izberes
        setHoveredRegion(null);
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
        }

        const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);

        setSelectedObcina({
            name: obcinaName,
            obcinaId: obcinaId,
            bounds: bounds
        });

        // Pridobi statistike za občino
        fetchAndSetStatistics('obcina', obcinaName, dataSourceTypeRef.current);


    }, [selectedObcina, fetchAndSetStatistics]);

    const handleSearch = useCallback((searchResult) => {
        if (!map.current) return;


        if (searchResult.coordinates?.length === 2) {
            const [lng, lat] = searchResult.coordinates;
            map.current.flyTo({
                center: [lng, lat],
                zoom: MAP_CONFIG.SEARCH_ZOOM,
                duration: MAP_CONFIG.SEARCH_DURATION,
                essential: true
            });
        }
    }, []);

    const handleRegionReset = useCallback(() => {
        if (popupManager.current) {
            popupManager.current.handleMunicipalityReset();
        }

        setSelectedObcina(null);
        setHoveredRegion(null);
        setObcinaStatistics(null); // Reset statistics

        // Pocisti vse hover efekte
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
        }

        // Takoj preveri ali naj se nepremičnine prikažejo za trenutni pogled
        setTimeout(() => {
            const currentFilters = activeFiltersRef.current;
            fetchPropertiesForCurrentView(currentFilters);
        }, 100);
    }, [fetchPropertiesForCurrentView]);

    // ===========================================
    // MAP LAYER MANAGERJI
    // ===========================================

    const loadObcine = useCallback(() => {
        if (!map.current || obcineLoaded || !layerManager.current) return;

        try {

            layerManager.current.addObcineLayers(obcineData);
            setupObcinaEventHandlers();

            setObcineLoaded(true);

        } catch (error) {
            console.error('Error loading občine:', error);
        }
    }, [obcineLoaded]);

    // ===========================================
    // EVENT HANDLERJI SETUP
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

            // Pocisti hover efekt
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

        // Mousemove za slednje hoveranja
        map.current.on('mousemove', 'obcine-fill', hoverMoveHandler);
        map.current.on('mouseleave', 'obcine-fill', hoverLeaveHandler);
        map.current.on('click', 'obcine-fill', clickHandler);

        map.current._obcinaHandlers = {
            hoverMoveHandler,
            hoverLeaveHandler,
            clickHandler
        };
    }, [selectedObcina, handleObcinaClick]);

    // ===========================================
    // ZOOM HANDLERJI
    // ===========================================

    const setupZoomHandler = () => {
        let timeoutId;
        const handleZoomEnd = () => {
            const currentZoom = map.current.getZoom();

            if (layerManager.current) {
                layerManager.current.updateLayerVisibilityByZoom(currentZoom);
            }

            // Samodejno nalaganje nepremičnin
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                const currentFilters = activeFiltersRef.current;

                // Bbox loading
                fetchPropertiesForCurrentView(currentFilters);
            }, TIMEOUTS.ZOOM_DEBOUNCE);
        };

        map.current.on('zoomend', handleZoomEnd);
        map.current.on('moveend', handleZoomEnd);
        map.current._zoomEndHandler = handleZoomEnd;
    };

    // ===========================================
    // UTILITY FUNKCIJE
    // ===========================================

    const styleMapControls = () => {
        const controlContainer = mapContainer.current?.querySelector('.maplibregl-control-container');
        if (!controlContainer) return;

        const topRightControls = controlContainer.querySelector('.maplibregl-ctrl-top-right');
        if (topRightControls) {
            topRightControls.style.top = UI_CONFIG.CONTROLS.TOP_OFFSET;
        }

        const buttons = controlContainer.querySelectorAll('.maplibregl-ctrl-group button');
        buttons.forEach(button => {
            button.style.width = UI_CONFIG.CONTROLS.BUTTON_SIZE;
            button.style.height = UI_CONFIG.CONTROLS.BUTTON_SIZE;
            button.style.fontSize = '18px';
        });

        const ctrlGroups = controlContainer.querySelectorAll('.maplibregl-ctrl-group');
        ctrlGroups.forEach(group => {
            group.style.borderRadius = UI_CONFIG.CONTROLS.BORDER_RADIUS;
            group.style.borderWidth = '1px';
            group.style.borderColor = 'var(--color-gray-200)';
            group.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            group.style.margin = '0px 8px 0 0';
        });
    };

    const cleanup = () => {
        if (map.current) {
            // Pocisti zoom handlerje
            if (map.current._zoomEndHandler) {
                map.current.off('zoomend', map.current._zoomEndHandler);
                map.current.off('moveend', map.current._zoomEndHandler);
            }

            // Pocisti občina handlerji
            if (map.current._obcinaHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._obcinaHandlers;
                map.current.off('mousemove', 'obcine-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'obcine-fill', hoverLeaveHandler);
                map.current.off('click', 'obcine-fill', clickHandler);
                delete map.current._obcinaHandlers;
            }

            // Pocisti managerje
            if (popupManager.current) {
                popupManager.current.cleanup();
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
            layerManager.current.updateObcinaSelection(selectedObcina?.obcinaId);
        }
    }, [selectedObcina]);

    // Effect za posodabljanje statistik ob spremembi data source
    useEffect(() => {
        // Ko se spremeni data source, ponovno pridobi statistike
        if (selectedObcina) {
            fetchAndSetStatistics('obcina', selectedObcina.name, dataSourceType);
        }
    }, [dataSourceType, selectedObcina, fetchAndSetStatistics]);

    // Inicializacija mape
    useEffect(() => {
        if (!map.current && mapContainer.current) {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: MAP_CONFIG.STYLE_URL,
                center: MAP_CONFIG.INITIAL_CENTER,
                zoom: MAP_CONFIG.INITIAL_ZOOM,
                minZoom: 6.5,
                maxZoom: 20,
                attributionControl: false
            });

            map.current.addControl(new maplibregl.AttributionControl({
                compact: true,
                customAttribution: [
                    'Domogled.si',
                ].join(' ')
            }), 'top-left');

            if (!isMobile) {
                map.current.addControl(new maplibregl.NavigationControl(), UI_CONFIG.CONTROLS.POSITION);
            }


            map.current.on('load', () => {
                styleMapControls();
                layerManager.current = new LayerManager(map.current);
                popupManager.current = new PopupManager(map.current);
                loadObcine();
                layerManager.current.updateLayerVisibilityByZoom(MAP_CONFIG.INITIAL_ZOOM);
                setupZoomHandler();

                setTimeout(() => {
                    const currentFilters = activeFiltersRef.current;
                    fetchPropertiesForCurrentView(currentFilters);
                }, 100);
            });
        }

        return cleanup;
    }, []);

    // ===========================================
    // RENDER
    // ===========================================

    return (
        <>
            <div
                ref={mapContainer}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 3
                }}
            />

            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-700">Nalagam podatke...</span>
                    </div>
                </div>
            )}

            {/* Hover preview box za občine */}
            {hoveredRegion && !selectedObcina && (
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

            {/* NOVA STATISTIKE PANEL KOMPONENTA */}
            <StatistikePanel
                selectedMunicipality={null}
                selectedObcina={selectedObcina}
                municipalityStatistics={null}
                obcinaStatistics={obcinaStatistics}
                statisticsLoading={statisticsLoading}
                dataSourceType={dataSourceType}
                activeFilters={activeFilters}
                onGoToStatistics={handleGoToStatistics}
                onClose={handleRegionReset}
                activeTab={dataSourceType}
            />

            {/* UI komponente */}
            <Filter
                onFiltersChange={handleFiltersChange}
                dataSourceType={dataSourceType}
                isLoading={isLoading}
                activeFilters={activeFilters}
            />
            <Switcher
                activeType={dataSourceType}
                onChangeType={handleDataSourceChange}
            />
            <Iskalnik onSearch={handleSearch} />

            {/* Help gumb za ponovno odpiranje intro */}
            <button
                onClick={() => setShowIntroModal(true)}
                className={`fixed z-40 w-12 h-12 bg-white hover:bg-gray-300 text-black rounded-full shadow-lg flex items-center justify-center transition-colors duration-200 ${isMobile
                        ? 'top-50 right-3' 
                        : 'top-10 left-2'    
                    }`}
                title="Pomoč - kako uporabljati aplikacijo"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {/* Podrobnosti za nepremičnine model */}
            {showPropertyDetails && selectedProperty && (
                <Podrobnosti
                    propertyId={selectedProperty.id}
                    dataSource={selectedProperty.dataSource || getApiDataSource(dataSourceType)}
                    onClose={() => {
                        setShowPropertyDetails(false);
                        setSelectedProperty(null);
                    }}
                />
            )}

            {/* IntroModal komponenta */}
            <IntroModal
                isVisible={showIntroModal}
                onClose={handleCloseIntro}
            />
        </>
    );
}