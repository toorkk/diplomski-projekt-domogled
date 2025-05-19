import { useState, useEffect, useRef } from "react";
import debounce from "lodash/debounce";

export default function Iskalnik({ onSearch }) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);

  // Debounced funkcija za iskanje, da ne pošiljamo preveč zahtev
  const fetchSuggestions = useRef(
    debounce(async (query) => {
      if (query.length < 3) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Uporaba MapTiler Geocoding API - potreben je API ključ
        const MAPTILER_KEY = "VxVsHKinUjiHiI3FPcfq"; // Uporabite isti ključ kot za mapo
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=5&country=si`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        const results = data.features.map(feature => ({
          id: feature.id,
          name: feature.text,
          address: feature.place_name,
          coordinates: feature.center, // [lng, lat]
          type: feature.place_type[0]
        }));
        
        setSuggestions(results);
      } catch (error) {
        console.error("Napaka pri pridobivanju predlogov:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300)
  ).current;

  // To funkcijo ne potrebujemo več, ker Nominatim vrača že oblikovan naslov
  // Pustimo jo zaradi kompatibilnosti, če bi jo potrebovali kasneje
  const formatAddress = (properties) => {
    return properties.display_name || "";
  };

  // Spremljamo spremembe v iskalnem nizu
  useEffect(() => {
    if (searchQuery.trim()) {
      fetchSuggestions(searchQuery.trim());
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, fetchSuggestions]);

  // Zunanja kliknjena zapre predloge
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Rokovanje z izbiro predloga
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    
    // Premaknemo zemljevid na izbrano lokacijo
    if (onSearch) {
      onSearch({
        query: suggestion.name,
        coordinates: suggestion.coordinates,
        type: suggestion.type,
        properties: suggestion
      });
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearch) {
        onSearch({ query: searchQuery });
      }
      setShowSuggestions(false);
    }
  };

  return (
    <div
      className="absolute top-50 right-2 z-10"
      ref={searchContainerRef}
      onMouseEnter={() => setSearchVisible(true)}
      onMouseLeave={() => {
        if (!showSuggestions) {
          setSearchVisible(false);
        }
      }}
    >
      {!searchVisible ? (
        /* Search ikona */
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3.5 w-12 h-12 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center cursor-pointer">
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      ) : (
        /* Search Bar in predlogi */
        <div className="relative">
          <form onSubmit={handleSearch} className="flex bg-white rounded-lg shadow-lg border border-gray-200">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Iskanje lokacije..."
              className="px-4 py-3 rounded-l-lg border-none focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              onFocus={() => setShowSuggestions(true)}
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

          {/* Seznam predlogov */}
          {showSuggestions && (searchQuery.length >= 3 || suggestions.length > 0) && (
            <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              {loading ? (
                <div className="p-3 text-center text-gray-500">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Iskanje...</span>
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                <ul>
                  {suggestions.map((suggestion) => (
                    <li
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{suggestion.name}</div>
                      {suggestion.address && (
                        <div className="text-sm text-gray-600">{suggestion.address}</div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : searchQuery.length >= 3 ? (
                <div className="p-3 text-center text-gray-500">Ni najdenih rezultatov</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}