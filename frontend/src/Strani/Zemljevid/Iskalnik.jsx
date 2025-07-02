import { useState, useEffect, useRef } from "react";
import debounce from "lodash/debounce";

// Konstante
const MOBILE_BREAKPOINT = 768;
const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_DELAY = 300;
const MAX_SUGGESTIONS = 5;
const MAPTILER_KEY = "VxVsHKinUjiHiI3FPcfq";

// Pomožne funkcije
const isMobileDevice = () => window.innerWidth <= MOBILE_BREAKPOINT;

const createSearchUrl = (query) =>
  `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=${MAX_SUGGESTIONS}&country=si`;

const formatSuggestion = (feature) => ({
  id: feature.id,
  name: feature.text,
  address: feature.place_name,
  coordinates: feature.center,
  type: feature.place_type[0]
});

// Hooks
const useResponsiveDetection = () => {
  const [isOnMobile, setIsOnMobile] = useState(isMobileDevice());

  useEffect(() => {
    const handleResize = () => setIsOnMobile(isMobileDevice());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isOnMobile;
};

const useClickOutside = (ref, onClickOutside) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, onClickOutside]);
};

const useDebouncedSearch = (onSearch) => {
  return useRef(
    debounce(async (query) => {
      if (query.length < MIN_SEARCH_LENGTH) {
        onSearch([]);
        return;
      }

      try {
        const response = await fetch(createSearchUrl(query));

        if (!response.ok) {
          throw new Error(`HTTP napaka ${response.status}`);
        }

        const data = await response.json();
        const results = data.features.map(formatSuggestion);
        onSearch(results);
      } catch (error) {
        onSearch([]);
      }
    }, DEBOUNCE_DELAY)
  ).current;
};

// Komponente
const LoadingIndicator = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SearchButton = ({ loading, disabled }) => (
  <button
    type="submit"
    disabled={disabled}
    className="px-4 py-3 bg-gray-900 text-white rounded-r-lg hover:bg-gray-700 disabled:bg-blue-400 transition-colors duration-200"
  >
    {loading ? <LoadingIndicator /> : <SearchIcon />}
  </button>
);

const SearchInput = ({ value, onChange, onKeyDown, onFocus, autoFocus = false, className = "" }) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    onFocus={onFocus}
    placeholder="Iskanje lokacije..."
    className={`px-4 py-3 border-none focus:outline-none focus:ring-2 focus:ring-gray-900 ${className}`}
    autoFocus={autoFocus}
  />
);

const SuggestionItem = ({ suggestion, isFirst, onClick, isMobile = false }) => (
  <li
    onClick={onClick}
    className={`px-4 py-${isMobile ? '3' : '2'} hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 ${isFirst ? 'bg-blue-50 border-l-4 border-l-gray-900' : ''
      }`}
  >
    <div className="font-medium">
      {suggestion.name}
      {isFirst && (
        <span className="ml-2 text-xs text-blue-600 font-normal">
          ({isMobile ? 'Tap' : 'Enter'} za izbiro)
        </span>
      )}
    </div>
    {suggestion.address && (
      <div className="text-sm text-gray-600">{suggestion.address}</div>
    )}
  </li>
);

