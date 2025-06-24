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
    getMunicipalityName,
    getObcinaName,
    getObcinaId,
    calculateBoundsFromGeometry,
    handleApiError,
    validateFilters,
    fetchStatistics
} from './MapUtils.jsx';

// Stili in JSON podatki (katastri, občine)
import '../Stili/Zemljevid.css';
import municipalitiesData from '../../Občine/Katastri_Maribor_Ljubljana.json';
import obcineData from '../../Občine/OB.json';

export default function Zemljevid({ onNavigateToStatistics }) {
    // Refs
    const mapContainer = useRef(null);
    const map = useRef(null);
    const popupManager = useRef(null);
    const layerManager = useRef(null);
    const dataSourceTypeRef = useRef('prodaja');

    // Definiranje STATOV (malo ugabno)
    const [isLoading, setIsLoading] = useState(false);
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [hoveredRegion, setHoveredRegion] = useState(null);
    const [hoveredMunicipality, setHoveredMunicipality] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);
    const [dataSourceType, setDataSourceType] = useState('prodaja');
    const [activeFilters, setActiveFilters] = useState({});

    // State za statistike
    const [municipalityStatistics, setMunicipalityStatistics] = useState(null);
    const [obcinaStatistics, setObcinaStatistics] = useState(null);
    const [statisticsLoading, setStatisticsLoading] = useState(false);

    const activeFiltersRef = useRef({});
    const selectedMunicipalityRef = useRef(null);

    const isMobile = window.innerWidth <= 768;

    // Updejtanje ref ko se spremeni state
    useEffect(() => {
        dataSourceTypeRef.current = dataSourceType;
    }, [dataSourceType]);

    useEffect(() => {
        activeFiltersRef.current = activeFilters;
    }, [activeFilters]);

    useEffect(() => {
        selectedMunicipalityRef.current = selectedMunicipality;
    }, [selectedMunicipality]);

    // ===========================================
    // STABILNI HANDLERJI
    // ===========================================

    const handlePropertySelect = useCallback((propertyData) => {
        console.log('Property selected:', propertyData);
        setSelectedProperty({ ...propertyData });
        setShowPropertyDetails(true);
    }, []);

    // POSODOBLJENA funkcija za navigacijo na statistike
    const handleGoToStatistics = useCallback(() => {
        if (selectedMunicipality) {
            // Za kataster - odstrani SIFKO iz imena
            const municipalityName = selectedMunicipality.name.split(' (')[0].trim();
            const regionData = {
                name: municipalityName,
                type: 'katastrska_obcina',
                sifko: selectedMunicipality.sifko,
                // NOVO: Dodaj flag da naj se avtomatsko zoomira na zemljevidu
                autoZoomToRegion: true
            };
            onNavigateToStatistics?.(regionData);
        } else if (selectedObcina) {
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
    }, [selectedMunicipality, selectedObcina, onNavigateToStatistics]);

    const fetchAndSetStatistics = useCallback(async (tipRegije, regija, dataSourceType) => {
        setStatisticsLoading(true);
        try {
            const statistics = await fetchStatistics(tipRegije, regija);

            if (tipRegije === 'katastrska_obcina') {
                setMunicipalityStatistics(statistics);
            } else if (tipRegije === 'obcina') {
                setObcinaStatistics(statistics);
            }
        } catch (error) {
            console.error('Error fetching statistics:', error);
        } finally {
            setStatisticsLoading(false);
        }
    }, []);

    const fetchPropertiesForMunicipality = useCallback(async (sifko, filters = {}) => {
        if (!map.current || isLoading || !sifko) return;

        setIsLoading(true);

        try {
            const currentDataSourceType = dataSourceTypeRef.current;
            const apiDataSource = getApiDataSource(currentDataSourceType);

            console.log(`Loading data for municipality: ${sifko}, type: ${currentDataSourceType}, filters:`, filters);

            const url = buildPropertiesUrl('0,0,0,0', 15, apiDataSource, sifko, null, filters);
            console.log(`API URL: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();

            console.log(`API response:`, geojson);
            console.log(`Total features returned: ${geojson.features.length}`);

            const individualFeatures = geojson.features.filter(f => f.properties.type === 'individual');
            const clusterFeatures = geojson.features.filter(f => f.properties.type === 'cluster');

            console.log('Individual features:', individualFeatures.length);
            console.log('Cluster features:', clusterFeatures.length);

            if (layerManager.current) {
                layerManager.current.addPropertiesLayers(individualFeatures, currentDataSourceType);
                layerManager.current.addClustersLayers(clusterFeatures, currentDataSourceType);
            }

            if (popupManager.current) {
                popupManager.current.setupEventHandlers(handlePropertySelect);
            }

            console.log(`Loaded ${geojson.features.length} properties for municipality`);

        } catch (error) {
            handleApiError(error, 'loading properties for municipality');
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, handlePropertySelect]);

    // Funkcija za samodejno nalaganje nepremičnin za trenutni pogled
    const fetchPropertiesForCurrentView = useCallback(async (filters = {}) => {
        if (!map.current || isLoading) return;

        const currentZoom = map.current.getZoom();

        // Preverite ali je zoom dovolj visok za prikaz nepremičnin
        if (currentZoom < ZOOM_LEVELS.AUTO_LOAD_PROPERTIES) {
            console.log(`Zoom ${currentZoom} prenizek za prikaz nepremičnin (potreben: ${ZOOM_LEVELS.AUTO_LOAD_PROPERTIES})`);
            // Počistite obstoječe nepremičnine
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

            console.log(`Loading properties for current view - zoom: ${currentZoom}, bbox: ${bbox}, type: ${currentDataSourceType}, filters:`, filters);

            const url = buildPropertiesUrl(bbox, currentZoom, apiDataSource, null, null, filters);
            console.log(`API URL: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();

            console.log(`API response:`, geojson);
            console.log(`Total features returned: ${geojson.features.length}`);

            const individualFeatures = geojson.features.filter(f => f.properties.type === 'individual');
            const clusterFeatures = geojson.features.filter(f => f.properties.type === 'cluster');

            console.log('Individual features:', individualFeatures.length);
            console.log('Cluster features:', clusterFeatures.length);

            if (layerManager.current) {
                layerManager.current.addPropertiesLayers(individualFeatures, currentDataSourceType);
                layerManager.current.addClustersLayers(clusterFeatures, currentDataSourceType);
            }

            if (popupManager.current) {
                popupManager.current.setupEventHandlers(handlePropertySelect);
            }

            console.log(`Loaded ${geojson.features.length} properties for current view`);

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
        console.log('Filters changed:', newFilters);

        const currentDataSourceType = dataSourceTypeRef.current;
        const validatedFilters = validateFilters(newFilters, currentDataSourceType);
        setActiveFilters(validatedFilters);

        if (popupManager.current) {
            popupManager.current.updateFilters(validatedFilters);
        }

        // Bbox loading
        console.log('Auto-reloading view data with new filters:', validatedFilters);
        setTimeout(() => {
            fetchPropertiesForCurrentView(validatedFilters);
        }, 100);
    }, [fetchPropertiesForCurrentView]);

    const handleDataSourceChange = useCallback((newType) => {
        console.log(`Changing data source type to: ${newType}`);

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
        console.log(`Auto-reloading view data, new type: ${newType}`);
        setTimeout(() => {
            fetchPropertiesForCurrentView({});
        }, 100);
    }, [fetchPropertiesForCurrentView]);

    // ===========================================
    // KATASTER IN OBČINE HANDLERJI
    // ===========================================

    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);

        console.log('Municipality clicked for zoom only:', municipalityName, 'SIFKO:', sifko);

        // Odstrani kataster hover ko izberes
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

        // Pridobi statistike za kataster
        const katastrName = municipalityFeature.properties.NAZIV || municipalityFeature.properties.IMEKO;
        if (katastrName) {
            fetchAndSetStatistics('katastrska_obcina', katastrName, dataSourceTypeRef.current);
        }

        // Zoom na kataster
        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });

    }, [fetchAndSetStatistics]);

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) {
            console.log(`Občina ${obcinaName} already selected - ignoring click`);
            return;
        }

        console.log('Občina clicked:', obcinaName, 'ID:', obcinaId);

        // Pocisti občina hover ko jo izberes
        setHoveredRegion(null);
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
        }

        setSelectedMunicipality(null);
        setMunicipalityStatistics(null); // Reset municipality statistics

        const bounds = calculateBoundsFromGeometry(obcinaFeature.geometry);

        setSelectedObcina({
            name: obcinaName,
            obcinaId: obcinaId,
            bounds: bounds
        });

        // Pridobi statistike za občino
        fetchAndSetStatistics('obcina', obcinaName, dataSourceTypeRef.current);

        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });
    }, [selectedObcina, fetchAndSetStatistics]);

    const handleSearch = useCallback((searchResult) => {
        if (!map.current) return;

        console.log('Search result:', searchResult);

        if (searchResult.coordinates?.length === 2) {
            const [lng, lat] = searchResult.coordinates;
            map.current.flyTo({
                center: [lng, lat],
                zoom: MAP_CONFIG.SEARCH_ZOOM,
                duration: MAP_CONFIG.SEARCH_DURATION,
                essential: true
            });
        } else if (searchResult.query) {
            console.log("No location found for search query");
        }
    }, []);

    const handleMunicipalityReset = useCallback(() => {
        if (popupManager.current) {
            popupManager.current.handleMunicipalityReset();
        }

        setSelectedMunicipality(null);
        setSelectedObcina(null);
        setHoveredRegion(null);
        setHoveredMunicipality(null);
        setMunicipalityStatistics(null); // Reset statistics
        setObcinaStatistics(null); // Reset statistics

        // Pocisti vse hover efekte
        if (layerManager.current) {
            layerManager.current.updateObcinaHover(null);
            layerManager.current.updateMunicipalityHover(null);
        }

        map.current.flyTo({
            center: MAP_CONFIG.INITIAL_CENTER,
            zoom: MAP_CONFIG.INITIAL_ZOOM,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
        });

        // Po resetu preveri ali naj se nepremičnine prikažejo
        setTimeout(() => {
            const currentFilters = activeFiltersRef.current;
            fetchPropertiesForCurrentView(currentFilters);
        }, MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION + 100);
    }, [fetchPropertiesForCurrentView]);

    // ===========================================
    // MAP LAYER MANAGERJI
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

            // Pocisti hover efekt
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

        // Mousemove za hoveranje
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
                console.log('Zoom-triggered property loading with filters:', currentFilters);

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

            // Pocisti kataster handlerje
            if (map.current._municipalityHandlers) {
                const { hoverMoveHandler, hoverLeaveHandler, clickHandler } = map.current._municipalityHandlers;
                map.current.off('mousemove', 'municipalities-fill', hoverMoveHandler);
                map.current.off('mouseleave', 'municipalities-fill', hoverLeaveHandler);
                map.current.off('click', 'municipalities-fill', clickHandler);
                delete map.current._municipalityHandlers;
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
            layerManager.current.updateMunicipalitySelection(selectedMunicipality?.sifko);
        }
    }, [selectedMunicipality]);

    useEffect(() => {
        if (map.current && layerManager.current) {
            layerManager.current.updateObcinaSelection(selectedObcina?.obcinaId);
        }
    }, [selectedObcina]);

    // Effect za posodabljanje statistik ob spremembi data source
    useEffect(() => {
        // Ko se spremeni data source, ponovno pridobi statistike
        if (selectedMunicipality) {
            const katastrName = selectedMunicipality.name.split(' (')[0]; // Odstrani SIFKO iz imena
            fetchAndSetStatistics('katastrska_obcina', katastrName, dataSourceType);
        }

        if (selectedObcina) {
            fetchAndSetStatistics('obcina', selectedObcina.name, dataSourceType);
        }
    }, [dataSourceType, selectedMunicipality, selectedObcina, fetchAndSetStatistics]);

    // Inicializacija mape
    useEffect(() => {
        if (!map.current && mapContainer.current) {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: MAP_CONFIG.STYLE_URL,
                center: MAP_CONFIG.INITIAL_CENTER,
                zoom: MAP_CONFIG.INITIAL_ZOOM,
                minZoom: 7.5,
                maxZoom: 20,
                attributionControl: false
            });

            if (!isMobile) {
                map.current.addControl(new maplibregl.NavigationControl(), UI_CONFIG.CONTROLS.POSITION);
            }
            map.current.on('load', () => {
                styleMapControls();
                layerManager.current = new LayerManager(map.current);
                popupManager.current = new PopupManager(map.current);
                loadObcine();
                loadMunicipalities();
                layerManager.current.updateLayerVisibilityByZoom(MAP_CONFIG.INITIAL_ZOOM);
                setupZoomHandler();
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

            {/* Hover preview box za katastrske občine (municipalities) */}
            {hoveredMunicipality && selectedObcina && !selectedMunicipality && (
                <div className="absolute bottom-100 right-4 z-30 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-2">
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

            {/* NOVA STATISTIKE PANEL KOMPONENTA */}
            <StatistikePanel
                selectedMunicipality={selectedMunicipality}
                selectedObcina={selectedObcina}
                municipalityStatistics={municipalityStatistics}
                obcinaStatistics={obcinaStatistics}
                statisticsLoading={statisticsLoading}
                dataSourceType={dataSourceType}
                activeFilters={activeFilters}
                onGoToStatistics={handleGoToStatistics}
                onClose={handleMunicipalityReset}
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
        </>
    );
}