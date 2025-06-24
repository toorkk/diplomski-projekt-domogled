import { useState, useEffect, useCallback } from "react";
import PropTypes from 'prop-types';
import StatisticsZemljevid from "./StatisticsZemljevid.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
const ChartTypeSwitcher = ({ chartType, setChartType, chartTypeKey }) => (
    <div className="flex space-x-2">
        {['stanovanje', 'hisa'].map(type => (
            <button
                key={type}
                onClick={() => setChartType(prev => ({ ...prev, [chartTypeKey]: type }))}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    chartType[chartTypeKey] === type
                        ? (type === 'stanovanje' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-green-100 text-green-700 border border-green-300')
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
    chartTypeKey: PropTypes.string.isRequired
};

// Komponenta za statistične kartice
const StatCard = ({ label, value, formatter = 'default' }) => {
    const formatValue = (val) => {
        if (!val) return 'N/A';
        switch (formatter) {
            case 'currency': return `€${Math.round(val)}`;
            case 'currency_large': return `€${Math.round(val).toLocaleString()}`;
            case 'area': return `${Math.round(val)} m²`;
            case 'years': return `${val} let`;
            default: return val;
        }
    };

    return (
        <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="text-xs text-gray-500 mb-2">{label}</div>
            <div className="text-xl font-bold text-gray-800">{formatValue(value)}</div>
        </div>
    );
};

StatCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    formatter: PropTypes.oneOf(['default', 'currency', 'currency_large', 'area', 'years'])
};

// Komponenta za mrežo nepremičnin
const PropertyGrid = ({ data, activeTab, propertyType }) => {
    if (!data) return null;

    const getValue = (source, key) => data[source]?.[key];

    return (
        <div>
            <h4 className="text-lg font-bold text-gray-800 mb-4">
                {propertyType === 'stanovanje' ? 'Stanovanja' : 'Hiše'} - {activeTab}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Cena/m² */}
                <StatCard
                    label="Cena/m²"
                    value={getValue('cene', 'povprecna_cena_m2')}
                    formatter="currency"
                />

                {/* Skupna cena */}
                <StatCard
                    label="Skupna cena"
                    value={getValue('cene', 'povprecna_skupna_cena')}
                    formatter="currency_large"
                />

                {/* Velikost */}
                <StatCard
                    label="Velikost"
                    value={getValue('lastnosti', 'povprecna_velikost_m2')}
                    formatter="area"
                />

                {/* Posli/Najem */}
                <StatCard
                    label={activeTab === 'najem' ? 'V najemu' : 'Št. poslov'}
                    value={getValue('aktivnost', activeTab === 'najem' ? 'aktivna_v_letu' : 'stevilo_poslov')}
                    formatter="default"
                />

                {/* Starost */}
                <StatCard
                    label="Starost"
                    value={getValue('lastnosti', 'povprecna_starost_stavbe')}
                    formatter="years"
                />
            </div>
        </div>
    );
};

PropertyGrid.propTypes = {
    data: PropTypes.object,
    activeTab: PropTypes.oneOf(['prodaja', 'najem']).isRequired,
    propertyType: PropTypes.oneOf(['stanovanje', 'hisa']).isRequired
};

// Ovojnica za grafikone
const ChartWrapper = ({ title, children, showSwitcher = false, chartType, setChartType, chartTypeKey }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-800">{title}</h4>
            {showSwitcher && (
                <ChartTypeSwitcher 
                    chartType={chartType} 
                    setChartType={setChartType} 
                    chartTypeKey={chartTypeKey} 
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
    chartTypeKey: PropTypes.string
};

// ========================================
// POMOŽNE FUNKCIJE (Poenostavitev logike)
// ========================================

const formatters = {
    currency: (value) => `€${Math.round(value)}`,
    currencyLarge: (value) => `€${Math.round(value).toLocaleString()}`,
    area: (value) => `${Math.round(value)} m²`
};

const prepareUniversalChartData = (statisticsData, activeTab, chartType, dataType, valueKeys) => {
    const typeData = statisticsData?.[activeTab]?.[chartType]?.letno || [];
    return typeData.map(d => ({
        leto: d.leto,
        povprecna: d[dataType]?.[valueKeys.povprecna] || null,
        p10: d[dataType]?.[valueKeys.p10] || null,
        p90: d[dataType]?.[valueKeys.p90] || null,
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
        size: 'stanovanje'
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
                `https://domogled.up.railway.app/api/statistike/vse/${regionType}/${encodeURIComponent(regionName.toUpperCase())}`
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
        setApiState({ data: null, loading: false, error: null });
    }
}, [fetchStatistics]);

    const handleObcinaSelect = useCallback((obcinaData) => {
        setSelectedObcina(obcinaData);
        setSelectedMunicipality(null);
        
        if (obcinaData) {
            fetchStatistics(obcinaData.name, 'obcina');
        } else {
            setApiState({ data: null, loading: false, error: null });
        }
    }, [fetchStatistics]);

    // Samodejno nalaganje iz navigacije
    useEffect(() => {
        if (!selectedRegionFromNavigation) return;
        
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
    }, [selectedRegionFromNavigation, fetchStatistics]);

    // Priprava podatkov za grafikone
    const chartData = {
        price: prepareUniversalChartData(apiState.data, activeTab, chartType.price, 'cene', {
            povprecna: 'povprecna_cena_m2',
            p10: 'percentil_10_cena_m2',
            p90: 'percentil_90_cena_m2'
        }),
        totalPrice: prepareUniversalChartData(apiState.data, activeTab, chartType.totalPrice, 'cene', {
            povprecna: 'povprecna_skupna_cena',
            p10: 'percentil_10_skupna_cena', 
            p90: 'percentil_90_skupna_cena'
        }),
        size: prepareUniversalChartData(apiState.data, activeTab, chartType.size, 'lastnosti', {
            povprecna: 'povprecna_velikost_m2',
            p10: 'percentil_10_velikost_m2',
            p90: 'percentil_90_velikost_m2'
        }),
        activity: prepareActivityChartData(apiState.data, activeTab)
    };

    const hasData = chartData.price.length > 0 || chartData.activity.length > 0;
    const selectedRegion = selectedMunicipality || selectedObcina;

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
                                        className={`pb-2 px-4 text-sm font-medium transition-colors relative ${
                                            activeTab === tab
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
                        {!selectedRegion ? (
                            <div className="h-full flex items-center justify-center text-gray-500 py-12">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">{activeTab === 'najem' ? '📈' : '📊'}</div>
                                    <h3 className="text-lg font-medium mb-2">Izberi občino ali kataster</h3>
                                    <p className="text-sm">
                                        Klikni na zemljevid za prikaz statistik za {activeTab === 'najem' ? 'najem' : 'prodajo'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Občine so pobarvane glede na število {activeTab === 'najem' ? 'najemov' : 'prodaj'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full">
                                {/* Glava */}
                                <div className="bg-white text-black p-4 border-b border-gray-200">
                                    <h2 className="text-xl font-bold">Statistike za {selectedRegion.name}</h2>
                                    <p className="text-gray-600 text-sm">
                                        {selectedMunicipality ? 'Kataster' : 'Občina'} - Podatki za {activeTab === 'najem' ? 'najem' : 'prodajo'}
                                    </p>
                                </div>

                                <div className="p-6">
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
                                        <div className="space-y-6">
                                            {/* Informacije o regiji */}
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <h3 className="text-lg font-semibold mb-2">
                                                    {activeTab === 'prodaja' ? '📊 PRODAJA' : '📈 NAJEM'} - {selectedRegion.name}
                                                </h3>
                                                <p className="text-gray-600 text-sm">Podatki za zadnjih 12 mesecev</p>
                                            </div>

                                            {/* Mreže nepremičnin */}
                                            <div className="space-y-6">
                                                {apiState.data[activeTab]?.stanovanje?.zadnjih_12m && (
                                                    <PropertyGrid
                                                        data={apiState.data[activeTab].stanovanje.zadnjih_12m}
                                                        activeTab={activeTab}
                                                        propertyType="stanovanje"
                                                    />
                                                )}

                                                {apiState.data[activeTab]?.hisa?.zadnjih_12m && (
                                                    <PropertyGrid
                                                        data={apiState.data[activeTab].hisa.zadnjih_12m}
                                                        activeTab={activeTab}
                                                        propertyType="hisa"
                                                    />
                                                )}
                                            </div>

                                            {/* Prikaži sporočilo če ni podatkov */}
                                            {!apiState.data[activeTab]?.stanovanje?.zadnjih_12m && !apiState.data[activeTab]?.hisa?.zadnjih_12m && (
                                                <div className="text-center py-8 text-gray-500">
                                                    Ni podatkov za {activeTab} v tej regiji
                                                </div>
                                            )}

                                            {/* Grafikoni */}
                                            {hasData && (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Grafikon cene na m² */}
                                                        {chartData.price.length > 0 && (
                                                            <ChartWrapper
                                                                title="Povprečna cena/m² po letih"
                                                                showSwitcher={true}
                                                                chartType={chartType}
                                                                setChartType={setChartType}
                                                                chartTypeKey="price"
                                                            >
                                                                <LineChart data={chartData.price}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                    <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                                    <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `€${value}`} />
                                                                    <Tooltip content={<UniversalTooltip formatter={formatters.currency} />} />
                                                                    <Legend />
                                                                    <Line type="monotone" dataKey="povprecna" stroke={chartType.price === 'stanovanje' ? "#3b82f6" : "#10b981"} strokeWidth={3} name="Povprečna" />
                                                                    <Line type="monotone" dataKey="p10" stroke={chartType.price === 'stanovanje' ? "#93c5fd" : "#6ee7b7"} strokeWidth={2} strokeDasharray="5 5" name="10. percentil" />
                                                                    <Line type="monotone" dataKey="p90" stroke={chartType.price === 'stanovanje' ? "#1e40af" : "#047857"} strokeWidth={2} strokeDasharray="5 5" name="90. percentil" />
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
                                                            >
                                                                <LineChart data={chartData.totalPrice}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                    <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                                    <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                                                                    <Tooltip content={<UniversalTooltip formatter={formatters.currencyLarge} />} />
                                                                    <Legend />
                                                                    <Line type="monotone" dataKey="povprecna" stroke={chartType.totalPrice === 'stanovanje' ? "#3b82f6" : "#10b981"} strokeWidth={3} name="Povprečna" />
                                                                    <Line type="monotone" dataKey="p10" stroke={chartType.totalPrice === 'stanovanje' ? "#93c5fd" : "#6ee7b7"} strokeWidth={2} strokeDasharray="5 5" name="10. percentil" />
                                                                    <Line type="monotone" dataKey="p90" stroke={chartType.totalPrice === 'stanovanje' ? "#1e40af" : "#047857"} strokeWidth={2} strokeDasharray="5 5" name="90. percentil" />
                                                                </LineChart>
                                                            </ChartWrapper>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Grafikon aktivnosti */}
                                                        {chartData.activity.length > 0 && (
                                                            <ChartWrapper title={`Število ${activeTab === 'najem' ? 'najemov' : 'prodaj'} po letih`}>
                                                                <LineChart data={chartData.activity}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                    <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                                    <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                                                                    <Tooltip content={<UniversalTooltip />} />
                                                                    <Legend />
                                                                    <Line type="monotone" dataKey="stanovanja" stroke="#3b82f6" strokeWidth={3} name="Stanovanja" />
                                                                    <Line type="monotone" dataKey="hise" stroke="#10b981" strokeWidth={3} name="Hiše" />
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
                                                            >
                                                                <LineChart data={chartData.size}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                    <XAxis dataKey="leto" stroke="#666" tick={{ fontSize: 11 }} />
                                                                    <YAxis stroke="#666" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value} m²`} />
                                                                    <Tooltip content={<UniversalTooltip formatter={formatters.area} />} />
                                                                    <Legend />
                                                                    <Line type="monotone" dataKey="povprecna" stroke={chartType.size === 'stanovanje' ? "#3b82f6" : "#10b981"} strokeWidth={3} name="Povprečna" />
                                                                    <Line type="monotone" dataKey="p10" stroke={chartType.size === 'stanovanje' ? "#93c5fd" : "#6ee7b7"} strokeWidth={2} strokeDasharray="5 5" name="10. percentil" />
                                                                    <Line type="monotone" dataKey="p90" stroke={chartType.size === 'stanovanje' ? "#1e40af" : "#047857"} strokeWidth={2} strokeDasharray="5 5" name="90. percentil" />
                                                                </LineChart>
                                                            </ChartWrapper>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            Ni podatkov za {activeTab} v tej regiji
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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