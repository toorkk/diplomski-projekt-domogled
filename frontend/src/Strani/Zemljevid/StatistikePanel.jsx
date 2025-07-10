import { useState } from 'react';
import { formatStatistics } from './MapUtils.jsx';
import { useIsMobile } from '../../hooks/useIsMobile.jsx';

// Barve za komponente
const COLOR_CONFIG = {
    prodaja: {
        hise: {
            borderColor: 'border-blue-300',
            headerBg: 'rgba(37, 99, 235, 0.8)',
            contentBg: 'rgba(37, 99, 235, 0.1)',
        },
        stanovanja: {
            borderColor: 'border-blue-200',
            headerBg: 'rgba(147, 197, 253, 1)',
            contentBg: 'rgba(147, 197, 253, 0.1)',
        }
    },
    najem: {
        hise: {
            borderColor: 'border-green-300',
            headerBg: 'rgba(5, 150, 105, 0.8)',
            contentBg: 'rgba(5, 150, 105, 0.1)',
        },
        stanovanja: {
            borderColor: 'border-green-200',
            headerBg: 'rgba(110, 231, 183, 1)',
            contentBg: 'rgba(110, 231, 183, 0.1)',
        }
    }
};

const PROPERTY_CONFIG = {
    stanovanja: {
        title: 'Stanovanja',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    },
    hise: {
        title: 'Hiše',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    }
};

// Pomožne funkcije
const getRegionInfo = (selectedObcina) => {
    return { name: selectedObcina.name, type: 'Občina' };
};

const getStatistics = (obcinaStatistics, dataSourceType) => {
    return formatStatistics(obcinaStatistics, dataSourceType);
};

const isTransactionTypeRental = (tipPosla) => {
    return tipPosla === 'najem' || tipPosla === 'najemnina';
};

const getColors = (propertyType, tipPosla) => {
    const transactionType = isTransactionTypeRental(tipPosla) ? 'najem' : 'prodaja';
    return COLOR_CONFIG[transactionType][propertyType];
};

// Komponenta za loading stanje
const LoadingIndicator = ({ isDesktop, text = "Nalagam statistike..." }) => (
    <div className="flex items-center justify-center py-4">
        <div className="flex items-center space-x-2 text-gray-500">
            <div className={`animate-spin rounded-full border-b-2 border-blue-500 ${isDesktop ? 'h-4 w-4' : 'h-5 w-5'}`}></div>
            <span className="text-sm">{text}</span>
        </div>
    </div>
);

