import { useState, useEffect } from "react";
import { useIsMobile } from './hooks/useIsMobile';

export default function Filters({ onFiltersChange, dataSourceType, isLoading, activeFilters = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const [filters, setFilters] = useState({
    filter_leto: 2025,
    min_cena: null,
    max_cena: null,
    min_povrsina: null,
    max_povrsina: null
  });

  const availableYears = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008];

  // Določi privzete vrednosti glede na tip podatkov (prodaja ali najem)
  const getDefaultRanges = () => {
    if (dataSourceType === 'prodaja') {
      return {
        cena: { min: 0, max: 1000000, step: 10000, label: 'Cena (€)' },
        povrsina: { min: 0, max: 500, step: 5, label: 'Površina (m²)' }
      };
    } else {
      return {
        cena: { min: 0, max: 3000, step: 50, label: 'Najemnina (€/mesec)' },
        povrsina: { min: 0, max: 300, step: 5, label: 'Površina (m²)' }
      };
    }
  };

  const ranges = getDefaultRanges();

  // Posodobi filtre ko se spremenijo aktivni filtri iz parent komponente
  useEffect(() => {
    // Če so aktivni filtri prazni (reset iz parent komponente), počisti obrazec
    if (Object.keys(activeFilters).length === 0) {
      setFilters({
        filter_leto: 2025,
        min_cena: null,
        max_cena: null,
        min_povrsina: null,
        max_povrsina: null
      });
    } else {
      // Posodobi obrazec da se ujema z zunanjim stanjem
      setFilters({
        filter_leto: activeFilters.filter_leto || 2025,
        min_cena: activeFilters.min_cena || null,
        max_cena: activeFilters.max_cena || null,
        min_povrsina: activeFilters.min_povrsina || null,
        max_povrsina: activeFilters.max_povrsina || null
      });
    }
  }, [activeFilters]);

  // Ohrani filtre ko se spremeni tip podatkov (prodaja/najem)
  useEffect(() => {
    // Filtriramo samo ne-prazne vrednosti
    const cleanedFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== null && v !== '')
    );

    // Pošljemo trenutne filtre parentu za validacijo
    if (onFiltersChange) {
      onFiltersChange(cleanedFilters);
    }
  }, [dataSourceType]); 

  // Obravnavanje sprememb filtrov
  const handleFilterChange = (key, value) => {
    const newFilters = {
      ...filters,
      [key]: value === '' || value === null ? null : value
    };
    setFilters(newFilters);

    // Pošlje samo ne-prazne vrednosti parentu
    const cleanedFilters = Object.fromEntries(
      Object.entries(newFilters).filter(([_, v]) => v !== null && v !== '')
    );

    if (onFiltersChange) {
      onFiltersChange(cleanedFilters);
    }
  };

  // Reset vseh filtrov
  const handleReset = () => {
    const resetFilters = {
      filter_leto: 2025,
      min_cena: null,
      max_cena: null,
      min_povrsina: null,
      max_povrsina: null
    };
    setFilters(resetFilters);

    if (onFiltersChange) {
      onFiltersChange({}); // Pošlje prazen objekt za reset
    }
  };

  // Preveri ali so aktivni kakšni filtri
  const hasActiveFilters = Object.values(filters).some(value => value !== null && value !== '');

  // Formatiranje prikazane cene glede na tip podatkov
  const formatCenaLabel = (value) => {
    if (dataSourceType === 'prodaja') {
      return value >= 1000 ? `${(value / 1000).toFixed(0)}k €` : `${value} €`;
    } else {
      return `${value} €`;
    }
  };

  // Pripravi besedilo za prikaz aktivnih filtrov
  const getActiveFiltersText = () => {
    const activeFiltersList = [];
    
    if (filters.filter_leto) {
      activeFiltersList.push(`od ${filters.filter_leto}`);
    }
    
    if (filters.min_cena || filters.max_cena) {
      const minPrice = filters.min_cena ? formatCenaLabel(filters.min_cena) : '0';
      const maxPrice = filters.max_cena ? formatCenaLabel(filters.max_cena) : '∞';
      activeFiltersList.push(`${minPrice} - ${maxPrice}`);
    }
    
    if (filters.min_povrsina || filters.max_povrsina) {
      const minArea = filters.min_povrsina || '0';
      const maxArea = filters.max_povrsina || '∞';
      activeFiltersList.push(`${minArea} - ${maxArea} m²`);
    }
    
    return activeFiltersList;
  };

  // Mobilna verzija filtra
  if (isMobile) {
    return (
      <>
        {/* Okrogel gumb za odpiranje filtra na mobilnih napravah */}
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 left-4 bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center z-10"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%'
          }}
          title="Odpri filtre"
        >
          <div className="relative">
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {/* Indikator aktivnih filtrov */}
            {hasActiveFilters && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
            )}
          </div>
        </button>

        {/* Mobilni filter container - prikaže se z dna zaslona */}
        {isOpen && (
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <div
              className="bg-white rounded-t-xl shadow-lg border-t border-gray-200 transition-all duration-300 ease-out flex flex-col animate-slide-up"
              style={{
                height: '500px'
              }}
            >
              {/* Naslovnica s tipko za zapiranje */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-semibold text-gray-800">Filtri</h2>
                  {hasActiveFilters && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Vsebina filtrov z možnostjo drsenja */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Filter za leto */}
                  <div>
                    <label htmlFor="mobile-filter-leto" className="block text-sm font-medium text-gray-700 mb-2">
                      Posli od leta
                    </label>
                    <select
                      id="mobile-filter-leto"
                      value={filters.filter_leto || 2025}
                      onChange={(e) => handleFilterChange('filter_leto', e.target.value || 2025)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isLoading}
                    >
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter za ceno */}
                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">{ranges.cena.label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="mobile-min-cena" className="sr-only">Minimalna cena</label>
                        <input
                          id="mobile-min-cena"
                          type="number"
                          value={filters.min_cena || ''}
                          onChange={(e) => handleFilterChange('min_cena', e.target.value || null)}
                          placeholder="Min"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label htmlFor="mobile-max-cena" className="sr-only">Maksimalna cena</label>
                        <input
                          id="mobile-max-cena"
                          type="number"
                          value={filters.max_cena || ''}
                          onChange={(e) => handleFilterChange('max_cena', e.target.value || null)}
                          placeholder="Max"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Filter za površino */}
                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">{ranges.povrsina.label}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="mobile-min-povrsina" className="sr-only">Minimalna površina</label>
                        <input
                          id="mobile-min-povrsina"
                          type="number"
                          value={filters.min_povrsina || ''}
                          onChange={(e) => handleFilterChange('min_povrsina', e.target.value || null)}
                          placeholder="Min m²"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label htmlFor="mobile-max-povrsina" className="sr-only">Maksimalna površina</label>
                        <input
                          id="mobile-max-povrsina"
                          type="number"
                          value={filters.max_povrsina || ''}
                          onChange={(e) => handleFilterChange('max_povrsina', e.target.value || null)}
                          placeholder="Max m²"
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gumb za resetiranje filtrov */}
                  {hasActiveFilters && (
                    <button
                      onClick={handleReset}
                      className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-gray-300 rounded-md transition-colors duration-200"
                      disabled={isLoading}
                    >
                      Počisti filtre ({Object.values(filters).filter(v => v !== null && v !== '').length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Namizna verzija filtra
  return (
    <div className="fixed bottom-4 left-4 z-10 flex flex-col">
      {/* Glavni filter container z razširjanjem navzgor */}
      <div className="bg-white shadow-xl border border-gray-200 rounded-xl transition-all duration-300 w-96 flex flex-col overflow-hidden">
        
        {/* Vsebina filtrov - prikaže se samo ko je odprt */}
        {isOpen && (
          <div className="border-b border-gray-100">
            {/* Naslovnica */}
            <div className="bg-white px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                <h2 className="text-sm font-semibold text-gray-800">Filtri</h2>
              </div>
            </div>

            {/* Vnosna polja za filtre */}
            <div className="p-4">
              <div className="space-y-4">
                {/* Filter za leto */}
                <div>
                  <label htmlFor="desktop-filter-leto" className="block text-sm font-medium text-gray-700 mb-2">
                    Posli od leta
                  </label>
                  <select
                    id="desktop-filter-leto"
                    value={filters.filter_leto || 2025}
                    onChange={(e) => handleFilterChange('filter_leto', e.target.value || 2025)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    disabled={isLoading}
                  >
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Filter za ceno */}
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">
                    {ranges.cena.label}
                  </span>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="desktop-min-cena" className="block text-xs text-gray-500 mb-1">Min</label>
                        <input
                          id="desktop-min-cena"
                          type="number"
                          value={filters.min_cena || ''}
                          onChange={(e) => handleFilterChange('min_cena', e.target.value || null)}
                          placeholder="0"
                          min={ranges.cena.min}
                          max={ranges.cena.max}
                          step={ranges.cena.step}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label htmlFor="desktop-max-cena" className="block text-xs text-gray-500 mb-1">Max</label>
                        <input
                          id="desktop-max-cena"
                          type="number"
                          value={filters.max_cena || ''}
                          onChange={(e) => handleFilterChange('max_cena', e.target.value || null)}
                          placeholder={ranges.cena.max.toString()}
                          min={ranges.cena.min}
                          max={ranges.cena.max}
                          step={ranges.cena.step}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter za površino */}
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">
                    {ranges.povrsina.label}
                  </span>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="desktop-min-povrsina" className="block text-xs text-gray-500 mb-1">Min</label>
                        <input
                          id="desktop-min-povrsina"
                          type="number"
                          value={filters.min_povrsina || ''}
                          onChange={(e) => handleFilterChange('min_povrsina', e.target.value || null)}
                          placeholder="0"
                          min={ranges.povrsina.min}
                          max={ranges.povrsina.max}
                          step={ranges.povrsina.step}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label htmlFor="desktop-max-povrsina" className="block text-xs text-gray-500 mb-1">Max</label>
                        <input
                          id="desktop-max-povrsina"
                          type="number"
                          value={filters.max_povrsina || ''}
                          onChange={(e) => handleFilterChange('max_povrsina', e.target.value || null)}
                          placeholder={ranges.povrsina.max.toString()}
                          min={ranges.povrsina.min}
                          max={ranges.povrsina.max}
                          step={ranges.povrsina.step}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gumb za resetiranje filtrov */}
                {hasActiveFilters && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={handleReset}
                      className="w-full bg-gray-50 hover:bg-gray-100 text-black px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-2 border border-gray-200"
                      disabled={isLoading}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Počisti filtre</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Kompaktni gumb za odpiranje/zapiranje filtra */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hover:bg-gray-50 transition-all duration-300 p-4 w-full rounded-xl"
          title={hasActiveFilters ? "Aktivni filtri" : "Odpri filtre"}
        >
          <div className="flex items-center space-x-3">
            <div className="relative flex-shrink-0">
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {/* Indikator aktivnih filtrov */}
              {hasActiveFilters && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
              )}
            </div>
            
            <div className="flex flex-col items-start min-w-0 flex-1">
              {hasActiveFilters ? (
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                    Aktivni filtri ({Object.values(filters).filter(v => v !== null && v !== '').length})
                  </span>
                  <div className="text-sm text-gray-600 truncate">
                    {getActiveFiltersText().join(' • ')}
                  </div>
                </div>
              ) : (
                <span className="text-sm font-semibold text-gray-800">Filtri</span>
              )}
            </div>

            {/* Puščica za odpiranje/zapiranje */}
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}