import { useState, useEffect, useRef } from "react";
import debounce from "lodash/debounce";

export default function Iskalnik({ onSearch }) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);

  const isMobile = () => window.innerWidth <= 768;
  const [isOnMobile, setIsOnMobile] = useState(isMobile());

  useEffect(() => {
    const handleResize = () => {
      setIsOnMobile(isMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        setSearchVisible(false); // Zapre tudi search bar
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
    setSearchVisible(false); // DODANO: Zapre search bar po izbiri predloga

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

  // POPRAVLJENA funkcija za Enter - izbere prvi rezultat če obstaja
  const handleSearch = (e) => {
    e.preventDefault();

    if (searchQuery.trim()) {
      // Če imamo predloge in prvi predlog obstaja, uporabi prvi predlog
      if (suggestions.length > 0 && !loading) {
        const firstSuggestion = suggestions[0];
        console.log('Izbran prvi predlog:', firstSuggestion);

        // Posodobi search query z imenom prvega predloga
        setSearchQuery(firstSuggestion.name);
        setShowSuggestions(false);
        setSearchVisible(false); // DODANO: Zapre search bar po Enter iskanju

        // Izvedi iskanje z koordinatami prvega predloga
        if (onSearch) {
          onSearch({
            query: firstSuggestion.name,
            coordinates: firstSuggestion.coordinates,
            type: firstSuggestion.type,
            properties: firstSuggestion
          });
        }
      } else if (!loading) {
        // Če ni predlogov, uporabi osnovni search (brez koordinat)
        console.log('Ni predlogov, izvajam osnovni search:', searchQuery);

        setShowSuggestions(false);
        setSearchVisible(false); // DODANO: Zapre search bar po osnovnem iskanju

        if (onSearch) {
          onSearch({ query: searchQuery });
        }
      }
      // Če je loading=true, ne naredimo nič - počakamo da se predlogi naložijo
    }
  };

  // DODANA funkcija za keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSearchQuery("");
      setSearchVisible(false); // Zapre search bar na ESC
    }
  };

  const handleMouseLeave = () => {
    // Na mobilnih napravah ne zapri avtomatsko
    if (!isOnMobile && !showSuggestions) {
      setSearchVisible(false);
    }
  };

  return (
    <>
      {/* Desktop verzija */}
      {!isOnMobile && (
        <div
          className="absolute top-50 right-2 z-10"
          ref={searchContainerRef}
          onMouseEnter={() => setSearchVisible(!searchVisible)}
          onMouseLeave={handleMouseLeave}
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
                  onKeyDown={handleKeyDown}
                  placeholder="Iskanje lokacije..."
                  className="px-4 py-3 rounded-l-lg border-none focus:outline-none focus:ring-2 focus:ring-gray-900 w-64"
                  onFocus={() => setShowSuggestions(true)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-3 bg-gray-900 text-white rounded-r-lg hover:bg-gray-700 disabled:bg-blue-400 transition-colors duration-200"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </form>

              {/* Seznam predlogov */}
              {showSuggestions && (searchQuery.length >= 3 || suggestions.length > 0) && (
                <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {loading ? (
                    <div className="p-3 text-center text-gray-500">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        <span>Iskanje...</span>
                      </div>
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ul>
                      {suggestions.map((suggestion, index) => (
                        <li
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className={`px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${index === 0 ? 'bg-blue-50 border-l-4 border-l-gray-900' : ''
                            }`}
                        >
                          <div className="font-medium">
                            {suggestion.name}
                            {index === 0 && (
                              <span className="ml-2 text-xs text-blue-600 font-normal">(Enter za izbiro)</span>
                            )}
                          </div>
                          {suggestion.address && (
                            <div className="text-sm text-gray-600">{suggestion.address}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : searchQuery.length >= 3 ? (
                    <div className="p-3 text-center text-gray-500">Ni najdenih rezultatov</div>
                  ) : (
                    <div className="p-3 text-center text-gray-500">
                      Vnesite vsaj 3 znake za iskanje
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile verzija */}
      {isOnMobile && (
        <>
          {/* Okrogel gumb spodaj desno */}
          {!searchVisible && (
            <button
              onClick={() => setSearchVisible(true)}
              className="fixed bottom-4 right-4 bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center z-10"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%'
              }}
              title="Odpri iskanje"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
          
          {/* Search container v zgornjem delu pod menjalnikom */}
          {searchVisible && (
            <div className="absolute top-25 left-4 right-4 z-20">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                {/* Header z zapri gumbom */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-800">Iskanje lokacije</h3>
                  <button
                    onClick={() => {
                      setSearchVisible(false);
                      setShowSuggestions(false);
                      setSearchQuery('');
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Search form */}
                <div className="p-4">
                  <form onSubmit={handleSearch} className="flex">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Iskanje lokacije..."
                      className="flex-1 px-4 py-3 rounded-l-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                      onFocus={() => setShowSuggestions(true)}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-3 bg-gray-900 text-white rounded-r-lg hover:bg-gray-700 disabled:bg-blue-400 transition-colors duration-200"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                    </button>
                  </form>

                  {/* Seznam predlogov */}
                  {showSuggestions && (searchQuery.length >= 3 || suggestions.length > 0) && (
                    <div className="mt-3 bg-white border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                      {loading ? (
                        <div className="p-3 text-center text-gray-500">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                            <span>Iskanje...</span>
                          </div>
                        </div>
                      ) : suggestions.length > 0 ? (
                        <ul>
                          {suggestions.map((suggestion, index) => (
                            <li
                              key={suggestion.id}
                              onClick={() => {
                                handleSuggestionClick(suggestion);
                                setSearchVisible(false);
                                setShowSuggestions(false);
                              }}
                              className={`px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${index === 0 ? 'bg-blue-50 border-l-4 border-l-gray-900' : ''
                                }`}
                            >
                              <div className="font-medium">
                                {suggestion.name}
                                {index === 0 && (
                                  <span className="ml-2 text-xs text-blue-600 font-normal">(Tap za izbiro)</span>
                                )}
                              </div>
                              {suggestion.address && (
                                <div className="text-sm text-gray-600">{suggestion.address}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : searchQuery.length >= 3 ? (
                        <div className="p-3 text-center text-gray-500">Ni najdenih rezultatov</div>
                      ) : (
                        <div className="p-3 text-center text-gray-500">
                          Vnesite vsaj 3 znake za iskanje
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}