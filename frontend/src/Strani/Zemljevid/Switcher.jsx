import { useIsMobile } from '../../hooks/useIsMobile';

export default function Switcher({ activeType, onChangeType }) {
  const isMobile = useIsMobile();

  // Pozicioniranje glede na screen velikost
  const positionClasses = isMobile 
    ? 'absolute top-25 left-4 right-4' 
    : 'absolute top-7 right-4';

  return (
    <div 
      className={`${positionClasses} z-10 bg-white rounded-xl shadow-lg border border-gray-200 ${
        isMobile ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center justify-center space-x-4">
        {/* Prodaja label */}
        <span 
          className={`${
            isMobile ? 'text-sm' : 'text-base'
          } font-medium transition-colors duration-200 ${
            activeType === 'prodaja' ? '' : 'text-gray-600'
          }`}
          style={{
            color: activeType === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : undefined
          }}
        >
          Prodaja
        </span>

        {/* Toggle switch */}
        <button
          onClick={() => onChangeType(activeType === 'prodaja' ? 'najem' : 'prodaja')}
          className={`relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 ${
            isMobile ? 'h-5 w-9' : 'h-6 w-11'
          }`}
          style={{
            backgroundColor: activeType === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : '#00d492'
          }}
          aria-pressed={activeType !== 'prodaja'}
          aria-label="Preklopi med prodajo in najemom"
        >
          <span
            className={`inline-block rounded-full bg-white transition-transform ${
              isMobile 
                ? 'h-3 w-3' 
                : 'h-4 w-4'
            } ${
              activeType === 'prodaja' 
                ? 'translate-x-1'
                : (isMobile ? 'translate-x-5' : 'translate-x-6')
            }`}
          />
        </button>

        {/* Najem label */}
        <span className={`${
          isMobile ? 'text-sm' : 'text-base'
        } font-medium transition-colors duration-200 ${
          activeType === 'najem' ? 'text-emerald-400' : 'text-gray-600'
        }`}>
          Najem
        </span>
      </div>
    </div>
  );
}