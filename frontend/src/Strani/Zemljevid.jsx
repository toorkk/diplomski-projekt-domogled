import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Filter from "../Filter";
import Switcher from "./Switcher";
import Iskalnik from "./Iskalnik";
import '../Stili/Zemljevid.css';
import Podrobnosti from "./Podrobnosti";
import PopupManager from "./PopupManager";

export default function Zemljevid() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const popupManager = useRef(null);
    // Use ref to track current data source type for event handlers
    const dataSourceTypeRef = useRef('prodaja');
    
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [propertiesLoaded, setPropertiesLoaded] = useState(false);
    const [lastBounds, setLastBounds] = useState(null);
    const [lastZoom, setLastZoom] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);
    // Keep state for UI updates
    const [dataSourceType, setDataSourceType] = useState('prodaja');

    // Update ref whenever state changes
    useEffect(() => {
        dataSourceTypeRef.current = dataSourceType;
    }, [dataSourceType]);

    // preverja če se je mapa dovolj premaknila za ponovno nalaganje podatkov
    const hasBoundsChanged = useCallback((newBounds, oldBounds) => {
        if (!oldBounds) return true;

        // preveri zoom change
        if (Math.abs(map.current.getZoom() - lastZoom) > 0.5) return true;

        const threshold = 0.001;
        return (
            Math.abs(newBounds.getWest() - oldBounds.getWest()) > threshold ||
            Math.abs(newBounds.getEast() - oldBounds.getEast()) > threshold ||
            Math.abs(newBounds.getNorth() - oldBounds.getNorth()) > threshold ||
            Math.abs(newBounds.getSouth() - oldBounds.getSouth()) > threshold
        );
    }, [lastZoom]);

    // Handler za izbiro nepremičnine
    const handlePropertySelect = useCallback((propertyData) => {
        setSelectedProperty(propertyData);
        setShowPropertyDetails(true);
    }, []);

    // pridobitev podatkov iz backenda - uporabljamo ref za data source type
    const fetchPropertiesForViewport = useCallback(async () => {
        if (!map.current || isLoading) return;

        const currentBounds = map.current.getBounds();
        const currentZoom = map.current.getZoom();

        if (!hasBoundsChanged(currentBounds, lastBounds)) {
            console.log('meje in zoom enaki, ne gettam');
            return;
        }

        setIsLoading(true);

        try {
            const bbox = `${currentBounds.getWest()},${currentBounds.getSouth()},${currentBounds.getEast()},${currentBounds.getNorth()}`;

            // Pridobivanje current data sourca
            const currentDataSourceType = dataSourceTypeRef.current;
            const dataSource = currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
            
            console.log(`Nalagam podatke za tip: ${currentDataSourceType}, data_source=${dataSource}`);
            
            const response = await fetch(`http://localhost:8000/properties/geojson?bbox=${bbox}&zoom=${currentZoom}&data_source=${dataSource}`);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();

            // odstrani stare layers
            if (map.current.getSource('properties')) {
                map.current.removeLayer('properties-layer');
                map.current.removeSource('properties');
            }
            if (map.current.getSource('clusters')) {
                map.current.removeLayer('clusters-layer');
                map.current.removeLayer('cluster-count-layer');
                map.current.removeSource('clusters');
            }

            const individualFeatures = geojson.features.filter(f => f.properties.type === 'individual');
            const clusterFeatures = geojson.features.filter(f => f.properties.type === 'cluster');

            // Add individualni deli stavb
            if (individualFeatures.length > 0) {
                map.current.addSource('properties', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: individualFeatures
                    }
                });

                // Different colors based on data source type - use ref value
                const circleColor = currentDataSourceType === 'prodaja' ? '#3B82F6' : '#10B981';
                const strokeColor = currentDataSourceType === 'prodaja' ? '#1D4ED8' : '#059669';

                map.current.addLayer({
                    id: 'properties-layer',
                    type: 'circle',
                    source: 'properties',
                    paint: {
                        'circle-radius': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            8, 3,
                            12, 6,
                            16, 10
                        ],
                        'circle-color': circleColor,
                        'circle-opacity': 0.7,
                        'circle-stroke-width': 1,
                        'circle-stroke-color': strokeColor
                    }
                });
            }

            // Add deli stavb clusterje
            if (clusterFeatures.length > 0) {
                map.current.addSource('clusters', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: clusterFeatures
                    }
                });

                // Razlicne barve clusterjev glede na datasource
             const clusterColors = currentDataSourceType === 'prodaja' 
    ? ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF'] // Blue gradient
    : ['#34D399', '#10B981', '#059669', '#047857'];

                map.current.addLayer({
                    id: 'clusters-layer',
                    type: 'circle',
                    source: 'clusters',
                    paint: {
                        'circle-radius': [
                            'interpolate',
                            ['linear'],
                            ['get', 'point_count'],
                            1, 15,
                            100, 25,
                            1000, 35,
                            10000, 45
                        ],
                        'circle-color': [
                            'interpolate',
                            ['linear'],
                            ['get', 'point_count'],
                            1, clusterColors[0],
                            100, clusterColors[1],
                            1000, clusterColors[2],
                            10000, clusterColors[3]
                        ],
                        'circle-opacity': 0.8,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff'
                    }
                });

                map.current.addLayer({
                    id: 'cluster-count-layer',
                    type: 'symbol',
                    source: 'clusters',
                    layout: {
                        'text-field': '{point_count}',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-size': [
                            'interpolate',
                            ['linear'],
                            ['get', 'point_count'],
                            1, 10,
                            100, 12,
                            1000, 14,
                            10000, 16
                        ]
                    },
                    paint: {
                        'text-color': '#ffffff'
                    }
                });
            }

            // Nastavimo popupe in click handlere preko PopupManager
            if (popupManager.current) {
                popupManager.current.setupEventHandlers(handlePropertySelect);
            }

            setLastBounds(currentBounds);
            setLastZoom(currentZoom);

            console.log(`Naložil ${geojson.features.length} del stavb za tip: ${currentDataSourceType}`);
            setPropertiesLoaded(true);

        } catch (error) {
            console.error('Error pri nalaganju del stavb:', error);
        } finally {
            setIsLoading(false);
        }

    }, [isLoading, lastBounds, hasBoundsChanged, handlePropertySelect]);

    // Handler za spremembo data sourca (najem, nakup)
    const handleDataSourceChange = useCallback((newType) => {
        console.log(`Menjam data source type na: ${newType}`);
        setDataSourceType(newType);
        // Reset bounds to force new data load
        setLastBounds(null);
    }, []);

    // Effect da realoada data ko se datasource change-a
    useEffect(() => {
        if (map.current && map.current.loaded()) {
            // Posodobite PopupManager z novim tipom
            if (popupManager.current) {
                popupManager.current.updateDataSourceType(dataSourceType);
            }
            
            console.log(`Data source type spremenjen na: ${dataSourceType}, reload podatkov`);
            fetchPropertiesForViewport();
        }
    }, [dataSourceType, fetchPropertiesForViewport]);

    useEffect(() => {
        if (!map.current && mapContainer.current) {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: "https://api.maptiler.com/maps/0196d56b-a9a2-7fd7-90c8-96455f98e5e4/style.json?key=VxVsHKinUjiHiI3FPcfq",
                center: [14.9, 46.14],
                zoom: 7.8
            });

            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

            map.current.on('load', () => {
                const controlContainer = mapContainer.current.querySelector('.maplibregl-control-container');

                if (controlContainer) {
                    const topRightControls = controlContainer.querySelector('.maplibregl-ctrl-top-right');
                    if (topRightControls) {
                        topRightControls.style.top = '260px';
                    }

                    const buttons = controlContainer.querySelectorAll('.maplibregl-ctrl-group button');
                    buttons.forEach(button => {
                        button.style.width = '47px';
                        button.style.height = '47px';
                        button.style.fontSize = '18px';
                    });

                    const ctrlGroups = controlContainer.querySelectorAll('.maplibregl-ctrl-group');
                    ctrlGroups.forEach(group => {
                        group.style.borderRadius = '8px';
                        group.style.borderWidth = '1px';
                        group.style.borderColor = 'var(--color-gray-200)'
                        group.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                        group.style.margin = '0px 8px 0 0';
                    });
                }

                // Inicializacija PopupManager-a
                popupManager.current = new PopupManager(map.current);
                
                fetchPropertiesForViewport();
            });

            // Store the event listener - without useCallback to avoid closure issues
            let timeoutId;
            const handleMoveEnd = () => {
                console.log(`Map move - trenutni data source type: ${dataSourceTypeRef.current}`);
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    fetchPropertiesForViewport();
                }, 550);
            };

            map.current.on('moveend', handleMoveEnd);

            // Store the handler for cleanup
            map.current._moveEndHandler = handleMoveEnd;
        }

        return () => {
            if (map.current) {
                //cleanup
                if (map.current._moveEndHandler) {
                    map.current.off('moveend', map.current._moveEndHandler);
                }
                
                // Cleanup preko PopupManager
                if (popupManager.current) {
                    popupManager.current.cleanup();
                }

                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Funkcija za iskalnik se poveze na Iskalnik komponento
    const handleSearch = (searchResult) => {
        if (!map.current) return;

        console.log('Iskanje rezultat:', searchResult);

        if (searchResult.coordinates && searchResult.coordinates.length === 2) {
            const [lng, lat] = searchResult.coordinates;

            // Mapo zoomne in
            map.current.flyTo({
                center: [lng, lat],
                zoom: 17,
                duration: 1500,
                essential: true
            });
        } else if (searchResult.query) {
            console.log("ni lokacije brt");
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

            {/* Loading */}
            {isLoading && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
                    <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm text-gray-700">Nalagam podatke...</span>
                    </div>
                </div>
            )}

            <Filter />
            <Switcher activeType={dataSourceType} onChangeType={handleDataSourceChange} />
            <Iskalnik onSearch={handleSearch} />

            {showPropertyDetails && selectedProperty && (
                <Podrobnosti
                    propertyId={selectedProperty.id}
                    initialData={selectedProperty}
                    onClose={() => {
                        setShowPropertyDetails(false);
                        setSelectedProperty(null);
                    }}
                />
            )}
        </>
    );
}