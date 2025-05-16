import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Filter from "../Filter";
import Switcher from "./Switcher";

export default function Zemljevid() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [propertiesLoaded, setPropertiesLoaded] = useState(false);
    const [lastBounds, setLastBounds] = useState(null);


    // preverja če se je mapa dovolj premaknila za ponovno nalaganje podatkov
    const hasBoundsChanged = useCallback((newBounds, oldBounds) => {
        if (!oldBounds) return true;

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

        if (!hasBoundsChanged(currentBounds, lastBounds)) {
            console.log('meje enake, ne gettam');
            return;
        }

        setIsLoading(true);
        console.log('meje mape:', currentBounds.toString());

        try {
            const bbox = `${currentBounds.getWest()},${currentBounds.getSouth()},${currentBounds.getEast()},${currentBounds.getNorth()}`;

            const response = await fetch(`http://localhost:8000/properties/geojson?bbox=${bbox}`);

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const geojson = await response.json();

            // odstrani stari layer
            if (map.current.getSource('properties')) {
                map.current.removeLayer('properties-layer');
                map.current.removeSource('properties');
            }

            map.current.addSource('properties', {
                type: 'geojson',
                data: geojson
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

            // popup ko klikneš
            if (!map.current._propertiesClickHandler) {
                map.current._propertiesClickHandler = (e) => {
                    const properties = e.features[0].properties;

                    const popup = new maplibregl.Popup()
                        .setLngLat(e.lngLat)
                        .setHTML(`
                            <div class="p-3">
                                <h3 class="font-bold text-lg mb-2">Informacije o objektu</h3>
                                <p><strong>ID:</strong> ${properties.id}</p>
                                ${properties.obcina ? `<p><strong>Občina:</strong> ${properties.obcina}</p>` : ''}
                                ${properties.naselje ? `<p><strong>Naselje:</strong> ${properties.naselje}</p>` : ''}
                                ${properties.ulica ? `<p><strong>Ulica:</strong> ${properties.ulica}</p>` : ''}
                                ${properties.hisna_stevilka ? `<p><strong>Hišna številka:</strong> ${properties.hisna_stevilka}</p>` : ''}
                                ${properties.povrsina ? `<p><strong>Površina:</strong> ${properties.povrsina} m²</p>` : ''}
                                ${properties.dejanska_raba ? `<p><strong>Raba:</strong> ${properties.dejanska_raba}</p>` : ''}
                                ${properties.leto ? `<p><strong>Leto:</strong> ${properties.leto}</p>` : ''}
                            </div>
                        `)
                        .addTo(map.current);
                };

                map.current.on('click', 'properties-layer', map.current._propertiesClickHandler);
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
                console.log('Map moveend event fired');
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    console.log('Debounced function executing');
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

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // Tu bo logika za iskalnik pol dodana
            console.log('Iskanje:', searchQuery);
            setSearchVisible(false);
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

            {/* Iskalnik - hover verzija */}
            <div
                className="absolute top-50 right-2 z-10"
                onMouseEnter={() => setSearchVisible(true)}
                onMouseLeave={() => setSearchVisible(false)}
            >
                {!searchVisible ? (
                    /* Search Ikonica */
                    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3.5 w-12 h-12 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                ) : (
                    /* Search Bar */
                    <form onSubmit={handleSearch} className="flex bg-white rounded-lg shadow-lg border border-gray-200">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Iskanje lokacije..."
                            className="px-4 py-3 rounded-l-lg border-none focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                        <button
                            type="submit"
                            className="px-4 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>

            <Filter />
            <div className="absolute top-10 right-20 z-10">
            <Switcher />
            </div>
        </>
    );
}