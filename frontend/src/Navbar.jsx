import { useState, useEffect } from "react";

export default function Navbar({ activePage, onPageChange }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navItems = [
    { name: 'Zemljevid', key: 'zemljevid' },
    { name: 'Statistika', key: 'statistika' },
  ];

  // Detecta screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePageChange = (key) => {
    onPageChange(key);
    setIsMenuOpen(false); 
  };

  return (
    <nav className={`absolute top-6 z-30 bg-white rounded-xl shadow-lg border border-gray-100 ${
      isMobile 
        ? 'left-4 right-4' 
        : 'left-1/2 transform -translate-x-1/2'
    }`}>
      <div className={`flex items-center ${isMobile ? 'px-5 py-3' : 'px-8 py-4'}`}>
        {/* Logo */}
        <div className={`flex items-center ${isMobile ? 'mr-3' : 'mr-8'}`}>
          <div className="w-10 h-10 bg-white border border-gray-300 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-800`}>Domogled</span>
        </div>

        {/* Big screen navigacija */}
        {!isMobile && (
          <div className="flex items-center space-x-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onPageChange(item.key)}
                className={`px-4 py-3 text-sm font-medium transition-all duration-200 relative ${
                  activePage === item.key
                    ? 'text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {item.name}
                {activePage === item.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Hamburger */}
        {isMobile && (
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 text-gray-600 hover:text-gray-800 transition-colors ml-auto"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile Menu */}
      {isMobile && (
        <div
          className={`${
            isMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
          } overflow-hidden transition-all duration-300 ease-in-out border-t border-gray-100 relative z-50`}
        >
          <div className="py-2 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handlePageChange(item.key)}
                className={`w-full px-6 py-3 text-left text-base font-medium transition-all duration-200 relative ${
                  activePage === item.key
                    ? 'text-gray-900 bg-gray-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {item.name}
                {activePage === item.key && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-900 rounded-r"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}