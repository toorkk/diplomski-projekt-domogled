export default function Navbar({ activePage, onPageChange }) {
  const navItems = [
    { name: 'Zemljevid', key: 'zemljevid' },
    { name: 'Primerjevalnik', key: 'primerjevalnik' },
    { name: 'Statistika', key: 'statistika' },
    { name: 'Izračun', key: 'izracun' }
  ];

  return (
    <nav className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex items-center px-6 py-3">
        {/* Logo */}
        <div className="flex items-center mr-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-800">Domogled</span>
        </div>

        {/* Navigacija */}
        <div className="flex items-center space-x-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onPageChange(item.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activePage === item.key
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}