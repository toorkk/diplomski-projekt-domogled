import { useState, useEffect } from "react";

export default function Filters() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detekcija screen siza
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsOpen(false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Big screen (filter na levi strani)
  if (!isMobile) {
    return (
      <div className="absolute top-32 md:top-40 lg:top-48 left-0 z-10 flex">
        {/* Zaprt filter - desktop */}
        <button
          onClick={() => setIsOpen(true)}
          className={`bg-white shadow-lg border-r border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center flex-shrink-0 ${
            isOpen ? 'opacity-0 pointer-events-none w-0' : 'opacity-100'
          }`}
          style={{
            width: isOpen ? '0px' : '50px',
            height: '50vh',
            borderTopRightRadius: '12px',
            borderBottomRightRadius: '12px'
          }}
          title="Odpri filtre"
        >
          <svg 
            className="w-7 h-7 text-gray-700" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7" 
            />
          </svg>
        </button>

        {/* Odprt filter - desktop */}
        <div 
          className={`bg-white rounded-r-xl shadow-lg border border-gray-200 transition-all duration-300 ease-out ${
            isOpen 
              ? 'w-80 md:w-96 opacity-100' 
              : 'w-0 opacity-0 overflow-hidden'
          }`}
          style={{
            height: '50vh',
            maxHeight: '400px',
            minHeight: '300px'
          }}
        >
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800 whitespace-nowrap">Filtri</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 flex-shrink-0"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          
          {/* Dejanski content v filtru z scrolloml */}
          <div className="p-4 md:p-6 overflow-y-auto" style={{ height: 'calc(50vh - 80px)' }}>
            <p className="text-gray-500 text-sm md:text-base whitespace-nowrap">Filtri bodo dodani pozneje</p>
          </div>
        </div>
      </div>
    );
  }

  // Mobile vpogled (filter spodaj)
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10">
      {/* Zaprt filter - mobile */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-4 left-4 bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%'
          }}
          title="Odpri filtre"
        >
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
        </button>
      )}

      {/* Odprt filter - mobile (slide gor) */}
      <div 
        className={`bg-white rounded-t-xl shadow-lg border-t border-gray-200 transition-all duration-300 ease-out overflow-hidden ${
          isOpen 
            ? 'max-h-96 opacity-100' 
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Filtri</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {/* Dejanski content z scrollom -- mobile */}
        <div className="p-4 overflow-y-auto max-h-80">
          <p className="text-gray-500 text-sm">Filtri bodo dodani pozneje</p>
        </div>
      </div>
    </div>
  );
}