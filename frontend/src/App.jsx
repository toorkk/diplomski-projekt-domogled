import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

function App() {
  const mapContainer = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [15.0, 46.15],
      zoom: 7,
    });

    return () => map.remove();
  }, []);

  return (
    <div className="bg-gray-500 w-auto h-dvh">
      <h1 className="text-3xl font-bold underline">
        Hello world!
      </h1>
      <div ref={mapContainer} className="h-max" />
    </div>
  );
}

export default App;