const SuggestionsDropdown = ({
  show,
  loading,
  suggestions,
  searchQuery,
  onSuggestionClick,
  isMobile = false,
  className = ""
}) => {
  if (!show || searchQuery.length < MIN_SEARCH_LENGTH) {
    return searchQuery.length > 0 && searchQuery.length < MIN_SEARCH_LENGTH ? (
      <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
        <div className="p-3 text-center text-gray-500">
          Vnesite vsaj {MIN_SEARCH_LENGTH} znake za iskanje
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${isMobile ? 'max-h-64 overflow-y-auto' : 'shadow-lg z-20'} ${className}`}>
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
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              isFirst={index === 0}
              onClick={() => onSuggestionClick(suggestion)}
              isMobile={isMobile}
            />
          ))}
        </ul>
      ) : (
        <div className="p-3 text-center text-gray-500">Ni najdenih rezultatov</div>
      )}
    </div>
  );
};

const DesktopSearchIcon = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white rounded-lg shadow-lg border border-gray-200 p-3.5 w-12 h-12 hover:bg-gray-50 transition-colors duration-200 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
    aria-label="Odpri iskanje lokacije"
  >
    <svg
      className="w-5 h-5 text-gray-700"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </button>
);

const DesktopSearchForm = ({
  searchQuery,
  setSearchQuery,
  handleSearch,
  handleKeyDown,
  setShowSuggestions,
  loading
}) => (
  <form onSubmit={handleSearch} className="flex bg-white rounded-lg shadow-lg border border-gray-200">
    <SearchInput
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setShowSuggestions(true)}
      className="rounded-l-lg w-64"
      autoFocus
    />
    <SearchButton loading={loading} disabled={loading} />
  </form>
);

const MobileSearchTrigger = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-4 right-4 bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center z-10"
    style={{ width: '60px', height: '60px', borderRadius: '50%' }}
    title="Odpri iskanje"
  >
    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </button>
);

const MobileSearchHeader = ({ onClose }) => (
  <div className="flex items-center justify-between p-3 border-b border-gray-200">
    <h3 className="text-lg font-medium text-gray-800">Iskanje lokacije</h3>
    <button
      onClick={onClose}
      className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
    >
      <CloseIcon />
    </button>
  </div>
);

const MobileSearchForm = ({
  searchQuery,
  setSearchQuery,
  handleSearch,
  handleKeyDown,
  setShowSuggestions,
  loading
}) => (
  <form onSubmit={handleSearch} className="flex">
    <SearchInput
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setShowSuggestions(true)}
      className="flex-1 rounded-l-lg border border-gray-300 focus:border-gray-900"
      autoFocus
    />
    <SearchButton loading={loading} disabled={loading} />
  </form>
);

// Hlavna komponenta
export default function Iskalnik({ onSearch }) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchContainerRef = useRef(null);
  const isOnMobile = useResponsiveDetection();

  // Debounced funkcija za iskanje predlogov
  const handleSuggestionsUpdate = (newSuggestions) => {
    setSuggestions(newSuggestions);
    setLoading(false);
  };

  const fetchSuggestions = useDebouncedSearch(handleSuggestionsUpdate);

  // Zapri iskanje ob kliku zunaj
  const handleClickOutside = () => {
    setShowSuggestions(false);
    setSearchVisible(false);
  };

  useClickOutside(searchContainerRef, handleClickOutside);

  // Spremljaj spremembe v iskalnem nizu
  useEffect(() => {
    if (searchQuery.trim()) {
      setLoading(true);
      fetchSuggestions(searchQuery.trim());
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }
  }, [searchQuery, fetchSuggestions]);

  // Rokovanje z izbiro predloga
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.name);
    closeSearch();

    if (onSearch) {
      onSearch({
        query: suggestion.name,
        coordinates: suggestion.coordinates,
        type: suggestion.type,
        properties: suggestion
      });
    }
  };

  // Zapri iskanje
  const closeSearch = () => {
    setShowSuggestions(false);
    setSearchVisible(false);
  };

  // Rokovanje z Enter - izbere prvi rezultat
  const handleSearch = (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    if (suggestions.length > 0 && !loading) {
      handleSuggestionClick(suggestions[0]);
    } else if (!loading) {
      closeSearch();
      if (onSearch) {
        onSearch({ query: searchQuery });
      }
    }
  };

  // Rokovanje s tipkovnico
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchQuery("");
      closeSearch();
    }
  };

  // Mouse events za desktop
  const handleMouseLeave = () => {
    if (!isOnMobile && !showSuggestions) {
      setSearchVisible(false);
    }
  };

  const handleMouseEnter = () => {
    if (!isOnMobile && !searchVisible) {
      setSearchVisible(true);
    }
  };

  // Mobile close funkcija
  const handleMobileClose = () => {
    setSearchVisible(false);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  const handleMobileSuggestionClick = (suggestion) => {
    handleSuggestionClick(suggestion);
    setSearchVisible(false);
    setShowSuggestions(false);
  };

  return (
    <>
      {/* Desktop verzija */}
      {!isOnMobile && (
        <div
          className="absolute top-50 right-2 z-10"
          ref={searchContainerRef}
        >
          {!searchVisible ? (
            <DesktopSearchIcon onClick={() => setSearchVisible(true)} />
          ) : (
            <div
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <DesktopSearchForm
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                handleKeyDown={handleKeyDown}
                setShowSuggestions={setShowSuggestions}
                loading={loading}
              />

              <SuggestionsDropdown
                show={showSuggestions}
                loading={loading}
                suggestions={suggestions}
                searchQuery={searchQuery}
                onSuggestionClick={handleSuggestionClick}
                className="absolute mt-1 w-full"
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile verzija */}
      {isOnMobile && (
        <>
          {!searchVisible && (
            <MobileSearchTrigger onClick={() => setSearchVisible(true)} />
          )}

          {searchVisible && (
            <div className="absolute top-25 left-4 right-4 z-20">
              <div className="bg-white rounded-xl shadow-lg border border-gray-200">
                <MobileSearchHeader onClose={handleMobileClose} />

                <div className="p-4">
                  <MobileSearchForm
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    handleSearch={handleSearch}
                    handleKeyDown={handleKeyDown}
                    setShowSuggestions={setShowSuggestions}
                    loading={loading}
                  />

                  <SuggestionsDropdown
                    show={showSuggestions}
                    loading={loading}
                    suggestions={suggestions}
                    searchQuery={searchQuery}
                    onSuggestionClick={handleMobileSuggestionClick}
                    isMobile={true}
                    className="mt-3"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}