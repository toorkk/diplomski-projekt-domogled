import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Komponente
import Filter from "../Filter";
import Switcher from "./Switcher";
import Iskalnik from "./Iskalnik";
import Podrobnosti from "./Podrobnosti";
import PopupManager from "./PopupManager";

// Importanje managerjev
import LayerManager from "./LayerManager";
import {
    MAP_CONFIG,
    DATA_SOURCE_CONFIG,
    TIMEOUTS,
    UI_CONFIG
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
    formatFilterSummary
} from './MapUtils.jsx';

// Stili in JSON podatki (katastri, občine)
import '../Stili/Zemljevid.css';
import municipalitiesData from '../Občine/KatObčine.json';
import obcineData from '../Občine/OB.json';

export default function Zemljevid() {
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
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);
    const [dataSourceType, setDataSourceType] = useState('prodaja');
    const [activeFilters, setActiveFilters] = useState({});

    // Create refs for values that need to be accessed in stable callbacks
    const activeFiltersRef = useRef({});
    const selectedMunicipalityRef = useRef(null);

    // Updejtanje ref ko se spremeni state
    // Update refs when state changes
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
    // STABLE HANDLERS - MINIMAL DEPENDENCIES
    // ===========================================

    const handlePropertySelect = useCallback((propertyData) => {
        console.log('Property selected:', propertyData);
        setSelectedProperty({ ...propertyData });
        setShowPropertyDetails(true);
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

    // ===========================================
    // FILTER AND DATA SOURCE HANDLERS
    // ===========================================

    const handleFiltersChange = useCallback((newFilters) => {
        console.log('Filters changed:', newFilters);
        
        const currentDataSourceType = dataSourceTypeRef.current;
        const validatedFilters = validateFilters(newFilters, currentDataSourceType);
        setActiveFilters(validatedFilters);

        if (popupManager.current) {
            popupManager.current.updateFilters(validatedFilters);
        }
        
        // Auto-reload using refs to avoid dependency loops
        const currentMunicipality = selectedMunicipalityRef.current;
        if (currentMunicipality?.sifko) {
            console.log('Auto-reloading data with new filters:', validatedFilters);
            setTimeout(() => {
                fetchPropertiesForMunicipality(currentMunicipality.sifko, validatedFilters);
            }, 100);
        }
    }, [fetchPropertiesForMunicipality]);

    const handleDataSourceChange = useCallback((newType) => {
        console.log(`Changing data source type to: ${newType}`);

        if (popupManager.current) {
            popupManager.current.updateDataSourceType(newType);
        }

        dataSourceTypeRef.current = newType;
        setDataSourceType(newType);

        // Reset filters when changing data source
        setActiveFilters({});
        setActiveFilters(emptyFilters);

        if (popupManager.current) {
            popupManager.current.updateFilters(emptyFilters);
        }

        // Auto-reload with empty filters
        const currentMunicipality = selectedMunicipalityRef.current;
        if (currentMunicipality?.sifko) {
            console.log(`Auto-reloading data for municipality: ${currentMunicipality.sifko}, new type: ${newType}`);
            setTimeout(() => {
                fetchPropertiesForMunicipality(currentMunicipality.sifko, {});
            }, 100);
        }
    }, [fetchPropertiesForMunicipality]);

    // ===========================================
    // MUNICIPALITY AND REGION HANDLERS
    // ===========================================

    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);

        const currentMunicipality = selectedMunicipalityRef.current;
        if (currentMunicipality?.sifko === sifko) {
            console.log(`Municipality ${municipalityName} already selected - ignoring click`);
            return;
        }

        console.log('Municipality clicked:', municipalityName, 'SIFKO:', sifko);

        if (popupManager.current) {
            popupManager.current.handleMunicipalityChange();
        }

        const bounds = calculateBoundsFromGeometry(municipalityFeature.geometry);

        setSelectedMunicipality({
            name: municipalityName,
            sifko: sifko,
            bounds: bounds
        });

        map.current.fitBounds(bounds, {
            padding: MAP_CONFIG.MUNICIPALITY_ZOOM.PADDING,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION,
            essential: true
        });

        // Load with current filters
        const currentFilters = activeFiltersRef.current;
        console.log('Loading municipality with current filters:', currentFilters);
        fetchPropertiesForMunicipality(sifko, currentFilters);
    }, [fetchPropertiesForMunicipality]);

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        if (selectedObcina?.obcinaId === obcinaId) {
            console.log(`Občina ${obcinaName} already selected - ignoring click`);
            return;
        }

        console.log('Občina clicked:', obcinaName, 'ID:', obcinaId);

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

        if (layerManager.current) {
            layerManager.current.removePropertiesLayers();
            layerManager.current.removeClustersLayers();
        }

        map.current.flyTo({
            center: MAP_CONFIG.INITIAL_CENTER,
            zoom: MAP_CONFIG.INITIAL_ZOOM,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
        });
    }, []);

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

    // ===========================================
    // EVENT HANDLERS SETUP
    // ===========================================

    const setupObcinaEventHandlers = useCallback(() => {
        if (!map.current) return;

        let currentHoveredObcinaId = null;

        const hoverMoveHandler = (e) => {
            const hoveredObcinaId = e.features[0]?.properties?.OB_ID;
            const hoveredObcinaName = e.features[0]?.properties?.OB_UIME;
            
            if (!selectedObcina || selectedObcina.obcinaId !== hoveredObcinaId) {
                map.current.getCanvas().style.cursor = 'pointer';
                
                setHoveredRegion({
                    name: hoveredObcinaName,
                    type: 'Občina'
                });
            }
        };

        const hoverLeaveHandler = () => {
            currentHoveredObcinaId = null;
            map.current.getCanvas().style.cursor = '';
            setHoveredRegion(null);
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredRegion(null);
                handleObcinaClick(e.features[0]);
            }
        };

        // Uporabljamo mousemove namesto mouseenter za boljše sledenje
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
        
        // Preveri če se je hover spremenil
        if (hoveredSifko !== currentHoveredSifko) {
            currentHoveredSifko = hoveredSifko;
            
            if (!selectedMunicipality || selectedMunicipality.sifko !== hoveredSifko) {
                map.current.getCanvas().style.cursor = 'pointer';
                
                setHoveredRegion({
                    name: hoveredMunicipalityName,
                    type: 'Občina'
                });
            }
        }
    };

        const hoverLeaveHandler = () => {
            map.current.getCanvas().style.cursor = '';
            setHoveredRegion(null);
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredRegion(null);
                handleMunicipalityClick(e.features[0]);
            }
        };

    // Uporabljamo mousemove namesto mouseenter za boljše sledenje
    map.current.on('mousemove', 'municipalities-fill', hoverMoveHandler);
    map.current.on('mouseleave', 'municipalities-fill', hoverLeaveHandler);
    map.current.on('click', 'municipalities-fill', clickHandler);

        map.current._municipalityHandlers = {
            hoverEnterHandler,
            hoverLeaveHandler,
            clickHandler
        };
    }, [selectedMunicipality, handleMunicipalityClick]);

    // ===========================================
    // ZOOM HANDLER
    // ===========================================

    const setupZoomHandler = () => {
        let timeoutId;
        const handleZoomEnd = () => {
            const currentZoom = map.current.getZoom();
            
            if (layerManager.current) {
                layerManager.current.updateLayerVisibilityByZoom(currentZoom);
            }

            const currentMunicipality = selectedMunicipalityRef.current;
            if (currentMunicipality?.sifko) {
                if (popupManager.current) {
                    popupManager.current.handleZoomChange();
                }

                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    const currentFilters = activeFiltersRef.current;
                    console.log('Zoom-triggered reload with filters:', currentFilters);
                    fetchPropertiesForMunicipality(currentMunicipality.sifko, currentFilters);
                }, TIMEOUTS.ZOOM_DEBOUNCE);
            }
        };

        map.current.on('zoomend', handleZoomEnd);
        map.current._zoomEndHandler = handleZoomEnd;
    };

    // ===========================================
    // UTILITY FUNCTIONS
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

    // Map initialization
    useEffect(() => {
        if (!map.current && mapContainer.current) {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: MAP_CONFIG.STYLE_URL,
                center: MAP_CONFIG.INITIAL_CENTER,
                zoom: MAP_CONFIG.INITIAL_ZOOM
            });

            map.current.addControl(new maplibregl.NavigationControl(), UI_CONFIG.CONTROLS.POSITION);

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

    const hasActiveFilters = Object.keys(activeFilters).length > 0;

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
                    zIndex: 0
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

            {/* Hover preview box */}
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
                                {hasActiveFilters && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                )}
                            </div>
                            {hasActiveFilters && (
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                    {formatFilterSummary(activeFilters, dataSourceType)}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleMunicipalityReset}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* UI Components */}
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

            {/* Property details modal */}
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