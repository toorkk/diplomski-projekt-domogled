import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Filter from "../Filter";
import Switcher from "./Switcher";
import Iskalnik from "./Iskalnik";
import '../Stili/Zemljevid.css';
import Podrobnosti from "./Podrobnosti";





export default function Zemljevid() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [propertiesLoaded, setPropertiesLoaded] = useState(false);
    const [lastBounds, setLastBounds] = useState(null);
    const [lastZoom, setLastZoom] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showPropertyDetails, setShowPropertyDetails] = useState(false);


    // preverja če se je mapa dovolj premaknila za ponovno nalaganje podatkov
    const hasBoundsChanged = useCallback((newBounds, oldBounds) => {
        if (!oldBounds) return true;

        // preveri zoom change
        if (Math.abs(newZoom - oldZoom) > 0.5) return true;

        const threshold = 0.001;
        return (
            Math.abs(newBounds.getWest() - oldBounds.getWest()) > threshold ||
            Math.abs(newBounds.getEast() - oldBounds.getEast()) > threshold ||
            Math.abs(newBounds.getNorth() - oldBounds.getNorth()) > threshold ||
            Math.abs(newBounds.getSouth() - oldBounds.getSouth()) > threshold
        );
    }, []);


    // pridobitev podatkov iz backenda, prikaže samo trenutno vidne
    const fetchPropertiesForViewport = useCallback(async () => {
        if (!map.current || isLoading) return;

        const currentBounds = map.current.getBounds();
        const currentZoom = map.current.getZoom();

        if (!hasBoundsChanged(currentBounds, lastBounds, currentZoom, lastZoom)) {
            console.log('meje in zoom enaki, ne gettam');
            return;
        }

        setIsLoading(true);

        try {
            const bbox = `${currentBounds.getWest()},${currentBounds.getSouth()},${currentBounds.getEast()},${currentBounds.getNorth()}`;

            const currentZoom = map.current.getZoom();
            const response = await fetch(`http://localhost:8000/properties/geojson?bbox=${bbox}&zoom=${currentZoom}`);

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
                        'circle-color': '#3B82F6',
                        'circle-opacity': 0.7,
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#1D4ED8'
                    }
                });
            }

            // Add deli stavb clusters
            if (clusterFeatures.length > 0) {
                map.current.addSource('clusters', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: clusterFeatures
                    }
                });

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
                            1, '#51bbd6',
                            100, '#f1c40f',
                            1000, '#e67e22',
                            10000, '#e74c3c'
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

            // Remove old click handlers
            if (map.current._propertiesClickHandler) {
                map.current.off('click', 'properties-layer', map.current._propertiesClickHandler);
                map.current.off('click', 'clusters-layer', map.current._propertiesClickHandler);
            }

            // Add click handlers
            map.current._propertiesClickHandler = (e) => {
                const features = e.features[0];
                const properties = features.properties;

                let popupContent = '';

                if (properties.type === 'individual') {
                    // Sestavi naslov z ulico in hišno številko, če obstajata
                    const naslov = `${properties.ulica || ''} ${properties.hisna_stevilka || ''}`.trim();

                    popupContent = `
    <div class="font-sans bg-white rounded-lg overflow-hidden">
        <!-- Modro zglavje -->
        <div class="bg-[rgb(59,130,246)] text-white p-4">
            ${naslov ? `<h3 class="font-bold text-lg mb-1">${naslov}</h3>` :
                            properties.naselje ? `<p class="text-white">${properties.naselje}</p>` : ''}
        </div>
        
        <!-- Vsebina -->
        <div class="p-4">
            <div class="grid grid-cols-2 gap-y-2 text-sm">
                
                ${properties.obcina ? `
                <div class="text-gray-600">Občina:</div>
                <div class="font-medium">${properties.obcina}</div>
                ` : ''}
                
                ${properties.naselje ? `
                <div class="text-gray-600">Naselje:</div>
                <div class="font-medium">${properties.naselje}</div>
                ` : ''}
                
                ${(properties.ulica && !naslov) ? `
                <div class="text-gray-600">Ulica:</div>
                <div class="font-medium">${properties.ulica}</div>
                ` : ''}
                
                ${(properties.hisna_stevilka && !naslov) ? `
                <div class="text-gray-600">Hišna številka:</div>
                <div class="font-medium">${properties.hisna_stevilka}</div>
                ` : ''}

                ${properties.povrsina ? `
                <div class="text-gray-600">Površina:</div>
                <div class="font-medium">${properties.povrsina} m²</div>
                ` : ''}
                
                ${properties.dejanska_raba ? `
                <div class="text-gray-600">Raba:</div>
                <div class="font-medium">${properties.dejanska_raba}</div>
                ` : ''}
                
                ${properties.leto ? `
                <div class="text-gray-600">Leto:</div>
                <div class="font-medium">${properties.leto}</div>
                ` : ''}
            </div>
            
            <!-- Moder gumb za podrobnosti -->
            <div class="mt-4 text-center">
                <button 
                    class="bg-[rgb(59,130,246)] hover:bg-[rgb(29,100,216)] text-white py-2 px-4 rounded text-sm transition-colors duration-200 w-full"
                    id="btnShowDetails_${properties.id}"
                >
                    Podrobnosti
                </button>
            </div>
        </div>
    </div>
`;

                } else if (properties.type === 'cluster') {
                    console.log(properties.obcine.length + " - " + JSON.stringify(properties))
                    const obcineText = properties.obcine && properties.obcine.length > 1000000
                        ? properties.obcine.slice(0, 3).join(', ') + (properties.obcine.length > 3 ? '...' : '')
                        : 'N/A';

                    popupContent = `
            <div class="p-4 font-sans bg-white rounded-lg">
                <div class="mb-3 pb-2 border-b border-gray-200">
                    <h3 class="font-bold text-lg" style="color: rgb(59, 130, 246);">Cluster informacije</h3>
                </div>
                
                <div class="grid grid-cols-2 gap-y-2 text-sm">
                    <div class="text-gray-600">Število objektov:</div>
                    <div class="font-medium">${properties.point_count}</div>
                    
                    ${properties.avg_povrsina ? `
                    <div class="text-gray-600">Povprečna površina:</div>
                    <div class="font-medium">${Math.round(properties.avg_povrsina)} m²</div>
                    ` : ''}
                    
                    <div class="text-gray-600">Občine:</div>
                    <div class="font-medium">${obcineText}</div>
                </div>
                
                <div class="mt-4 pt-2 border-t border-gray-200 text-center">
                    <p class="text-sm flex items-center justify-center cursor-pointer" style="color: rgb(59, 130, 246);">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        Približaj za več detajlov
                    </p>
                </div>
            </div>
        `;
                }

                const popup = new maplibregl.Popup({
                    closeButton: true,
                    closeOnClick: true,
                    maxWidth: '320px',
                    className: 'custom-popup'
                })
                    .setLngLat(e.lngLat)
                    .setHTML(popupContent)
                    .addTo(map.current);

                if (properties.type === 'individual') {
                    // Počakamo, da se DOM naloži
                    setTimeout(() => {
                        const detailsButton = document.getElementById(`btnShowDetails_${properties.id}`);
                        if (detailsButton) {
                            detailsButton.addEventListener('click', () => {
                                // Shranimo podatke o nepremičnini
                                const propertyData = { ...properties };
                                setSelectedProperty(propertyData);
                                setShowPropertyDetails(true);

                                // Zapremo popup
                                popup.remove();
                            });
                        }
                    }, 100);
                }
            };

            // Add click handlers for both layers
            if (individualFeatures.length > 0) {
                map.current.on('click', 'properties-layer', map.current._propertiesClickHandler);
            }
            if (clusterFeatures.length > 0) {
                map.current.on('click', 'clusters-layer', map.current._propertiesClickHandler);
            }

            // miška hover
            if (!map.current._propertiesHoverHandler) {
                map.current._propertiesHoverHandler = () => {
                    map.current.getCanvas().style.cursor = 'pointer';
                };

                map.current._propertiesLeaveHandler = () => {
                    map.current.getCanvas().style.cursor = '';
                };

                map.current.on('mouseenter', 'properties-layer', map.current._propertiesHoverHandler);
                map.current.on('mouseleave', 'properties-layer', map.current._propertiesLeaveHandler);
            }

            setLastBounds(currentBounds);
            setLastZoom(currentZoom);


            console.log(`Naložil ${geojson.features.length} del stavb`);
            setPropertiesLoaded(true);

        } catch (error) {
            console.error('Error pri nalaganju del stavb:', error);
        } finally {
            setIsLoading(false);
        }

    }, [isLoading, lastBounds, hasBoundsChanged]);

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

                fetchPropertiesForViewport();

            });

            // timeout po premiku za dele stavb get
            let timeoutId;
            const handleMoveEnd = () => {
                console.log('Map move');
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
                if (map.current._propertiesClickHandler) {
                    map.current.off('click', 'properties-layer', map.current._propertiesClickHandler);
                }
                if (map.current._propertiesHoverHandler) {
                    map.current.off('mouseenter', 'properties-layer', map.current._propertiesHoverHandler);
                    map.current.off('mouseleave', 'properties-layer', map.current._propertiesLeaveHandler);
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
            <Switcher />
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