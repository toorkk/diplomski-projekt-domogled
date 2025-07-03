import { useState, useEffect, useRef } from 'react';
import {
  getDaBoljNe, getNeBoljDa, getVrstaDelaStavbe, getGradebnaFaza,
  getStopnjaDDV, getCasNajemanja, getTrznostPosla, getVrstaAkta,
  getVrstaNajemnegaPosla, getVrstaProdajnegaPosla, getEnergyClassColor,
  getColorClasses, getNaslov, getCeloStDelaStavbe
} from './PodrobnostiHelper.jsx';
import { API_CONFIG } from './MapConstants.jsx';
import { useIsMobile } from '../../hooks/useIsMobile';


const DEFAULT_TAB = 'posli';

const formatPrice = (price) => {
  if (!price) return null;
  return Math.round(price).toLocaleString('sl-SI');
};

const formatirajDatum = (dateString) => {
  if (!dateString) return 'Neznano';
  const date = new Date(dateString);
  return date.toLocaleDateString('sl-SI', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatRentalPeriod = (startDate, endDate) => {
  if (!startDate && !endDate) return 'Neznano obdobje';
  if (!startDate) return `Do ${formatirajDatum(endDate)}`;
  if (!endDate) return `Od ${formatirajDatum(startDate)}`;
  return `${formatirajDatum(startDate)} – ${formatirajDatum(endDate)}`;
};

const usePodrobnostiData = (propertyId, dataSource) => {
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/property-details/${propertyId}?data_source=${dataSource}`);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        setProperty(data.properties);
      } catch (err) {
        setError('Prišlo je do napake pri nalaganju podatkov. Poskusite ponovno.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [propertyId, dataSource]);

  return { loading, property, error };
};

// Komponente za prikaz podatkov
const DetailRow = ({ label, value, className = '' }) => {
  const displayValue = value || 'N/A';
  return (
    <div className="flex justify-between items-center">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}:</div>
      <div className={`text-sm font-semibold text-gray-800 ${className}`}>{displayValue}</div>
    </div>
  );
};

const LoadingSpinner = ({ className = "h-12 w-12" }) => (
  <div className="flex items-center justify-center w-full h-full">
    <div className={`animate-spin rounded-full border-b-2 border-gray-600 ${className}`}></div>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="text-red-500 text-center py-8 w-full">{message}</div>
);

// Komponenta za energetsko izkaznico
const EnergetskaIzkaznica = ({ energetske_izkaznice, selectedEnergyIndex, setSelectedEnergyIndex }) => {
  if (!energetske_izkaznice || energetske_izkaznice.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-3">
        <h4 className="text-lg font-semibold text-gray-800 mb-3">Energetska izkaznica</h4>
        <div className="text-center py-4 text-gray-500 text-sm">
          Za ta del stavbe ni na voljo energetske izkaznice
        </div>
      </div>
    );
  }

  const selectedEI = energetske_izkaznice[selectedEnergyIndex];

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-3">
      <h4 className="text-lg font-semibold text-gray-800 mb-3">
        Energetska izkaznica {selectedEI.ei_id ? ': ' + selectedEI.ei_id : ''}
      </h4>
      <div className="space-y-2">
        {energetske_izkaznice.length > 1 && (
          <EnergySelector
            energetske_izkaznice={energetske_izkaznice}
            selectedEnergyIndex={selectedEnergyIndex}
            setSelectedEnergyIndex={setSelectedEnergyIndex}
          />
        )}
        {selectedEI && <EnergyDetails selectedEI={selectedEI} />}
      </div>
    </div>
  );
};

const EnergySelector = ({ energetske_izkaznice, selectedEnergyIndex, setSelectedEnergyIndex }) => (
  <div className="mb-3">
    <select
      value={selectedEnergyIndex}
      onChange={(e) => setSelectedEnergyIndex(parseInt(e.target.value))}
      className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
    >
      {energetske_izkaznice.map((ei, index) => (
        <option key={ei.id} value={index}>
          {ei.ei_id} - {ei.datum_izdelave ?
            new Date(ei.datum_izdelave).toLocaleDateString('sl-SI') :
            'Neznan datum'}
          {ei.energijski_razred && ` (${ei.energijski_razred})`}
        </option>
      ))}
    </select>
  </div>
);

const EnergyDetails = ({ selectedEI }) => (
  <div className="bg-gray-50 p-2 rounded text-sm">
    <div className="grid grid-cols-2 gap-3">
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Razred:</div>
        <div className={`font-medium px-2 py-1 rounded text-center min-w-[50px] text-sm ${getEnergyClassColor(selectedEI.energijski_razred)}`}>
          {selectedEI.energijski_razred || 'N/A'}
        </div>
      </div>
      <DetailRow label="Prim. energija" value={selectedEI.primarna_energija ? `${Math.round(selectedEI.primarna_energija)} kWh/m²a` : null} />
      <DetailRow label="CO₂ emisije" value={selectedEI.emisije_co2 ? `${Math.round(selectedEI.emisije_co2)} kg/m²a` : null} />
      <DetailRow label="Izdelano" value={selectedEI.datum_izdelave ? formatirajDatum(selectedEI.datum_izdelave) : null} />
      <DetailRow label="Velja do" value={selectedEI.velja_do ? formatirajDatum(selectedEI.velja_do) : null} />
    </div>
  </div>
);

// Komponenta za podatke o ceni
const getCenaInfo = (posel, dataSource) => {
  if (dataSource === 'kpp') {
    const cena = posel.cena;
    return {
      hasCena: !!cena,
      cenaText: cena ? `€${cena.toLocaleString('sl-SI')}` : null,
      cenaLabel: 'Prodajna cena:',
      ddvInfo: posel.vkljuceno_ddv ?
        `z DDV${posel.stopnja_ddv ? ` (${posel.stopnja_ddv}%)` : ' (% neznan)'}` :
        'brez DDV'
    };
  }

  const najemnina = posel.najemnina;
  return {
    hasCena: !!najemnina,
    cenaText: najemnina ? `€${najemnina.toLocaleString('sl-SI')}/mesec` : null,
    cenaLabel: 'Najemnina:',
    ddvInfo: posel.vkljuceno_ddv ?
      `z DDV${posel.stopnja_ddv ? ` (${posel.stopnja_ddv}%)` : ''}` :
      'brez DDV',
    stroskiInfo: posel.vkljuceno_stroski ? 'stroški vključeni' : 'stroški niso vključeni'
  };
};

// Komponenta za prikaz cene
const PriceDisplay = ({ priceInfo, connectedPartsCount }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
    <div className="text-center">
      <div className="text-gray-600 text-sm mb-1">{priceInfo.cenaLabel}</div>
      {connectedPartsCount > 1 && (
        <div className="text-gray-800 text-sm mb-1">
          <span className="font-semibold text-black">{connectedPartsCount}</span> delov stavb
        </div>
      )}
      {priceInfo.hasCena ? (
        <>
          <div className="font-bold text-xl text-gray-800 mb-1">{priceInfo.cenaText}</div>
          <div className="text-sm text-gray-500">
            {priceInfo.ddvInfo}
            {priceInfo.stroskiInfo ? ` • ${priceInfo.stroskiInfo}` : ''}
          </div>
        </>
      ) : (
        <div className="font-bold text-lg text-gray-600">Podatek ni na voljo</div>
      )}
    </div>
  </div>
);

// Komponenta za podatke o poslu
const PoselData = ({ posel, dataSource }) => (
  <div className="bg-gray-50 p-2 rounded text-sm">
    <h5 className="font-semibold text-gray-800 mb-2">Podatki o poslu</h5>
    <div className="grid grid-cols-1 gap-y-1 text-sm">
      <DetailRow label="Datum sklenitve" value={posel.datum_sklenitve ? formatirajDatum(posel.datum_sklenitve) : null} />
      <DetailRow label="Datum uveljavitve" value={posel.datum_uveljavitve ? formatirajDatum(posel.datum_uveljavitve) : null} />
      <DetailRow label="Zadnja uveljavitev" value={posel.datum_zadnje_uveljavitve ? formatirajDatum(posel.datum_zadnje_uveljavitve) : null} />
      <DetailRow label="Zadnja sprememba" value={posel.datum_zadnje_spremembe ? formatirajDatum(posel.datum_zadnje_spremembe) : null} />
      <DetailRow label="Tržnost posla" value={getTrznostPosla(posel.trznost_posla)} />
      <DetailRow
        label="Vrsta posla"
        value={dataSource === 'np' ? getVrstaNajemnegaPosla(posel.vrsta_posla) : getVrstaProdajnegaPosla(posel.vrsta_posla)}
      />
    </div>
  </div>
);

// Komponenta za osnovne sekcije nepremičnine
const PropertySection = ({ title, children, className = "" }) => (
  <div className={`bg-white border border-gray-300 rounded-lg p-3 ${className}`}>
    <h4 className="text-lg font-semibold text-gray-800 mb-3">{title}</h4>
    {children}
  </div>
);

const DimensionsSection = ({ property }) => (
  <PropertySection title="Dimenzije">
    <div className="bg-gray-50 p-2 rounded text-sm">
      <div className="grid grid-cols-2 gap-4">
        <DetailRow label="Površina" value={property.povrsina_uradna ? `${property.povrsina_uradna} m²` : null} />
        <DetailRow label="Uporabna pov." value={property.povrsina_uporabna ? `${property.povrsina_uporabna} m²` : null} />
        {property.stevilo_sob > 0 && (
          <DetailRow label="Število sob" value={property.stevilo_sob} />
        )}
        {property.nadstropje && (
          <DetailRow label="Nadstropje" value={property.nadstropje} />
        )}
        <DetailRow label="Lega v stavbi" value={property.lega_v_stavbi} />
      </div>
    </div>
  </PropertySection>
);

const PropertyTypeSection = ({ property, dataSource }) => (
  <PropertySection title="Tip nepremičnine">
    <div className="bg-gray-50 p-2 rounded text-sm space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <DetailRow label="Vrsta" value={getVrstaDelaStavbe(property.vrsta_nepremicnine)} />
        {dataSource === 'kpp' && (
          <DetailRow label="Prodani delež" value={property.prodani_delez} />
        )}
        {dataSource === 'np' && (
          <DetailRow label="Opremljenost" value={getDaBoljNe(property.opremljenost)} />
        )}
      </div>
      <DetailRow label="Dejanska raba" value={property.dejanska_raba} />
    </div>
  </PropertySection>
);

const RoomsDescriptionSection = ({ property }) => (
  <PropertySection title="Opis prostorov">
    {property.prostori && property.prostori !== '-' ? (
      <div className="bg-gray-50 p-2 rounded text-sm text-gray-800 leading-relaxed">
        {property.prostori}
      </div>
    ) : (
      <div className="text-center py-4 text-gray-500 text-sm">Opis ni podan</div>
    )}
  </PropertySection>
);

const BuildingDataSection = ({ property }) => (
  <PropertySection title="Podatki o stavbi">
    <div className="bg-gray-50 p-2 rounded text-sm">
      <div className="grid grid-cols-2 gap-4">
        <DetailRow label="Številka stavbe" value={property.stevilka_stavbe} />
        <DetailRow label="Leto izgradnje" value={property.leto_izgradnje_stavbe} />
        <DetailRow label="Novogradnja" value={getDaBoljNe(property.novogradnja)} />
        <DetailRow label="Stavba dokončana" value={getNeBoljDa(property.stavba_je_dokoncana)} />
        {property.stavba_je_dokoncana === 0 && (
          <DetailRow label="Gradbena faza" value={getGradebnaFaza(property.gradbena_faza)} />
        )}
      </div>
    </div>
  </PropertySection>
);

const FinancialDataSection = ({ property }) => {
  if (!property.pogodbena_cena && !property.stopnja_ddv) return null;

  return (
    <PropertySection title="Finančni podatki">
      <div className="bg-gray-50 p-2 rounded text-sm">
        <div className="grid grid-cols-2 gap-2">
          <DetailRow label="Pogodbena cena" value={property.pogodbena_cena ? `€${formatPrice(property.pogodbena_cena)}` : null} />
          <DetailRow label="Stopnja DDV" value={getStopnjaDDV(property.stopnja_ddv)} />
        </div>
      </div>
    </PropertySection>
  );
};

const NotesSection = ({ property }) => {
  if (!property.opombe) return null;

  return (
    <PropertySection title="Opombe">
      <div className="bg-gray-50 p-2 rounded text-sm">
        <div className="text-sm text-gray-800 leading-relaxed">{property.opombe}</div>
      </div>
    </PropertySection>
  );
};

// Header komponente
const MobileHeader = ({ colors, loading, representativeProperty, onClose }) => (
  <div className="relative backdrop-blur">
    <div className={`absolute inset-0 ${colors.headerBg} opacity-80`}></div>
    <div className={`relative ${colors.headerText} p-3 border-b border-gray-200`}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">
            {loading ? 'Nalaganje...' : getNaslov(representativeProperty)}
          </h2>
          {!loading && representativeProperty && (
            <div className="mt-1 text-gray-800 font-semibold text-sm pt-1">
              {getCeloStDelaStavbe(representativeProperty)}
              {representativeProperty.stev_stanovanja && `, št. stanovanja: ${representativeProperty.stev_stanovanja}`}
            </div>
          )}
        </div>
        <CloseButton onClick={onClose} />
      </div>
    </div>
  </div>
);

const DesktopHeader = ({ colors, loading, representativeProperty, onClose }) => (
  <div className="relative backdrop-blur">
    <div className={`absolute inset-0 ${colors.headerBg} opacity-80`}></div>
    <div className={`relative ${colors.headerText} p-4 border-b border-gray-200`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">
            {loading ? 'Nalaganje...' : getNaslov(representativeProperty)}
          </h2>
          {!loading && representativeProperty && (
            <div className="mt-1 text-gray-800 font-semibold text-lg pt-2">
              {getCeloStDelaStavbe(representativeProperty)}
              {representativeProperty.stev_stanovanja && `, št. stanovanja: ${representativeProperty.stev_stanovanja}`}
            </div>
          )}
        </div>
        <CloseButton onClick={onClose} className="ml-4" />
      </div>
    </div>
  </div>
);

const CloseButton = ({ onClick, className = "ml-2" }) => (
  <button
    onClick={onClick}
    className={`text-gray-600 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0 ${className}`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
);

// Tab komponente
const TabNavigation = ({ activeTab, setActiveTab, posliCount }) => (
  <div className="bg-white border-b border-gray-200">
    <div className="flex">
      <TabButton
        isActive={activeTab === 'posli'}
        onClick={() => setActiveTab('posli')}
        text={`Posli (${posliCount})`}
      />
      <TabButton
        isActive={activeTab === 'details'}
        onClick={() => setActiveTab('details')}
        text="Podrobnosti"
      />
    </div>
  </div>
);

const TabButton = ({ isActive, onClick, text }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${isActive
        ? 'border-blue-500 text-blue-600 bg-blue-50'
        : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
  >
    {text}
  </button>
);

// Glavna komponenta
export default function Podrobnosti({ propertyId, dataSource = 'np', onClose }) {
  const [selectedEnergyIndex, setSelectedEnergyIndex] = useState(0);
  const [selectedPoselId, setSelectedPoselId] = useState(null);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);

  const isMobile = useIsMobile();
  const { loading, property, error } = usePodrobnostiData(propertyId, dataSource);
  const poselRefs = useRef({});

  // Auto-select first posel when data loads
  useEffect(() => {
    if (property?.povezani_posli?.length > 0 && !selectedPoselId) {
      setSelectedPoselId(property.povezani_posli[0].posel_id);
    }
  }, [property, selectedPoselId]);

  const getRepresentativeProperty = () => {
    if (!property) return null;

    if (selectedPoselId && property.reprezentativni_del_stavbe) {
      const povezaniDeli = getConnectedBuildingParts(selectedPoselId);
      const ujemajociDel = povezaniDeli.find(del =>
        del.sifra_ko === property.reprezentativni_del_stavbe.sifra_ko &&
        del.stevilka_stavbe === property.reprezentativni_del_stavbe.stevilka_stavbe &&
        del.stevilka_dela_stavbe === property.reprezentativni_del_stavbe.stevilka_dela_stavbe
      );

      if (ujemajociDel) return ujemajociDel;
    }

    return property.reprezentativni_del_stavbe;
  };

  const getConnectedBuildingParts = (poselId) => {
    if (!property.povezani_deli_stavb) return [];
    return property.povezani_deli_stavb.filter(del => del.posel_id === poselId);
  };

  const getSelectedPosel = () => {
    if (!property?.povezani_posli || !selectedPoselId) return null;
    return property.povezani_posli.find(posel => posel.posel_id === selectedPoselId);
  };

  const selectPosel = (poselId) => {
    setSelectedPoselId(poselId);

    if (isMobile) {
      setActiveTab('details');
      setTimeout(() => {
        const detailsContainer = document.querySelector('.details-content');
        if (detailsContainer) {
          detailsContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    } else {
      if (poselRefs.current[poselId]) {
        poselRefs.current[poselId].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const colors = getColorClasses(dataSource);
  const representativeProperty = getRepresentativeProperty();
  const selectedPosel = getSelectedPosel();
  const connectedParts = selectedPosel ? getConnectedBuildingParts(selectedPosel.posel_id) : [];

  return (
    <>
      {isMobile ? (
        <MobileLayout
          colors={colors}
          representativeProperty={representativeProperty}
          property={property}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedPoselId={selectedPoselId}
          selectedEnergyIndex={selectedEnergyIndex}
          setSelectedEnergyIndex={setSelectedEnergyIndex}
          poselRefs={poselRefs}
          selectPosel={selectPosel}
          dataSource={dataSource}
          connectedParts={connectedParts}
          onClose={onClose}
        />
      ) : (
        <DesktopLayout
          colors={colors}
          representativeProperty={representativeProperty}
          property={property}
          selectedPoselId={selectedPoselId}
          selectedEnergyIndex={selectedEnergyIndex}
          setSelectedEnergyIndex={setSelectedEnergyIndex}
          poselRefs={poselRefs}
          selectPosel={selectPosel}
          dataSource={dataSource}
          connectedParts={connectedParts}
          onClose={onClose}
        />
      )}
    </>
  );
}

// Layout komponente
const MobileLayout = ({ colors, representativeProperty, property, activeTab, setActiveTab, selectedPoselId, selectedEnergyIndex, setSelectedEnergyIndex, poselRefs, selectPosel, dataSource, connectedParts, onClose }) => (
  <div className="fixed inset-x-0 top-0 bottom-0 z-50 flex justify-center">
    <div className="absolute inset-0"></div>
    <div className="relative shadow-xl w-full h-full overflow-hidden flex flex-col">
      <MobileHeader colors={colors} representativeProperty={representativeProperty} onClose={onClose} />

      {property?.povezani_posli?.length > 0 && (
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          posliCount={property.povezani_posli.length}
        />
      )}

      <div className="flex-1 bg-gray-50 overflow-y-auto details-content">
        <div className="p-3">
          {activeTab === 'posli' ? (
            <PosliContent
              posli={property.povezani_posli}
              selectedPoselId={selectedPoselId}
              poselRefs={poselRefs}
              selectPosel={selectPosel}
              dataSource={dataSource}
              getConnectedBuildingParts={(poselId) => property.povezani_deli_stavb?.filter(del => del.posel_id === poselId) || []}
            />
          ) : (
            <DetailsContent
              representativeProperty={representativeProperty}
              dataSource={dataSource}
              selectedEnergyIndex={selectedEnergyIndex}
              setSelectedEnergyIndex={setSelectedEnergyIndex}
              property={property}
              connectedParts={connectedParts}
              isMobile={true}
            />
          )}
        </div>
      </div>
    </div>
  </div>
);

const DesktopLayout = ({ colors, representativeProperty, property, selectedPoselId, selectedEnergyIndex, setSelectedEnergyIndex, poselRefs, selectPosel, dataSource, connectedParts, onClose }) => (
  <div className="fixed inset-x-0 top-29 bottom-3 z-50 flex justify-center">
    <div className="absolute inset-0"></div>
    <div className="relative rounded-lg shadow-xl w-full max-w-7xl h-full overflow-hidden border border-gray-200 flex flex-col">
      <DesktopHeader colors={colors} representativeProperty={representativeProperty} onClose={onClose} />

      <div className="flex flex-1 bg-gray-50 min-h-0">
        <div className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="max-w-5xl mx-auto">
            <DetailsContent
              representativeProperty={representativeProperty}
              dataSource={dataSource}
              selectedEnergyIndex={selectedEnergyIndex}
              setSelectedEnergyIndex={setSelectedEnergyIndex}
              property={property}
              connectedParts={connectedParts}
              isMobile={false}
            />
          </div>
        </div>

        {property?.povezani_posli?.length > 0 && (
          <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto min-h-0 flex flex-col">
            <div className="p-3 bg-gray-100 border-b border-gray-200 sticky top-0">
              <h3 className="font-bold text-lg text-gray-800">
                Posli ({property.povezani_posli.length})
              </h3>
            </div>
            <div className="p-2 space-y-3 flex-1">
              <PosliContent
                posli={property.povezani_posli}
                selectedPoselId={selectedPoselId}
                poselRefs={poselRefs}
                selectPosel={selectPosel}
                dataSource={dataSource}
                getConnectedBuildingParts={(poselId) => property.povezani_deli_stavb?.filter(del => del.posel_id === poselId) || []}
                isDesktop={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);

// Content komponente
const PosliContent = ({ posli, selectedPoselId, poselRefs, selectPosel, dataSource, getConnectedBuildingParts, isDesktop = false }) => (
  <div className="space-y-3">
    {posli?.map((posel) => {
      const connectedPartsCount = getConnectedBuildingParts(posel.posel_id).length;
      const isSelected = selectedPoselId === posel.posel_id;
      const priceInfo = getCenaInfo(posel, dataSource);

      return (
        <PoselCard
          key={posel.posel_id}
          posel={posel}
          isSelected={isSelected}
          priceInfo={priceInfo}
          connectedPartsCount={connectedPartsCount}
          dataSource={dataSource}
          onClick={() => selectPosel(posel.posel_id)}
          ref={el => poselRefs.current[posel.posel_id] = el}
          isDesktop={isDesktop}
        />
      );
    })}
  </div>
);

const PoselCard = ({ posel, isSelected, priceInfo, connectedPartsCount, dataSource, onClick, isDesktop }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-lg cursor-pointer transition-colors bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isSelected
        ? 'border-2 border-gray-600 p-3'
        : `hover:bg-gray-100 border border-gray-300 p-3 ${isDesktop ? 'm-px mb-3' : ''}`
      }`}
    aria-pressed={isSelected}
    aria-label={`Posel ${dataSource === 'kpp' ? 'z dne' : 'za obdobje'} ${dataSource === 'kpp'
        ? (posel.datum_sklenitve && formatirajDatum(posel.datum_sklenitve))
        : formatRentalPeriod(posel.datum_zacetka_najemanja, posel.datum_prenehanja_najemanja)
      }${priceInfo.hasCena ? `, cena ${priceInfo.cenaText}` : ''}`}
  >
    <div className="space-y-3">
      <PoselHeader posel={posel} dataSource={dataSource} />
      <PriceDisplay priceInfo={priceInfo} connectedPartsCount={connectedPartsCount} />
      <PoselData posel={posel} dataSource={dataSource} />
      {posel.opombe && <PoselNotes posel={posel} />}
    </div>
  </button>
);

const PoselHeader = ({ posel, dataSource }) => (
  <div>
    <div className="flex flex-col gap-2">
      {dataSource === 'np' && (
        <span className="text-gray-800 text-sm font-medium">
          {getCasNajemanja(posel.cas_najemanja)}
          {posel.cas_najemanja === 1 && ` (${posel.trajanje_najemanja} mesecev)`}
        </span>
      )}
      {dataSource === 'kpp' && (
        <span className="font-bold text-gray-800">
          {posel.datum_sklenitve && formatirajDatum(posel.datum_sklenitve)}
        </span>
      )}
      {dataSource === 'np' && (
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-gray-900 self-start ${posel.vrsta_akta === 1 ? 'bg-gray-100' : 'bg-pink-100'
          }`}>
          {getVrstaAkta(posel.vrsta_akta)}
        </span>
      )}
    </div>

    {dataSource === 'np' && (
      <div className="mt-2 flex flex-col">
        <span className="font-bold text-gray-800">
          {formatRentalPeriod(posel.datum_zacetka_najemanja, posel.datum_prenehanja_najemanja)}
        </span>
        {!posel.datum_prenehanja_najemanja && !posel.datum_zakljucka_najema && (
          <span className="text-green-600 text-sm font-medium">Aktivno</span>
        )}
        {posel.datum_zakljucka_najema && posel.datum_prenehanja_najemanja !== posel.datum_zakljucka_najema && (
          <span className="text-sm text-gray-800 font-medium">
            Predčasen zaključek: {formatirajDatum(posel.datum_zakljucka_najema)}
          </span>
        )}
      </div>
    )}
  </div>
);

const PoselNotes = ({ posel }) => (
  <div className="bg-gray-50 p-2 rounded text-sm">
    <h5 className="font-semibold text-gray-800 mb-1">Opombe</h5>
    <p className="text-gray-600">{posel.opombe}</p>
  </div>
);

const DetailsContent = ({ representativeProperty, dataSource, selectedEnergyIndex, setSelectedEnergyIndex, property, connectedParts, isMobile }) => {
  const filteredConnectedParts = connectedParts.filter(part =>
    part.sifra_ko !== representativeProperty?.sifra_ko ||
    part.stevilka_stavbe !== representativeProperty?.stevilka_stavbe ||
    part.stevilka_dela_stavbe !== representativeProperty?.stevilka_dela_stavbe ||
    part.dejanska_raba !== representativeProperty?.dejanska_raba
  );

  return (
    <div className="space-y-4">
      <div className={isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
        <DimensionsSection property={representativeProperty} />
        <PropertyTypeSection property={representativeProperty} dataSource={dataSource} />
        <RoomsDescriptionSection property={representativeProperty} />
        <BuildingDataSection property={representativeProperty} />
        <FinancialDataSection property={representativeProperty} />
      </div>

      <EnergetskaIzkaznica
        energetske_izkaznice={property?.energetske_izkaznice}
        selectedEnergyIndex={selectedEnergyIndex}
        setSelectedEnergyIndex={setSelectedEnergyIndex}
      />

      <NotesSection property={representativeProperty} />

      {filteredConnectedParts.length > 0 && (
        <AdditionalPartsSection parts={filteredConnectedParts} representativeProperty={representativeProperty} dataSource={dataSource} />
      )}

      <SimilarPropertiesSection />
    </div>
  );
};

const AdditionalPartsSection = ({ parts, representativeProperty, dataSource }) => (
  <PropertySection title={`Dodatni deli stavb vključeni v posel (${parts.length})`}>
    {Object.entries(
      parts.reduce((groups, part) => {
        const key = `${part.sifra_ko}-${part.stevilka_stavbe}`;
        if (!groups[key]) {
          groups[key] = {
            sifra_ko: part.sifra_ko,
            stevilka_stavbe: part.stevilka_stavbe,
            parts: []
          };
        }
        groups[key].parts.push(part);
        return groups;
      }, {})
    ).map(([groupKey, group]) => (
      <BuildingGroup
        key={groupKey}
        group={group}
        representativeProperty={representativeProperty}
        dataSource={dataSource}
      />
    ))}
  </PropertySection>
);

const BuildingGroup = ({ group, representativeProperty, dataSource }) => (
  <div className="mb-4 last:mb-0">
    <div className="bg-gray-100 border border-gray-300 rounded-t-lg px-3 py-2">
      <h5 className="text-sm font-semibold text-gray-700">
        Stavba {group.stevilka_stavbe}
        {group.sifra_ko !== representativeProperty?.sifra_ko && (
          <span> (KO: {group.sifra_ko})</span>
        )}
      </h5>
    </div>
    <div className="border border-t-0 border-gray-300 rounded-b-lg p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {group.parts.map((part) => (
          <BuildingPart key={part.del_stavbe_id} part={part} dataSource={dataSource} />
        ))}
      </div>
    </div>
  </div>
);

const BuildingPart = ({ part, dataSource }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
    <div className="font-medium text-gray-900 text-sm mb-2 border-b border-gray-200 pb-1">
      Del stavbe {part.stevilka_dela_stavbe}
    </div>
    <div className="space-y-1 text-xs">
      <DetailRow label="Površina" value={part.povrsina_uradna ? `${part.povrsina_uradna} m²` : null} />
      <DetailRow label="Uporabna pov." value={part.povrsina_uporabna ? `${part.povrsina_uporabna} m²` : null} />
      <DetailRow label="Vrsta" value={getVrstaDelaStavbe(part.vrsta_nepremicnine)} />
      {dataSource === 'np' && (
        <DetailRow label="Opremljenost" value={getDaBoljNe(part.opremljenost)} />
      )}
      <DetailRow label="Prodani delež" value={part.prodani_delez} />
      {part.pogodbena_cena && (
        <DetailRow label="Pogodbena cena" value={`€${formatPrice(part.pogodbena_cena)}`} />
      )}
    </div>

    {part.dejanska_raba && (
      <div className="mt-2 pt-2 border-t border-gray-300">
        <div className="text-xs text-gray-500 mb-1">Dejanska raba:</div>
        <div className="text-xs text-gray-800">{part.dejanska_raba}</div>
      </div>
    )}

    {part.prostori && part.prostori !== '-' && (
      <div className="mt-2 pt-2 border-t border-gray-300">
        <div className="text-xs text-gray-500 mb-1">Opis prostorov:</div>
        <div className="text-xs text-gray-800">{part.prostori}</div>
      </div>
    )}
  </div>
);

const SimilarPropertiesSection = () => (
  <PropertySection title="Podobne nepremičnine">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="space-y-2">
            <div className="font-medium text-gray-800 text-sm">Naslov: trg ob reki {i}</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="text-gray-800">130 m²</div>
              <div className="text-gray-800">€133.000</div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="text-gray-800">Razdalja: 2 km</div>
              <div className="text-gray-800">Energijski razred: B</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </PropertySection>
);