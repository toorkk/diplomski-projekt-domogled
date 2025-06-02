
import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Components
import Filter from "../Filter";
import Switcher from "./Switcher";
import Iskalnik from "./Iskalnik";
import Podrobnosti from "./Podrobnosti";
import PopupManager from "./PopupManager";

// Managers and utilities
import LayerManager from "./LayerManager";
import { 
    MAP_CONFIG, 
    DATA_SOURCE_CONFIG, 
    TIMEOUTS,
    UI_CONFIG 
} from './MapConstants.jsx';
import {
    buildPropertiesUrl,
    getApiDataSource,
    getMunicipalityName,
    getObcinaName,
    getObcinaId,
    calculateBoundsFromGeometry,
    handleApiError
} from './MapUtils.jsx';

// Styles and data
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

    // State
    const [isLoading, setIsLoading] = useState(false);
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [obcineLoaded, setObcineLoaded] = useState(false);
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [hoveredRegion, setHoveredRegion] = useState(null); // New hover state
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);
    const [dataSourceType, setDataSourceType] = useState('prodaja');

    // Update ref when state changes
    useEffect(() => {
        dataSourceTypeRef.current = dataSourceType;
    }, [dataSourceType]);

    // Handlers
    const handlePropertySelect = useCallback((propertyData) => {
        console.log('Property selected:', propertyData);
        setSelectedProperty({ ...propertyData });
        setShowPropertyDetails(true);
    }, []);

    const handleObcinaClick = useCallback((obcinaFeature) => {
        if (!map.current || !obcinaFeature) return;

        const obcinaId = getObcinaId(obcinaFeature);
        const obcinaName = getObcinaName(obcinaFeature);

        // Don't do anything if same občina is already selected
        if (selectedObcina?.obcinaId === obcinaId) {
            console.log(`Občina ${obcinaName} already selected - ignoring click`);
            return;
        }

        console.log('Občina clicked:', obcinaName, 'ID:', obcinaId);

        // Reset municipality selection
        setSelectedMunicipality(null);

        // Calculate bounds and zoom to občina
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

        // Don't load properties for občina - wait for municipality selection
    }, [selectedObcina]);

    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = getMunicipalityName(municipalityFeature);

        // Don't do anything if same municipality is already selected
        if (selectedMunicipality?.sifko === sifko) {
            console.log(`Municipality ${municipalityName} already selected - ignoring click`);
            return;
        }

        console.log('Municipality clicked:', municipalityName, 'SIFKO:', sifko);

        // Cleanup previous selection
        if (popupManager.current) {
            popupManager.current.handleMunicipalityChange();
        }

        // Calculate bounds and zoom to municipality
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

        // Load properties for this municipality
        fetchPropertiesForMunicipality(sifko);
    }, [selectedMunicipality]);

    const handleDataSourceChange = useCallback((newType) => {
        console.log(`Changing data source type to: ${newType}`);

        // Cleanup via PopupManager
        if (popupManager.current) {
            popupManager.current.updateDataSourceType(newType);
        }

        // Update refs and state
        dataSourceTypeRef.current = newType;
        setDataSourceType(newType);

        // Reload data if municipality is selected
        if (selectedMunicipality?.sifko) {
            console.log(`Reloading data for municipality: ${selectedMunicipality.sifko}, new type: ${newType}`);
            fetchPropertiesForMunicipality(selectedMunicipality.sifko);
        }
    }, [selectedMunicipality]);

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
        // Cleanup via PopupManager
        if (popupManager.current) {
            popupManager.current.handleMunicipalityReset();
        }

        setSelectedMunicipality(null);
        setSelectedObcina(null);
        setHoveredRegion(null); // Clear hover state on reset

        // Clear property data
        if (layerManager.current) {
            layerManager.current.removePropertiesLayers();
            layerManager.current.removeClustersLayers();
        }

        // Zoom back to initial position
        map.current.flyTo({
            center: MAP_CONFIG.INITIAL_CENTER,
            zoom: MAP_CONFIG.INITIAL_ZOOM,
            duration: MAP_CONFIG.MUNICIPALITY_ZOOM.DURATION
        });
    }, []);

    // Data fetching
    const fetchPropertiesForMunicipality = useCallback(async (sifko) => {
        if (!map.current || isLoading || !sifko) return;

        setIsLoading(true);

        try {
            const currentDataSourceType = dataSourceTypeRef.current;
            const apiDataSource = getApiDataSource(currentDataSourceType);

            console.log(`Loading ALL data for municipality: ${sifko}, type: ${currentDataSourceType}, data_source=${apiDataSource}`);

            const url = buildPropertiesUrl('0,0,0,0', 15, apiDataSource, sifko);
            console.log(`API URL: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();
            
            console.log(`API response:`, geojson);
            console.log(`Total features returned: ${geojson.features.length}`);

            // Process features
            const individualFeatures = geojson.features.filter(f => f.properties.type === 'individual');
            const clusterFeatures = geojson.features.filter(f => f.properties.type === 'cluster');

            console.log('Individual features:', individualFeatures.length);
            console.log('Cluster features:', clusterFeatures.length);

            // Update layers using LayerManager
            if (layerManager.current) {
                layerManager.current.addPropertiesLayers(individualFeatures, currentDataSourceType);
                layerManager.current.addClustersLayers(clusterFeatures, currentDataSourceType);
            }

            // Setup popup event handlers
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

    // Municipalities and občine management
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

    const setupObcinaEventHandlers = useCallback(() => {
        if (!map.current) return;

        const hoverEnterHandler = (e) => {
            const hoveredObcinaId = e.features[0]?.properties?.OB_ID;
            const hoveredObcinaName = e.features[0]?.properties?.OB_UIME;
            
            if (!selectedObcina || selectedObcina.obcinaId !== hoveredObcinaId) {
                map.current.getCanvas().style.cursor = 'pointer';
                
                // Set hover state
                setHoveredRegion({
                    name: hoveredObcinaName,
                    type: 'Občina'
                });
            }
        };

        const hoverLeaveHandler = () => {
            map.current.getCanvas().style.cursor = '';
            setHoveredRegion(null); // Clear hover state
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredRegion(null); // Clear hover on click
                handleObcinaClick(e.features[0]);
            }
        };

        map.current.on('mouseenter', 'obcine-fill', hoverEnterHandler);
        map.current.on('mouseleave', 'obcine-fill', hoverLeaveHandler);
        map.current.on('click', 'obcine-fill', clickHandler);

        // Store handlers for cleanup
        map.current._obcinaHandlers = {
            hoverEnterHandler,
            hoverLeaveHandler,
            clickHandler
        };
    }, [selectedObcina, handleObcinaClick]);

    const setupMunicipalityEventHandlers = useCallback(() => {
        if (!map.current) return;

        const hoverEnterHandler = (e) => {
            const hoveredSifko = e.features[0]?.properties?.SIFKO;
            const hoveredMunicipalityName = getMunicipalityName(e.features[0]);
            
            if (!selectedMunicipality || selectedMunicipality.sifko !== hoveredSifko) {
                map.current.getCanvas().style.cursor = 'pointer';
                
                // Set hover state
                setHoveredRegion({
                    name: hoveredMunicipalityName,
                    type: 'Občina'
                });
            }
        };

        const hoverLeaveHandler = () => {
            map.current.getCanvas().style.cursor = '';
            setHoveredRegion(null); // Clear hover state
        };

        const clickHandler = (e) => {
            if (e.features && e.features[0]) {
                setHoveredRegion(null); // Clear hover on click
                handleMunicipalityClick(e.features[0]);
            }
        };

        map.current.on('mouseenter', 'municipalities-fill', hoverEnterHandler);
        map.current.on('mouseleave', 'municipalities-fill', hoverLeaveHandler);
        map.current.on('click', 'municipalities-fill', clickHandler);

        // Store handlers for cleanup
        map.current._municipalityHandlers = {
            hoverEnterHandler,
            hoverLeaveHandler,
            clickHandler
        };
    }, [selectedMunicipality, handleMunicipalityClick]);

    // Effects
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
                // Style controls
                styleMapControls();

                // Initialize managers
                layerManager.current = new LayerManager(map.current);
                popupManager.current = new PopupManager(map.current);

                // IMPORTANT: Load občine FIRST to establish proper layer order
                // This ensures občine outline will be above municipalities outline
                loadObcine();
                
                // Then load municipalities (will be inserted below občine)
                loadMunicipalities();

                // Set initial layer visibility based on zoom
                layerManager.current.updateLayerVisibilityByZoom(MAP_CONFIG.INITIAL_ZOOM);
            });

            // Setup zoom handler
            setupZoomHandler();
        }

        return cleanup;
    }, []);

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

    const setupZoomHandler = () => {
        let timeoutId;
        const handleZoomEnd = () => {
            const currentZoom = map.current.getZoom();
            
            // Update layer visibility based on zoom level
            if (layerManager.current) {
                layerManager.current.updateLayerVisibilityByZoom(currentZoom);
            }

            if (selectedMunicipality?.sifko) {
                if (popupManager.current) {
                    popupManager.current.handleZoomChange();
                }

                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    fetchPropertiesForMunicipality(selectedMunicipality.sifko);
                }, TIMEOUTS.ZOOM_DEBOUNCE);
            }
        };

        map.current.on('zoomend', handleZoomEnd);
        map.current._zoomEndHandler = handleZoomEnd;
    };

    const cleanup = () => {
        if (map.current) {
            // Cleanup zoom handler
            if (map.current._zoomEndHandler) {
                map.current.off('zoomend', map.current._zoomEndHandler);
            }

            // Cleanup občina handlers
            if (map.current._obcinaHandlers) {
                const { hoverEnterHandler, hoverLeaveHandler, clickHandler } = map.current._obcinaHandlers;
                map.current.off('mouseenter', 'obcine-fill', hoverEnterHandler);
                map.current.off('mouseleave', 'obcine-fill', hoverLeaveHandler);
                map.current.off('click', 'obcine-fill', clickHandler);
                delete map.current._obcinaHandlers;
            }

            // Cleanup municipality handlers
            if (map.current._municipalityHandlers) {
                const { hoverEnterHandler, hoverLeaveHandler, clickHandler } = map.current._municipalityHandlers;
                map.current.off('mouseenter', 'municipalities-fill', hoverEnterHandler);
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

            {/* Hover preview box - shows on hover, hides on selection */}
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

            {/* Selected municipality or občina indicator - shows when selected */}
            {(selectedMunicipality || selectedObcina) && (
                <div className="absolute bottom-4 right-4 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">
                            {selectedMunicipality 
                                ? `Kataster: ${selectedMunicipality.name}` 
                                : `Občina: ${selectedObcina.name}`
                            }
                        </span>
                        <button
                            onClick={handleMunicipalityReset}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* UI Components */}
            <Filter />
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