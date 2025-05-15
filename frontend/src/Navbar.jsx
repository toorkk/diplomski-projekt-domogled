export default function Navbar({ activePage, onPageChange }) {
  const navItems = [
    { name: 'Zemljevid', key: 'zemljevid' },
    { name: 'Primerjevalnik', key: 'primerjevalnik' },
    { name: 'Statistika', key: 'statistika' },
    { name: 'Izračun', key: 'izracun' }
  ];

  return (
    <nav className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex items-center px-8 py-4">
        {/* Logo */}
        <div className="flex items-center mr-10">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className="text-xl font-semibold text-gray-800">Domogled</span>
        </div>

        {/* Navigacija */}
        <div className="flex items-center space-x-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onPageChange(item.key)}
              className={`px-6 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
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