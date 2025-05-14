import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Filter from "../Filter";

export default function Zemljevid() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!map.current && mapContainer.current) {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: "https://api.maptiler.com/maps/streets-v2/style.json?key=0o1JJH0AwIhwX3Od4vsn",
                center: [14.9, 46.14],
                zoom: 7.8
            });

            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

            map.current.on('load', () => {
                const controlContainer = mapContainer.current.querySelector('.maplibregl-control-container');

                if (controlContainer) {
                    const topRightControls = controlContainer.querySelector('.maplibregl-ctrl-top-right');
                    if (topRightControls) {
                        topRightControls.style.top = '200px';
                    }

                    const buttons = controlContainer.querySelectorAll('.maplibregl-ctrl-group button');
                    buttons.forEach(button => {
                        button.style.width = '48px';
                        button.style.height = '48px';
                        button.style.fontSize = '18px';
                    });

                    const ctrlGroups = controlContainer.querySelectorAll('.maplibregl-ctrl-group');
                    ctrlGroups.forEach(group => {
                        group.style.borderRadius = '8px';
                        group.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    });
                }
            });
        }

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {

            // Tu bo logika za iskalnik pol dodama
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

            {/* Iskalnik */}
            <div className="absolute top-35 right-2 z-10">
                {!searchVisible ? (
                    /* Search Ikonica */
                    <button
                        onClick={() => setSearchVisible(true)}
                        className="bg-white rounded-lg shadow-lg border border-gray-200 p-3.5 w-12 h-12 hover:bg-gray-50 transition-colors duration-200"
                        title="Search"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                ) : (
                    /* Search Bar */
                    <form onSubmit={handleSearch} className="flex bg-white rounded-lg shadow-lg border border-gray-200">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Iskanje lokacije..."
                            className="px-4 py-3 rounded-l-lg border-none focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="px-4 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors duration-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchVisible(false);
                                setSearchQuery("");
                            }}
                            className="px-3 py-3 text-gray-400 hover:text-gray-600 rounded-r-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>

            <Filter />
        </>
    );
}