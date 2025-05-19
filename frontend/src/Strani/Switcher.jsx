import { useState, useEffect } from "react";

export default function Switcher() {
  const [activeType, setActiveType] = useState('prodaja');
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dynamic positioning based on screen size
  const positionClasses = isMobile 
    ? 'absolute top-25 left-4 right-4' 
    : 'absolute top-10 right-20';

  return (
    <div 
      className={`${positionClasses} z-10 bg-white rounded-xl shadow-lg border border-gray-200 ${
        isMobile ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center justify-center space-x-4">
        {/* Prodaja label */}
        <span className={`${
          isMobile ? 'text-sm' : 'text-base'
        } font-medium transition-colors duration-200 ${
          activeType === 'prodaja' ? 'text-blue-700' : 'text-gray-600'
        }`}>
          Prodaja
        </span>

        {/* Toggle switch */}
        <button
          onClick={() => setActiveType(activeType === 'prodaja' ? 'najem' : 'prodaja')}
          className={`relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isMobile ? 'h-5 w-9' : 'h-6 w-11'
          }`}
          style={{
            backgroundColor: activeType === 'prodaja' ? '#3B82F6' : '#6B7280'
          }}
        >
          <span
            className={`inline-block rounded-full bg-white transition-transform ${
              isMobile 
                ? 'h-3 w-3' 
                : 'h-4 w-4'
            } ${
              activeType === 'prodaja' 
                ? (isMobile ? 'translate-x-1' : 'translate-x-1')
                : (isMobile ? 'translate-x-5' : 'translate-x-6')
            }`}
          />
        </button>

        {/* Najem label */}
        <span className={`${
          isMobile ? 'text-sm' : 'text-base'
        } font-medium transition-colors duration-200 ${
          activeType === 'najem' ? 'text-blue-700' : 'text-gray-600'
        }`}>
          Najem
        </span>
      </div>
    </div>
  );
}