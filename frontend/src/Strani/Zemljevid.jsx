import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Filter from "../Filter";
import Switcher from "./Switcher";
import Iskalnik from "./Iskalnik";
import '../Stili/Zemljevid.css';
import Podrobnosti from "./Podrobnosti";
import PopupManager from "./PopupManager";
import municipalitiesData from '../Občine/KatObčine.json';

export default function Zemljevid() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const popupManager = useRef(null);
    // Use ref to track current data source type for event handlers
    const dataSourceTypeRef = useRef('prodaja');

    const [isLoading, setIsLoading] = useState(false);
    const [propertiesLoaded, setPropertiesLoaded] = useState(false);
    const [municipalitiesLoaded, setMunicipalitiesLoaded] = useState(false);
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);
    // Keep state for UI updates
    const [dataSourceType, setDataSourceType] = useState('prodaja');

    // Update ref whenever state changes
    useEffect(() => {
        dataSourceTypeRef.current = dataSourceType;
    }, [dataSourceType]);

    // Handler za izbiro nepremičnine
    const handlePropertySelect = useCallback((propertyData) => {
        console.log('Property selected:', propertyData);

        setSelectedProperty({
            ...propertyData,
        });
        setShowPropertyDetails(true);
    }, []);

    // Handler za klik na občino
    const handleMunicipalityClick = useCallback((municipalityFeature) => {
        if (!map.current || !municipalityFeature) return;

        const sifko = municipalityFeature.properties.SIFKO;
        const municipalityName = municipalityFeature.properties.IMEKO || `KO ${sifko}`;

        // PREVERI: Če je ta občina že izbrana, ne naredi NIČ (ne kliči cleanup)
        if (selectedMunicipality && selectedMunicipality.sifko === sifko) {
            console.log(`Občina ${municipalityName} je že izbrana - popolnoma ignoriram klik (brez cleanup)`);
            return;
        }

        console.log('Municipality clicked:', municipalityName, 'SIFKO:', sifko);
        
        // CLEAN: Uporabi PopupManager za cleanup SAMO če menjaš na drugo občino
        if (popupManager.current) {
            popupManager.current.handleMunicipalityChange();
        }
        
        // Izračunaj bounds za občino
        const coordinates = municipalityFeature.geometry.coordinates;
        let bounds = new maplibregl.LngLatBounds();
        
        // Funkcija za dodajanje koordinat v bounds (rekurzivno za različne tipe geometrij)
        const addCoordinatesToBounds = (coords) => {
            if (Array.isArray(coords[0])) {
                // Če je array of arrays, gremo rekurzivno globlje
                coords.forEach(coord => addCoordinatesToBounds(coord));
            } else {
                // Če so to koordinate [lng, lat], jih dodamo v bounds
                bounds.extend(coords);
            }
        };

        addCoordinatesToBounds(coordinates);

        // Shrani izbrano občino
        setSelectedMunicipality({
            name: municipalityName,
            sifko: sifko,
            bounds: bounds
        });

        // Zoomira na občino
        map.current.fitBounds(bounds, {
            padding: 50,
            duration: 1500,
            essential: true
        });

        // Nalozi podatke za to občino z SIFKO
        fetchPropertiesForMunicipality(sifko);
    }, [selectedMunicipality]); // Dodaj selectedMunicipality v dependencies

    // NOVA FUNKCIJA: Posodobi hover behavior za občine
    const updateMunicipalityHoverBehavior = useCallback(() => {
        if (!map.current) return;

        // Odstrani stare hover handlerje
        map.current.off('mouseenter', 'municipalities-fill');
        map.current.off('mouseleave', 'municipalities-fill');

        // Dodaj nove hover handlerje
        map.current.on('mouseenter', 'municipalities-fill', (e) => {
            const hoveredSifko = e.features[0]?.properties?.SIFKO;
            // Samo če ni izbrana občina, prikaži pointer
            if (!selectedMunicipality || selectedMunicipality.sifko !== hoveredSifko) {
                map.current.getCanvas().style.cursor = 'pointer';
            }
        });

        map.current.on('mouseleave', 'municipalities-fill', () => {
            map.current.getCanvas().style.cursor = '';
        });
    }, [selectedMunicipality]);
    const loadMunicipalities = useCallback(() => {
        if (!map.current || municipalitiesLoaded) return;
        
        try {
            console.log('Loading municipalities layer...');
            
            // Dodajte source za občine
            map.current.addSource('municipalities', {
                type: 'geojson',
                data: municipalitiesData
            });
            
            // Dodajte fill layer za klikabilno površino (nevidna)
            map.current.addLayer({
                id: 'municipalities-fill',
                type: 'fill',
                source: 'municipalities',
                paint: {
                    'fill-color': 'transparent',
                    'fill-opacity': 0
                }
            });
            
            // Dodajte outline layer (robovi občin)
            map.current.addLayer({
                id: 'municipalities-outline',
                type: 'line',
                source: 'municipalities',
                paint: {
                    'line-color': '#64748b',
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        6, 0.5,
                        8, 0.8,
                        10, 1,
                        12, 1.2,
                        14, 1.5
                    ],
                    'line-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        6, 0.3,
                        8, 0.5,
                        10, 0.7,
                        12, 0.8
                    ]
                }
            });
            
            // Dodajte labels layer (imena katastrskih občin)
            map.current.addLayer({
                id: 'municipalities-labels',
                type: 'symbol',
                source: 'municipalities',
                layout: {
                    'text-field': [
                        'case',
                        ['has', 'IMEKO'],
                        ['get', 'IMEKO'],
                        ['concat', 'KO ', ['get', 'SIFKO']]
                    ],
                    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                    'text-size': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        8, 0,
                        9, 10,
                        11, 12,
                        13, 14,
                        15, 16
                    ],
                    'text-anchor': 'center',
                    'text-max-width': 8,
                    'text-allow-overlap': false,
                    'text-ignore-placement': false,
                    'text-padding': 2
                },
                paint: {
                    'text-color': '#374151',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5,
                    'text-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        8, 0,
                        9, 0.7,
                        11, 1
                    ]
                }
            });

            // Dodaj hover effect
            map.current.on('mouseenter', 'municipalities-fill', () => {
                map.current.getCanvas().style.cursor = 'pointer';
            });

            map.current.on('mouseleave', 'municipalities-fill', () => {
                map.current.getCanvas().style.cursor = '';
            });

            // Dodaj click handler za občine
            map.current.on('click', 'municipalities-fill', (e) => {
                if (e.features && e.features[0]) {
                    handleMunicipalityClick(e.features[0]);
                }
            });
            
            setMunicipalitiesLoaded(true);
            console.log('Municipalities layer loaded successfully');
            
        } catch (error) {
            console.error('Error loading municipalities:', error);
        }
    }, [municipalitiesLoaded, handleMunicipalityClick]);

    // Effect za posodabljanje vizualnega indikatorja izbrane občine
    useEffect(() => {
        if (map.current && map.current.getLayer('municipalities-outline')) {
            // Posodobi paint properties za outline layer
            map.current.setPaintProperty('municipalities-outline', 'line-color', [
                'case',
                ['==', ['get', 'SIFKO'], selectedMunicipality?.sifko || -1],
                '#3B82F6', // Modra za izbrano občino
                '#64748b'  // Siva za ostale
            ]);
            
            map.current.setPaintProperty('municipalities-outline', 'line-width', [
                'case',
                ['==', ['get', 'SIFKO'], selectedMunicipality?.sifko || -1],
                3, // Debelejša črta za izbrano občino
                [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    6, 0.5,
                    8, 0.8,
                    10, 1,
                    12, 1.2,
                    14, 1.5
                ]
            ]);

            // KLJUČNO: Odstrani izbrano občino iz klikabilnega layer-ja
            if (selectedMunicipality) {
                // Filtriraj municipalities-fill da ne vključuje izbrane občine
                map.current.setFilter('municipalities-fill', [
                    '!=', ['get', 'SIFKO'], selectedMunicipality.sifko
                ]);
                console.log(`Disabled clicks for municipality SIFKO: ${selectedMunicipality.sifko}`);
            } else {
                // Če ni izbrane občine, omogoči vse klika
                map.current.setFilter('municipalities-fill', null);
                console.log('Enabled clicks for all municipalities');
            }
        }
    }, [selectedMunicipality]);

    // Format price expression function
    function formatPriceExpression(dataSourceType) {
        if (dataSourceType === 'prodaja') {
            return [
                'case',
                ['has', 'zadnja_cena'],
                [
                    'concat',
                    '€',
                    [
                        'number-format',
                        ['/', ['get', 'zadnja_cena'], 1000],
                        { 'max-fraction-digits': 0 }
                    ],
                    'k'
                ],
                'N/A'
            ];
        } else {
            return [
                'case',
                ['has', 'zadnja_najemnina'],
                [
                    'concat',
                    '€',
                    [
                        'number-format',
                        ['get', 'zadnja_najemnina'],
                        { 'max-fraction-digits': 0 }
                    ],
                    '/m'
                ],
                'N/A'
            ];
        }
    }

    // NOVA FUNKCIJA: Pridobitev podatkov za specifično občino
    const fetchPropertiesForMunicipality = useCallback(async (sifko) => {
        if (!map.current || isLoading || !sifko) return;

        setIsLoading(true);

        try {
            // Pridobivanje current data sourca
            const currentDataSourceType = dataSourceTypeRef.current;
            const dataSource = currentDataSourceType === 'prodaja' ? 'kpp' : 'np';

            console.log(`Nalagam VSE podatke za KO: ${sifko}, tip: ${currentDataSourceType}, data_source=${dataSource}`);

            // Pošlji samo sifko (brez bbox-a) - backend bo vrnil VSE nepremičnine v občini
            const url = `http://localhost:8000/properties/geojson?bbox=0,0,0,0&zoom=15&data_source=${dataSource}&sifko=${sifko}`;
            console.log(`API URL: ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();

            // Debug: Preveri kaj vrne API
            console.log(`API response:`, geojson);
            console.log(`Total features returned: ${geojson.features.length}`);

            // odstrani stare property layers
            if (map.current.getSource('properties')) {
                if (map.current.getLayer('properties-text-layer')) {
                    map.current.removeLayer('properties-text-layer');
                }
                if (map.current.getLayer('properties-layer')) {
                    map.current.removeLayer('properties-layer');
                }
                map.current.removeSource('properties');
            }
            if (map.current.getSource('clusters')) {
                if (map.current.getLayer('clusters-layer')) {
                    map.current.removeLayer('clusters-layer');
                }
                if (map.current.getLayer('cluster-count-layer')) {
                    map.current.removeLayer('cluster-count-layer');
                }
                map.current.removeSource('clusters');
            }

            const individualFeatures = geojson.features.filter(f => f.properties.type === 'individual');
            const clusterFeatures = geojson.features.filter(f => f.properties.type === 'cluster');

            // Debug logging
            console.log('Individual features:', individualFeatures.length);
            console.log('Cluster features:', clusterFeatures.length);

            if (individualFeatures.length > 0) {
                map.current.addSource('properties', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: individualFeatures
                    }
                });

                // razlicne barve glede na data source
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

                // TEXT LAYER za cene na individualnih nepremičninah
                map.current.addLayer({
                    id: 'properties-text-layer',
                    type: 'symbol',
                    source: 'properties',
                    layout: {
                        'text-field': formatPriceExpression(currentDataSourceType),
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                        'text-size': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            8, 6,
                            12, 8,
                            16, 10
                        ],
                        'text-allow-overlap': false,
                        'text-ignore-placement': false,
                        'text-anchor': 'center',
                        'text-justify': 'center'
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': strokeColor,
                        'text-halo-width': 1
                    }
                });
            }

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
                    ? ['#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF'] // modro
                    : ['#34D399', '#10B981', '#059669', '#047857']; // zeleno

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

            console.log(`Naložil ${geojson.features.length} nepremičnin za občino`);
            setPropertiesLoaded(true);

        } catch (error) {
            console.error('Error pri nalaganju nepremičnin za občino:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, handlePropertySelect]);

    // Handler za spremembo data sourca (najem, nakup)
    const handleDataSourceChange = useCallback((newType) => {
        console.log(`Menjam data source type na: ${newType}`);
        
        // CLEAN: Uporabi PopupManager za cleanup
        if (popupManager.current) {
            popupManager.current.updateDataSourceType(newType);
        }
        
        // Takoj posodobi ref pred klicem API-ja
        dataSourceTypeRef.current = newType;
        setDataSourceType(newType);
        
        // Če je izbrana občina, ponovno naloži podatke za to občino
        if (selectedMunicipality && selectedMunicipality.sifko) {
            console.log(`Reload podatke za KO: ${selectedMunicipality.sifko}, novi tip: ${newType}`);
            
            // Uporabi fetchPropertiesForMunicipality ker bo uporabila novi dataSourceTypeRef
            fetchPropertiesForMunicipality(selectedMunicipality.sifko);
        }
    }, [selectedMunicipality, fetchPropertiesForMunicipality]);

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

                // Naložimo samo občine na začetku
                loadMunicipalities();
            });

            // Dodaj zoom event handler za razgrupiranje clustrov
            let timeoutId;
            const handleZoomEnd = () => {
                if (selectedMunicipality && selectedMunicipality.sifko) {
                    // CLEAN: Uporabi PopupManager za cleanup
                    if (popupManager.current) {
                        popupManager.current.handleZoomChange();
                    }
                    
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        fetchPropertiesForMunicipality(selectedMunicipality.sifko);
                    }, 300);
                }
            };

            map.current.on('zoomend', handleZoomEnd);
            map.current._zoomEndHandler = handleZoomEnd;
        }

        return () => {
            if (map.current) {
                // Cleanup zoom event handler
                if (map.current._zoomEndHandler) {
                    map.current.off('zoomend', map.current._zoomEndHandler);
                }

                // Cleanup municipalities event listeners
                if (municipalitiesLoaded) {
                    map.current.off('mouseenter', 'municipalities-fill');
                    map.current.off('mouseleave', 'municipalities-fill');
                    map.current.off('click', 'municipalities-fill');
                }

                // Cleanup preko PopupManager
                if (popupManager.current) {
                    popupManager.current.cleanup();
                }

                // Cleanup municipalities layers
                if (map.current.getLayer('municipalities-labels')) {
                    map.current.removeLayer('municipalities-labels');
                }
                if (map.current.getLayer('municipalities-outline')) {
                    map.current.removeLayer('municipalities-outline');
                }
                if (map.current.getLayer('municipalities-fill')) {
                    map.current.removeLayer('municipalities-fill');
                }
                if (map.current.getSource('municipalities')) {
                    map.current.removeSource('municipalities');
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

            {/* Indicator za izbrano občino */}
            {selectedMunicipality && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">
                            Občina: {selectedMunicipality.name}
                        </span>
                        <button
                            onClick={() => {
                                // CLEAN: Uporabi PopupManager za cleanup
                                if (popupManager.current) {
                                    popupManager.current.handleMunicipalityReset();
                                }
                                
                                setSelectedMunicipality(null);
                                // Počisti podatke o nepremičninah
                                if (map.current.getSource('properties')) {
                                    if (map.current.getLayer('properties-text-layer')) {
                                        map.current.removeLayer('properties-text-layer');
                                    }
                                    if (map.current.getLayer('properties-layer')) {
                                        map.current.removeLayer('properties-layer');
                                    }
                                    map.current.removeSource('properties');
                                }
                                if (map.current.getSource('clusters')) {
                                    if (map.current.getLayer('clusters-layer')) {
                                        map.current.removeLayer('clusters-layer');
                                    }
                                    if (map.current.getLayer('cluster-count-layer')) {
                                        map.current.removeLayer('cluster-count-layer');
                                    }
                                    map.current.removeSource('clusters');
                                }
                                // Zoomira nazaj na začetno pozicijo
                                map.current.flyTo({
                                    center: [14.9, 46.14],
                                    zoom: 7.8,
                                    duration: 1500
                                });
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <Filter />
            <Switcher activeType={dataSourceType} onChangeType={handleDataSourceChange} />
            <Iskalnik onSearch={handleSearch} />

            {showPropertyDetails && selectedProperty && (
                <Podrobnosti
                    propertyId={selectedProperty.id}
                    dataSource={selectedProperty.dataSource || (dataSourceType === 'prodaja' ? 'kpp' : 'np')}
                    onClose={() => {
                        setShowPropertyDetails(false);
                        setSelectedProperty(null);
                    }}
                />
            )}
        </>
    );
}