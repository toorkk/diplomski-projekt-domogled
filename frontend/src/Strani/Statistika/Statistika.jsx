import { useState, useEffect, useCallback } from "react";
import PropTypes from 'prop-types';
import StatisticsZemljevid from "./StatisticsZemljevid.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { API_CONFIG } from '../Zemljevid/MapConstants.jsx';


// ========================================
// POMOŽNE KOMPONENTE (Izvoz kompleksnosti)
// ========================================

// Univerzalna tooltip komponenta
const UniversalTooltip = ({ active, payload, label, formatter, suffix = '' }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
            <p className="font-semibold">Leto: {label}</p>
            {payload.map((entry, index) => {
                if (entry.value == null) return null;
                const value = formatter ? formatter(entry.value) : entry.value;
                return (
                    <p key={index} style={{ color: entry.color }}>
                        {entry.name}: {value}{suffix}
                    </p>
                );
            })}
        </div>
    );
};

UniversalTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.arrayOf(PropTypes.shape({
        value: PropTypes.number,
        color: PropTypes.string,
        name: PropTypes.string
    })),
    label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    formatter: PropTypes.func,
    suffix: PropTypes.string
};

// Komponenta za preklop tipa grafika
const ChartTypeSwitcher = ({ chartType, setChartType, chartTypeKey, activeTab }) => (
    <div className="flex space-x-2">
        {['stanovanje', 'hisa'].map(type => (
            <button
                key={type}
                onClick={() => setChartType(prev => ({ ...prev, [chartTypeKey]: type }))}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType[chartTypeKey] === type
                        ? (type === 'stanovanje'
                            ? (activeTab === 'prodaja' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-emerald-100 text-emerald-700 border border-emerald-300')
                            : (activeTab === 'prodaja' ? 'bg-blue-200 text-blue-800 border border-blue-400' : 'bg-emerald-200 text-emerald-800 border border-emerald-400'))
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
            >
                {type === 'stanovanje' ? 'Stanovanje' : 'Hiša'}
            </button>
        ))}
    </div>
);

ChartTypeSwitcher.propTypes = {
    chartType: PropTypes.object.isRequired,
    setChartType: PropTypes.func.isRequired,
    chartTypeKey: PropTypes.string.isRequired,
    activeTab: PropTypes.string.isRequired
};

// NOVA MINIMAL PROPERTY GRID KOMPONENTA
const PropertyGrid = ({ data, activeTab, propertyType }) => {
    if (!data) return null;

    const getValue = (source, key) => data[source]?.[key];
    const isApartment = propertyType === 'stanovanje';
    
    return (
        <div className="bg-white border border-gray-200 hover:border-gray-300 transition-colors rounded-lg">
            {/* Minimal Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className={`
                        w-10 h-10 flex items-center justify-center
                        ${activeTab === 'prodaja' 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-emerald-100 text-emerald-600'
                        }
                    `}>
                        {isApartment ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        )}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">
                        {propertyType === 'stanovanje' ? 'Stanovanje' : 'Hiša'}
                    </h4>
                </div>
            </div>

            {/* Stats in clean grid */}
            <div className="p-4">
                <div className="space-y-4">
                    {/* Price section */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                Cena na m²
                            </div>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                                {getValue('cene', 'povprecna_cena_m2') 
                                    ? `€${Math.round(getValue('cene', 'povprecna_cena_m2'))}`
                                    : 'N/A'
                                }
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                Skupna cena
                            </div>
                            <div className="text-xl font-bold text-gray-900 mt-1">
                                {getValue('cene', 'povprecna_skupna_cena') 
                                    ? `€${Math.round(getValue('cene', 'povprecna_skupna_cena')).toLocaleString()}`
                                    : 'N/A'
                                }
                            </div>
                        </div>
                    </div>
                    
                    {/* Other stats */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                Velikost
                            </div>
                            <div className="text-lg font-semibold text-gray-800 mt-1">
                                {getValue('lastnosti', 'povprecna_velikost_m2') 
                                    ? `${Math.round(getValue('lastnosti', 'povprecna_velikost_m2'))} m²`
                                    : 'N/A'
                                }
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                {activeTab === 'najem' ? 'Oddano' : 'Prodano'}
                            </div>
                            <div className="text-lg font-semibold text-gray-800 mt-1">
                                {getValue('aktivnost', activeTab === 'najem' ? 'aktivna_v_letu' : 'stevilo_poslov') || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                Starost
                            </div>
                            <div className="text-lg font-semibold text-gray-800 mt-1">
                                {getValue('lastnosti', 'povprecna_starost_stavbe')
                                    ? `${Math.round(getValue('lastnosti', 'povprecna_starost_stavbe'))} let`
                                    : 'N/A'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

PropertyGrid.propTypes = {
    data: PropTypes.object,
    activeTab: PropTypes.oneOf(['prodaja', 'najem']).isRequired,
    propertyType: PropTypes.oneOf(['stanovanje', 'hisa']).isRequired
};

// Ovojnica za grafe
const ChartWrapper = ({ title, children, showSwitcher = false, chartType, setChartType, chartTypeKey, activeTab }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-800">{title}</h4>
            {showSwitcher && (
                <ChartTypeSwitcher
                    chartType={chartType}
                    setChartType={setChartType}
                    chartTypeKey={chartTypeKey}
                    activeTab={activeTab}
                />
            )}
        </div>
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                {children}
            </ResponsiveContainer>
        </div>
    </div>
);

ChartWrapper.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    showSwitcher: PropTypes.bool,
    chartType: PropTypes.object,
    setChartType: PropTypes.func,
    chartTypeKey: PropTypes.string,
    activeTab: PropTypes.string
};

// ========================================
// POMOŽNE FUNKCIJE (Poenostavitev logike)
// ========================================

const formatters = {
    currency: (value) => `€${Math.round(value)}`,
    currencyLarge: (value) => `€${Math.round(value).toLocaleString()}`,
    area: (value) => `${Math.round(value)} m²`,
    age: (value) => `${Math.round(value)} let`
};

const prepareUniversalChartData = (statisticsData, activeTab, chartType, dataType, valueKeys) => {
    const typeData = statisticsData?.[activeTab]?.[chartType]?.letno || [];
    return typeData.map(d => ({
        leto: d.leto,
        povprecna: d[dataType]?.[valueKeys.povprecna] || null,
    })).sort((a, b) => a.leto - b.leto);
};

const prepareActivityChartData = (statisticsData, activeTab) => {
    const mergeData = (stanovanja, hise) => {
        const dataMap = new Map();
        const field = activeTab === 'najem' ? 'aktivna_v_letu' : 'stevilo_poslov';

        [...stanovanja, ...hise].forEach(d => {
            if (!dataMap.has(d.leto)) {
                dataMap.set(d.leto, { leto: d.leto, stanovanja: 0, hise: 0 });
            }
            const type = stanovanja.includes(d) ? 'stanovanja' : 'hise';
            dataMap.get(d.leto)[type] = d.aktivnost?.[field] || 0;
        });

        return Array.from(dataMap.values()).sort((a, b) => a.leto - b.leto);
    };

    const stanovanja = statisticsData?.[activeTab]?.stanovanje?.letno || [];
    const hise = statisticsData?.[activeTab]?.hisa?.letno || [];
    return mergeData(stanovanja, hise);
};

// ========================================
// GLAVNA KOMPONENTA (Drastično poenostavljeno)
// ========================================

export default function Statistika({ selectedRegionFromNavigation }) {
    // Združeno stanje
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [activeTab, setActiveTab] = useState('prodaja');
    const [chartType, setChartType] = useState({
        price: 'stanovanje',
        totalPrice: 'stanovanje',
        size: 'stanovanje',
        age: 'stanovanje'
    });
    const [apiState, setApiState] = useState({
        data: null,
        loading: false,
        error: null
    });

    // API funkcija
    const fetchStatistics = useCallback(async (regionName, regionType) => {
        setApiState({ data: null, loading: true, error: null });

        try {
            const response = await fetch(
                `${API_CONFIG.BASE_URL}/api/statistike/vse/${regionType}/${encodeURIComponent(regionName.toUpperCase())}`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setApiState({
                data: data.status === 'success' ? data.statistike : null,
                loading: false,
                error: data.status !== 'success' ? (data.message || 'Napaka') : null
            });
        } catch (err) {
            setApiState({ data: null, loading: false, error: err.message });
        }
    }, []);

    // Funkcija za nalaganje statistik Slovenije
    const fetchSloveniaStatistics = useCallback(() => {
        fetchStatistics('SLOVENIJA', 'slovenija');
    }, [fetchStatistics]);

    // Funkcije za izbiro katastrov
    const handleMunicipalitySelect = useCallback((municipalityData) => {
        setSelectedMunicipality(municipalityData);

        // NE resetiraj selectedObcina če je preserveObcina = true
        if (!municipalityData?.preserveObcina) {
            setSelectedObcina(null);
        }

        if (municipalityData) {
            let name = municipalityData.name;
            if (name.includes('(') && name.includes(')')) {
                name = name.split('(')[0].trim();
            }
            fetchStatistics(name, 'katastrska_obcina');
        } else {
            // Če ni izbrane občine, naloži statistike za Slovenijo
            fetchSloveniaStatistics();
        }
    }, [fetchStatistics, fetchSloveniaStatistics]);

    const handleObcinaSelect = useCallback((obcinaData) => {
        setSelectedObcina(obcinaData);
        setSelectedMunicipality(null);

        if (obcinaData) {
            fetchStatistics(obcinaData.name, 'obcina');
        } else {
            // Če ni izbrane občine, naloži statistike za Slovenijo
            fetchSloveniaStatistics();
        }
    }, [fetchStatistics, fetchSloveniaStatistics]);

    // Samodejno nalaganje iz navigacije
    useEffect(() => {
        if (!selectedRegionFromNavigation) {
            // Če ni podane regije iz navigacije, naloži statistike za Slovenijo
            fetchSloveniaStatistics();
            return;
        }

        const { type, name, sifko, obcinaId } = selectedRegionFromNavigation;

        if (type === 'katastrska_obcina') {
            setSelectedMunicipality({ name: `${name} (${sifko})`, sifko });
            setSelectedObcina(null);
            fetchStatistics(name, 'katastrska_obcina');
        } else if (type === 'obcina') {
            setSelectedObcina({ name, obcinaId });
            setSelectedMunicipality(null);
            fetchStatistics(name, 'obcina');
        }
    }, [selectedRegionFromNavigation, fetchStatistics, fetchSloveniaStatistics]);

    // Naloži statistike za Slovenijo ob prvem nalaganju, če ni nobene regije izbrane
    useEffect(() => {
        if (!selectedMunicipality && !selectedObcina && !selectedRegionFromNavigation) {
            fetchSloveniaStatistics();
        }
    }, [selectedMunicipality, selectedObcina, selectedRegionFromNavigation, fetchSloveniaStatistics]);

    // Priprava podatkov za grafikone
    const chartData = {
        price: prepareUniversalChartData(apiState.data, activeTab, chartType.price, 'cene', {
            povprecna: 'povprecna_cena_m2'
        }),
        totalPrice: prepareUniversalChartData(apiState.data, activeTab, chartType.totalPrice, 'cene', {
            povprecna: 'povprecna_skupna_cena'
        }),
        size: prepareUniversalChartData(apiState.data, activeTab, chartType.size, 'lastnosti', {
            povprecna: 'povprecna_velikost_m2'
        }),
        age: prepareUniversalChartData(apiState.data, activeTab, chartType.age, 'lastnosti', {
            povprecna: 'povprecna_starost_stavbe'
        }),
        activity: prepareActivityChartData(apiState.data, activeTab)
    };

    const hasData = chartData.price.length > 0 || chartData.activity.length > 0;
    const selectedRegion = selectedMunicipality || selectedObcina;

    // Določi naslov glede na izbrano regijo
    const getRegionTitle = () => {
        if (selectedRegion) {
            return selectedRegion.name;
        }
        return 'Slovenija';
    };

    const getRegionType = () => {
        if (selectedMunicipality) return 'Kataster';
        if (selectedObcina) return 'Občina';
        return 'Država';
    };

    return (
        <div className="min-h-screen bg-gray-100 lg:pt-16 lg:pb-8 lg:px-16">
            <div className="max-w-none">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Sekcija zemljevida */}
                    <div className="h-[450px] lg:h-[600px]">
                        <StatisticsZemljevid
                            onMunicipalitySelect={handleMunicipalitySelect}
                            onObcinaSelect={handleObcinaSelect}
                            selectedMunicipality={selectedMunicipality}
                            selectedObcina={selectedObcina}
                            selectedRegionFromNavigation={selectedRegionFromNavigation}
                            activeTab={activeTab}
                        />
                    </div>

                    {/* Sekcija statistik */}
                    <div className="min-h-[400px]">
                        {/* Preklopnik zavihkov */}
                        <div className="flex justify-center py-4 border-b border-gray-100">
                            <div className="flex space-x-8">
                                {['prodaja', 'najem'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === tab
                                                ? 'text-black border-b-2 border-black'
                                                : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'
                                            }`}
                                    >
                                        {tab === 'prodaja' ? 'Prodaja' : 'Najem'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Vsebina */}
                        <div className="h-full">
                            {/* Glava */}
                            <div className="bg-white text-black p-4 border-b border-gray-200 text-center">
                                <h2 className="text-xl font-bold">Statistični podatki za {getRegionTitle()}</h2>
                                <p className="text-gray-600 text-sm">
                                    {getRegionType()} - Podatki za {activeTab === 'najem' ? 'najem' : 'prodajo'}
                                    {!selectedRegion && (
                                        <span className="ml-2 text-blue-600">(Klikni na zemljevid za podrobnosti o občini ali katastru)</span>
                                    )}
                                </p>
                            </div>

                            <div className="pt-10 px-6 pb-6">
                                {apiState.loading ? (
                                    <div className="text-center py-8">
                                        <div className="text-lg text-gray-600">Nalagam statistike...</div>
                                    </div>
                                ) : apiState.error ? (
                                    <div className="text-center py-8">
                                        <div className="text-lg text-red-600 mb-2">Napaka pri nalaganju statistik</div>
                                        <div className="text-sm text-gray-500">{apiState.error}</div>
                                    </div>
                                ) : apiState.data ? (
                                    <div className="space-y-10">

                                        {/* Mreže nepremičnin z MINIMAL DESIGN */}
                                        <div className="flex justify-center">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full">
                                                {apiState.data[activeTab]?.stanovanje?.zadnjih12m && (
                                                    <PropertyGrid
                                                        data={apiState.data[activeTab].stanovanje.zadnjih12m}
                                                        activeTab={activeTab}
                                                        propertyType="stanovanje"
                                                    />
                                                )}

                                                {apiState.data[activeTab]?.hisa?.zadnjih12m && (
                                                    <PropertyGrid
                                                        data={apiState.data[activeTab].hisa.zadnjih12m}
                                                        activeTab={activeTab}
                                                        propertyType="hisa"
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Prikaži sporočilo če ni podatkov */}
                                        {!apiState.data[activeTab]?.stanovanje?.zadnjih12m && !apiState.data[activeTab]?.hisa?.zadnjih12m && (
                                            <div className="text-center py-8 text-gray-500">
                                                Ni podatkov za {activeTab} v tej regiji
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        Ni podatkov za {activeTab} v tej regiji
                                    </div>
                                )}
                            </div>

                            {/* NOVA SEKCIJA - Nepremičninski trendi */}
                            {hasData && apiState.data && (
                                <div className="bg-white text-black p-4 border-b border-gray-200 text-center">
                                    <h2 className="text-xl font-bold">Nepremičninski trendi za {getRegionTitle()}</h2>
                                    <p className="text-gray-600 text-sm">
                                        Analiza gibanja cen, starosti in aktivnosti na trgu {activeTab === 'najem' ? 'najema' : 'prodaje'} v obdobju zadnjih let
                                    </p>
                                </div>
                            )}

                            {/* Grafikoni */}
                            {hasData && apiState.data && (
                                <div className="pt-10 px-6 pb-6">
                                    <div className="space-y-10">
                                        {/* Prvi red grafov - centiriran */}
                                        <div className="flex justify-center">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full">
                                                {/* Grafikon cene na m² */}
                                                {chartData.price.length > 0 && (
                                                    <ChartWrapper
                                                        title="Povprečna cena/m² po letih"
                                                        showSwitcher={true}
                                                        chartType={chartType}
                                                        setChartType={setChartType}
                                                        chartTypeKey="price"
                                                        activeTab={activeTab}
                                                    >
                                                        <LineChart data={chartData.price}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                            <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                            <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `€${value}`} />
                                                            <Tooltip content={<UniversalTooltip formatter={formatters.currency} />} />
                                                            <Legend />
                                                            <Line type="monotone" dataKey="povprecna" stroke={
                                                                chartType.price === 'stanovanje'
                                                                    ? (activeTab === 'prodaja' ? 'rgba(147, 197, 253, 0.8)' : 'rgba(110, 231, 183, 0.8)')
                                                                    : (activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)')
                                                            } strokeWidth={3} name="Povprečna vrednost" />
                                                        </LineChart>
                                                    </ChartWrapper>
                                                )}

                                                {/* Grafikon celotne cene */}
                                                {chartData.totalPrice.length > 0 && (
                                                    <ChartWrapper
                                                        title="Povprečna celotna cena po letih"
                                                        showSwitcher={true}
                                                        chartType={chartType}
                                                        setChartType={setChartType}
                                                        chartTypeKey="totalPrice"
                                                        activeTab={activeTab}
                                                    >
                                                        <LineChart data={chartData.totalPrice}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                            <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                            <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                                                            <Tooltip content={<UniversalTooltip formatter={formatters.currencyLarge} />} />
                                                            <Legend />
                                                            <Line type="monotone" dataKey="povprecna" stroke={
                                                                chartType.totalPrice === 'stanovanje'
                                                                    ? (activeTab === 'prodaja' ? 'rgba(147, 197, 253, 0.8)' : 'rgba(110, 231, 183, 0.8)')
                                                                    : (activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)')
                                                            } strokeWidth={3} name="Povprečna vrednost" />
                                                        </LineChart>
                                                    </ChartWrapper>
                                                )}
                                            </div>
                                        </div>

                                        {/* Drugi red grafov - centiriran */}
                                        <div className="flex justify-center">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full">
                                                {/* Grafikon aktivnosti */}
                                                {chartData.activity.length > 0 && (
                                                    <ChartWrapper title={`Število ${activeTab === 'najem' ? 'najemov' : 'prodaj'} po letih`}>
                                                        <LineChart data={chartData.activity}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                            <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                            <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                                                            <Tooltip content={<UniversalTooltip />} />
                                                            <Legend />
                                                            <Line type="monotone" dataKey="stanovanja" stroke={activeTab === 'prodaja' ? 'rgba(147, 197, 253, 0.8)' : 'rgba(110, 231, 183, 0.8)'} strokeWidth={3} name="Stanovanja" />
                                                            <Line type="monotone" dataKey="hise" stroke={activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)'} strokeWidth={3} name="Hiše" />
                                                        </LineChart>
                                                    </ChartWrapper>
                                                )}

                                                {/* Grafikon velikosti */}
                                                {chartData.size.length > 0 && (
                                                    <ChartWrapper
                                                        title="Povprečna velikost po letih"
                                                        showSwitcher={true}
                                                        chartType={chartType}
                                                        setChartType={setChartType}
                                                        chartTypeKey="size"
                                                        activeTab={activeTab}
                                                    >
                                                        <LineChart data={chartData.size}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                            <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                            <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} m²`} />
                                                            <Tooltip content={<UniversalTooltip formatter={formatters.area} />} />
                                                            <Legend />
                                                            <Line type="monotone" dataKey="povprecna" stroke={
                                                                chartType.size === 'stanovanje'
                                                                    ? (activeTab === 'prodaja' ? 'rgba(147, 197, 253, 0.8)' : 'rgba(110, 231, 183, 0.8)')
                                                                    : (activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)')
                                                            } strokeWidth={3} name="Povprečna vrednost" />
                                                        </LineChart>
                                                    </ChartWrapper>
                                                )}
                                            </div>
                                        </div>

                                        {/* Tretji red grafov - graf starosti */}
                                        <div className="flex justify-center">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full">
                                                {/* Grafikon starosti nepremičnin */}
                                                {chartData.age.length > 0 && (
                                                    <ChartWrapper
                                                        title="Povprečna starost nepremičnin po letih"
                                                        showSwitcher={true}
                                                        chartType={chartType}
                                                        setChartType={setChartType}
                                                        chartTypeKey="age"
                                                        activeTab={activeTab}
                                                    >
                                                        <LineChart data={chartData.age}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                            <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                            <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} let`} />
                                                            <Tooltip content={<UniversalTooltip formatter={formatters.age} />} />
                                                            <Legend />
                                                            <Line type="monotone" dataKey="povprecna" stroke={
                                                                chartType.age === 'stanovanje'
                                                                    ? (activeTab === 'prodaja' ? 'rgba(147, 197, 253, 0.8)' : 'rgba(110, 231, 183, 0.8)')
                                                                    : (activeTab === 'prodaja' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(5, 150, 105, 0.8)')
                                                            } strokeWidth={3} name="Povprečna vrednost" />
                                                        </LineChart>
                                                    </ChartWrapper>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// PropTypes za glavno komponento
Statistika.propTypes = {
    selectedRegionFromNavigation: PropTypes.shape({
        type: PropTypes.string,
        name: PropTypes.string,
        sifko: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        obcinaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    })
};