import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return; // Prevent reinitializing on re-renders
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [15.0, 46.15],
      zoom: 7,
      antialias: true, // Enable antialiasing for smoother rendering
      maxZoom: 18,
      maxPitch: 60,
      preserveDrawingBuffer: true, // Improves performance for screenshots
      optimizeForTerrain: true, // Better performance for terrain
      renderWorldCopies: false, // Prevents rendering multiple copies of the world
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-dvh">
      {/* Map as background */}
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Navbar - floating on top middle */}
      <nav className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-md p-4">
        <h1 className="text-xl font-bold">Your Navbar</h1>
      </nav>
      
      {/* Filter - floating on left */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-4 w-64">
        <h2 className="text-lg font-semibold mb-2">Filters</h2>
        <p className="text-gray-600">Add your filters here</p>
      </div>
    </div>
  );
}

export default App;