import { useState } from "react";

export default function Switcher() {
  const [activeType, setActiveType] = useState('prodaja');

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
      <div className="flex items-center justify-center space-x-4">
        {/* Prodaja label */}
        <span className={`text-base font-medium transition-colors duration-200 ${
          activeType === 'prodaja' ? 'text-blue-700' : 'text-gray-600'
        }`}>
          Prodaja
        </span>

        {/* Toggle switch */}
        <button
          onClick={() => setActiveType(activeType === 'prodaja' ? 'najem' : 'prodaja')}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          style={{
            backgroundColor: activeType === 'prodaja' ? '#3B82F6' : '#6B7280'
          }}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              activeType === 'prodaja' ? 'translate-x-1' : 'translate-x-6'
            }`}
          />
        </button>

        {/* Najem label */}
        <span className={`text-base font-medium transition-colors duration-200 ${
          activeType === 'najem' ? 'text-blue-700' : 'text-gray-600'
        }`}>
          Najem
        </span>
      </div>
    </div>
  );
}