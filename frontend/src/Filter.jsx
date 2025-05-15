import { useState } from "react";

export default function Filters() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-50 left-0 z-10 flex">
      {/* Zaprt filter */}
      <button
        onClick={() => setIsOpen(true)}
        className={`bg-white shadow-lg border-r border-gray-200 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center flex-shrink-0 ${
          isOpen ? 'opacity-0 pointer-events-none w-0' : 'opacity-100'
        }`}
        style={{
          width: isOpen ? '0px' : '50px',
          height: '600px',
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

      {/* Odprt filter */}
      <div 
        className={`bg-white rounded-r-xl shadow-lg border border-gray-200 h-150 transition-all duration-300 ease-out ${
          isOpen 
            ? 'w-96 opacity-100' 
            : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 whitespace-nowrap">Filtri</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        
        {/* Samo prazen prostor za sedaj */}
        <div className="p-6">
          <p className="text-gray-500 text-base whitespace-nowrap">Filtri bodo dodani pozneje</p>
        </div>
      </div>
    </div>
  );
}