// Komponenta za prazno stanje
const EmptyState = ({ isDesktop }) => (
    <div className={`text-center ${isDesktop ? 'py-2' : 'py-6'}`}>
        <div className="text-gray-400">
            <svg className={`mx-auto mb-${isDesktop ? '1' : '2'} ${isDesktop ? 'w-5 h-5' : 'w-8 h-8'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-sm">Ni podatkov za zadnjih 12 mesecev</div>
        </div>
    </div>
);

// Komponenta za header 
const PanelHeader = ({ regionName, regionType, onClose, showCloseAndMinimize = false, onMinimize }) => (
    <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                <h3 className="text-sm font-semibold text-gray-800 truncate">
                    {`${regionType}: ${regionName}`}
                </h3>
            </div>
            <div className="flex items-center space-x-2">
                {showCloseAndMinimize && (
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1"
                        title="Zapri in resetiraj"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
                <button
                    onClick={showCloseAndMinimize ? onMinimize : onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1 hover:bg-white rounded-full"
                    title={showCloseAndMinimize ? "Minimiziraj" : "Zapri"}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d={showCloseAndMinimize ? "M19 9l-7 7-7-7" : "M6 18L18 6M6 6l12 12"} />
                    </svg>
                </button>
            </div>
        </div>
    </div>
);

// Komponenta za mobile trigger button
const MobileTriggerButton = ({ regionName, regionType, statisticsLoading, onClick }) => (
    <button
        onClick={onClick}
        className="fixed bottom-4 z-10 left-1/2 transform -translate-x-1/2 bg-white shadow-lg border border-gray-200 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ borderRadius: '25px', width: '55vw' }}
        title="Prikaži statistike"
        aria-label={`Prikaži statistike za ${regionType}: ${regionName}`}
    >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-medium">{regionType}</div>
                <div className="text-sm font-semibold text-gray-800 truncate">{regionName}</div>
            </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
            {statisticsLoading ? (
                <LoadingIndicator isDesktop={true} text="" />
            ) : (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
            )}
        </div>
    </button>
);

// Desktop komponenta
const DesktopPanel = ({ regionName, regionType, stats, statisticsLoading, onGoToStatistics, hasActiveFilters, activeFilters, dataSourceType, activeTab, onClose }) => (
    <div className="absolute bottom-4 right-2 z-20 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-[350px]">
        <PanelHeader regionName={regionName} regionType={regionType} onClose={onClose} />
        <div className="p-4">
            <StatistikeContent
                stats={stats}
                statisticsLoading={statisticsLoading}
                onGoToStatistics={onGoToStatistics}
                hasActiveFilters={hasActiveFilters}
                activeFilters={activeFilters}
                dataSourceType={dataSourceType}
                isDesktop={true}
                activeTab={activeTab}
            />
        </div>
    </div>
);

// Mobile komponenta
const MobilePanel = ({ regionName, regionType, stats, statisticsLoading, onGoToStatistics, hasActiveFilters, activeFilters, dataSourceType, activeTab, onClose, isOpen, setIsOpen }) => (
    <>
        <MobileTriggerButton
            regionName={regionName}
            regionType={regionType}
            statisticsLoading={statisticsLoading}
            onClick={() => setIsOpen(true)}
        />
        {isOpen && (
            <div className="fixed bottom-0 left-0 right-0 z-50">
                <div className="bg-white rounded-t-xl shadow-lg border-t border-gray-200 transition-all duration-300 ease-out flex flex-col animate-slide-up"
                     style={{ height: 'auto', maxHeight: '70vh' }}>
                    <PanelHeader 
                        regionName={regionName} 
                        regionType={regionType} 
                        onClose={onClose}
                        onMinimize={() => setIsOpen(false)}
                        showCloseAndMinimize={true}
                    />
                    <div className="p-4">
                        <StatistikeContent
                            stats={stats}
                            statisticsLoading={statisticsLoading}
                            onGoToStatistics={onGoToStatistics}
                            hasActiveFilters={hasActiveFilters}
                            activeFilters={activeFilters}
                            dataSourceType={dataSourceType}
                            isDesktop={false}
                            activeTab={activeTab}
                        />
                    </div>
                </div>
            </div>
        )}
    </>
);

// Glavna komponenta
export default function StatistikePanel({
    selectedObcina,
    obcinaStatistics,
    statisticsLoading,
    dataSourceType,
    activeFilters,
    onGoToStatistics,
    onClose,
    activeTab = 'prodaja'
}) {
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();

    if (!selectedObcina) {
        return null;
    }

    const hasActiveFilters = Object.keys(activeFilters).length > 0;
    const regionInfo = getRegionInfo(selectedObcina);
    const stats = getStatistics(obcinaStatistics, dataSourceType);

    const commonProps = {
        regionName: regionInfo.name,
        regionType: regionInfo.type,
        stats,
        statisticsLoading,
        onGoToStatistics,
        hasActiveFilters,
        activeFilters,
        dataSourceType,
        activeTab,
        onClose
    };

    return isMobile ? (
        <MobilePanel {...commonProps} isOpen={isOpen} setIsOpen={setIsOpen} />
    ) : (
        <DesktopPanel {...commonProps} />
    );
}

// Komponenta za prikaz statistik 
function StatistikeContent({ stats, statisticsLoading, onGoToStatistics, hasActiveFilters, activeFilters, dataSourceType, isDesktop, activeTab = 'prodaja' }) {
    if (statisticsLoading) {
        return <LoadingIndicator isDesktop={isDesktop} />;
    }

    const hasData = stats && stats.hasData;

    return (
        <div className="space-y-4">
            {!hasData && <EmptyState isDesktop={isDesktop} />}
            
            {hasData && (
                <>
                    <div className="text-sm text-gray-700 bg-gray-50 px-2 py-2 rounded-md text-center">
                        Podatki za zadnjih 12 mesecev
                    </div>
                    <div className={isDesktop ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                        <PropertyTypeBoks
                            type="stanovanja"
                            data={stats.stanovanja}
                            tipPosla={stats.tipPosla}
                            isDesktop={isDesktop}
                            activeTab={activeTab}
                        />
                        <PropertyTypeBoks
                            type="hise"
                            data={stats.hise}
                            tipPosla={stats.tipPosla}
                            isDesktop={isDesktop}
                            activeTab={activeTab}
                        />
                    </div>
                </>
            )}

            <button
                onClick={onGoToStatistics}
                className={`w-full bg-gray-50 hover:bg-gray-${isDesktop ? '200' : '100'} text-black px-3 py-2 rounded-${isDesktop ? 'md' : 'lg'} text-${isDesktop ? 'xs' : 'sm'} font-medium transition-colors flex items-center justify-center space-x-${isDesktop ? '1' : '2'} border border-gray-${isDesktop ? '300' : '200'}`}
                title="Prikaži podrobne statistike"
            >
                <svg className={`${isDesktop ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Podrobne statistike</span>
            </button>
        </div>
    );
}

// Komponente za prikaz podatkov
const DesktopPropertyData = ({ data, tipPosla, colors }) => (
    <>
        <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
                <div className="text-gray-500">{tipPosla === 'prodaja' ? 'Prodaj' : 'Najemov'}</div>
                <div className="font-semibold">{data.stevilo_poslov}</div>
            </div>
            <div>
                <div className="text-gray-500">Velikost</div>
                <div className="font-semibold">
                    {data.povprecna_velikost_m2 ? `${Math.round(data.povprecna_velikost_m2)} m²` : 'N/A'}
                </div>
            </div>
        </div>
        {data.povprecna_cena_m2 && (
            <div className="rounded p-2 text-xs mt-2" style={{ backgroundColor: colors.contentBg }}>
                <div className="text-gray-600">Cena na m²</div>
                <div className="font-bold text-black">
                    {Math.round(data.povprecna_cena_m2).toLocaleString('sl-SI')} € / m²
                </div>
            </div>
        )}
        {data.povprecna_skupna_cena && (
            <div className="rounded p-2 text-xs mt-2" style={{ backgroundColor: colors.contentBg }}>
                <div className="text-gray-600">
                    {tipPosla === 'prodaja' ? 'Povp. cena' : 'Povp. najemnina'}
                </div>
                <div className="font-bold text-black">
                    {Math.round(data.povprecna_skupna_cena).toLocaleString('sl-SI')} €{tipPosla === 'najem' ? ' / mes' : ''}
                </div>
            </div>
        )}
    </>
);

const MobilePropertyData = ({ data, tipPosla }) => (
    <div className="grid grid-cols-4 gap-2 text-center">
        <div>
            <div className="text-xs text-gray-500">{tipPosla === 'prodaja' ? 'Prodaj' : 'Najemov'}</div>
            <div className="font-bold text-lg">{data.stevilo_poslov}</div>
        </div>
        <div>
            <div className="text-xs text-gray-500">Velikost</div>
            <div className="font-bold text-lg">
                {data.povprecna_velikost_m2 ? `${Math.round(data.povprecna_velikost_m2)}` : 'N/A'}
            </div>
            <div className="text-xs text-gray-400">m²</div>
        </div>
        <div>
            <div className="text-xs text-gray-500">Cena / m²</div>
            <div className="font-bold text-lg">
                {data.povprecna_cena_m2 ? Math.round(data.povprecna_cena_m2).toLocaleString('sl-SI') : 'N/A'}
            </div>
            <div className="text-xs text-gray-400"> €{tipPosla === 'najem' ? ' / mes' : ''}</div>
        </div>
        <div>
            <div className="text-xs text-gray-500">{tipPosla === 'prodaja' ? 'Cena' : 'Najem'}</div>
            <div className="font-bold text-lg">
                {data.povprecna_skupna_cena ? Math.round(data.povprecna_skupna_cena).toLocaleString('sl-SI') : 'N/A'}
            </div>
            <div className="text-xs text-gray-400"> €{tipPosla === 'najem' ? ' / mes' : ''}</div>
        </div>
    </div>
);

const PropertyEmptyState = ({ isDesktop }) => (
    <div className={`text-center ${isDesktop ? 'py-4' : 'py-3'}`}>
        <div className="text-gray-400 text-xs">
            <svg className={`mx-auto mb-1 opacity-50 ${isDesktop ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ni podatkov
        </div>
    </div>
);

function PropertyTypeBoks({ type, data, tipPosla, isDesktop, activeTab }) {
    const { title, icon } = PROPERTY_CONFIG[type];
    const colors = getColors(type, tipPosla);
    const hasData = data && (data.stevilo_poslov > 0 || data.aktivna_v_letu > 0);

    return (
        <div className={`${colors.borderColor} border rounded-lg overflow-hidden`}>
            <div className="px-3 py-2 flex items-center space-x-2" style={{ backgroundColor: colors.headerBg }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                <h4 className="text-sm font-semibold text-white">{title}</h4>
            </div>
            <div className="p-3">
                {hasData ? (
                    isDesktop ? (
                        <DesktopPropertyData data={data} tipPosla={tipPosla} colors={colors} />
                    ) : (
                        <MobilePropertyData data={data} tipPosla={tipPosla} />
                    )
                ) : (
                    <PropertyEmptyState isDesktop={isDesktop} />
                )}
            </div>
        </div>
    );
}