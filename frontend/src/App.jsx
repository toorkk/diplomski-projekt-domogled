import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (!map.current && mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://api.maptiler.com/maps/streets-v2/style.json?key=0o1JJH0AwIhwX3Od4vsn",
        center: [14.9, 46.14],
        zoom: 7.8
      });
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className="relative w-screen h-screen">
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

      <nav className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-white rounded-lg shadow-md p-4">
        <h1 className="text-xl font-bold">Navbar</h1>
      </nav>

      <div className="absolute top-50 left-4 z-10 bg-white rounded-lg shadow-md p-4 w-75 h-150">
        <h2 className="text-lg font-semibold mb-2">Filters</h2>
      </div>
    </div>
  );
}
