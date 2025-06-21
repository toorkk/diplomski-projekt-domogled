// StatistikePanel.jsx
import { formatFilterSummary, formatStatistics } from './MapUtils.jsx';

export default function StatistikePanel({
    selectedMunicipality,
    selectedObcina,
    municipalityStatistics,
    obcinaStatistics,
    statisticsLoading,
    dataSourceType,
    activeFilters,
    onGoToStatistics,
    onClose
}) {
    // Če ni nobena regija izbrana, ne prikaži nič
    if (!selectedMunicipality && !selectedObcina) {
        return null;
    }

    const hasActiveFilters = Object.keys(activeFilters).length > 0;

    const stats = selectedMunicipality
        ? formatStatistics(municipalityStatistics, dataSourceType)
        : formatStatistics(obcinaStatistics, dataSourceType);

    return (
        <div className="absolute bottom-4 right-2 z-20 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-[350px]">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <h3 className="text-sm font-semibold text-gray-800 truncate">
                            {selectedMunicipality
                                ? `Kataster: ${selectedMunicipality.name}`
                                : `Občina: ${selectedObcina.name}`
                            }
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1 hover:bg-white rounded-full"
                        title="Zapri"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Statistike */}
            <div className="p-4">
                {statisticsLoading ? (
                    <div className="flex items-center space-x-2 text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span className="text-sm">Nalagam statistike...</span>
                    </div>
                ) : (
                    <>
                        {!stats || !stats.hasData ? (
                            <div className="text-center py-2">
                                <div className="text-gray-400 text-sm">
                                    <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Ni podatkov za zadnjih 12 mesecev
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Obdobje */}
                                <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md text-center">
                                    Zadnjih 12 mesecev
                                </div>

                                {/* STANOVANJA IN HIŠE SIDE BY SIDE */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* STANOVANJA */}
                                    <StanovanjaBoks data={stats.stanovanja} tipPosla={stats.tipPosla} />

                                    {/* HIŠE */}
                                    <HiseBoks data={stats.hise} tipPosla={stats.tipPosla} />
                                </div>

                                {/* GUMB ZA STATISTIKE */}
                                <button
                                    onClick={onGoToStatistics}
                                    className="w-full bg-gray-50 hover:bg-gray-200 text-black px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1 border border-gray-300"
                                    title="Prikaži podrobne statistike"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span>Podrobne statistike</span>
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Filtri */}
                {hasActiveFilters && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                            <div className="flex items-center space-x-1 mb-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                <span className="font-medium">Aktivni filtri:</span>
                            </div>
                            <div className="text-gray-600 text-xs">
                                {formatFilterSummary(activeFilters, dataSourceType)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Pomožni komponenti za stanovanja in hiše
function StanovanjaBoks({ data, tipPosla }) {
    return (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
            <div className="bg-blue-100 px-3 py-2 flex items-center space-x-2">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h4 className="text-sm font-semibold text-black">Stanovanja</h4>
            </div>
            <div className="p-3 space-y-2">
                {data && data.stevilo_poslov > 0 ? (
                    <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <div className="text-gray-500">{tipPosla === 'prodaja' ? 'Prodaj' : 'Najemov'}</div>
                                <div className="font-semibold text-black">{data.stevilo_poslov}</div>
                            </div>
                            <div>
                                <div className="text-gray-500">Velikost</div>
                                <div className="font-semibold text-black">
                                    {data.povprecna_velikost_m2 ? `${Math.round(data.povprecna_velikost_m2)} m²` : 'N/A'}
                                </div>
                            </div>
                        </div>
                        {data.povprecna_cena_m2 && (
                            <div className="bg-blue-50 rounded p-2 text-xs">
                                <div className="text-gray-600">Cena na m²</div>
                                <div className="font-bold text-black">
                                    {Math.round(data.povprecna_cena_m2).toLocaleString('sl-SI')} €/m²
                                </div>
                            </div>
                        )}
                        {data.povprecna_skupna_cena && (
                            <div className="bg-blue-50 rounded p-2 text-xs">
                                <div className="text-gray-600">
                                    {tipPosla === 'prodaja' ? 'Povp. cena' : 'Povp. najemnina'}
                                </div>
                                <div className="font-bold text-black">
                                    {Math.round(data.povprecna_skupna_cena).toLocaleString('sl-SI')} €{tipPosla === 'najem' ? '/mes' : ''}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <NiPodatkov />
                )}
            </div>
        </div>
    );
}

function HiseBoks({ data, tipPosla }) {
    return (
        <div className="border border-green-200 rounded-lg overflow-hidden">
            <div className="bg-green-100 px-3 py-2 flex items-center space-x-2">
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <h4 className="text-sm font-semibold text-black">Hiše</h4>
            </div>
            <div className="p-3 space-y-2">
                {data && data.stevilo_poslov > 0 ? (
                    <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <div className="text-gray-500">{tipPosla === 'prodaja' ? 'Prodaj' : 'Najemov'}</div>
                                <div className="font-semibold text-green-900">{data.stevilo_poslov}</div>
                            </div>
                            <div>
                                <div className="text-gray-500">Velikost</div>
                                <div className="font-semibold text-green-900">
                                    {data.povprecna_velikost_m2 ? `${Math.round(data.povprecna_velikost_m2)} m²` : 'N/A'}
                                </div>
                            </div>
                        </div>
                        {data.povprecna_cena_m2 && (
                            <div className="bg-green-50 rounded p-2 text-xs">
                                <div className="text-gray-600">Cena na m²</div>
                                <div className="font-bold text-black">
                                    {Math.round(data.povprecna_cena_m2).toLocaleString('sl-SI')} €/m²
                                </div>
                            </div>
                        )}
                        {data.povprecna_skupna_cena && (
                            <div className="bg-green-50 rounded p-2 text-xs">
                                <div className="text-gray-600">
                                    {tipPosla === 'prodaja' ? 'Povp. cena' : 'Povp. najemnina'}
                                </div>
                                <div className="font-bold text-black">
                                    {Math.round(data.povprecna_skupna_cena).toLocaleString('sl-SI')} €{tipPosla === 'najem' ? '/mes' : ''}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <NiPodatkov />
                )}
            </div>
        </div>
    );
}

function NiPodatkov() {
    return (
        <div className="text-center py-4">
            <div className="text-gray-400 text-xs">
                <svg className="w-6 h-6 mx-auto mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ni podatkov
            </div>
        </div>
    );
}