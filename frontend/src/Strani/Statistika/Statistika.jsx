import { useState, useEffect, useCallback } from "react";
import StatisticsZemljevid from "./StatisticsZemljevid.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Statistika({ selectedRegionFromNavigation }) {
    
    // States za izbrane regije
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [activeTab, setActiveTab] = useState('prodaja');
    const [chartType, setChartType] = useState('stanovanje');
    const [chartType2, setChartType2] = useState('stanovanje');
    const [chartType3, setChartType3] = useState('stanovanje');
    const [statisticsData, setStatisticsData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Effect za avtomatsko nalaganje regije iz navigacije
    useEffect(() => {
        if (selectedRegionFromNavigation) {
            const region = selectedRegionFromNavigation;
            
            if (region.type === 'katastrska_obcina') {
                // Avtomatsko nastavi kataster
                const municipalityData = {
                    name: `${region.name} (${region.sifko})`,
                    sifko: region.sifko,
                    // Dodaj flag za avtomatski zoom
                    autoZoom: region.autoZoomToRegion
                };
                setSelectedMunicipality(municipalityData);
                setSelectedObcina(null);
                
                // Takoj pridobi statistike
                fetchStatistics(region.name, 'katastrska_obcina');
            } else if (region.type === 'obcina') {
                // Avtomatsko nastavi občino
                const obcinaData = {
                    name: region.name,
                    obcinaId: region.obcinaId,
                    // Dodaj flag za avtomatski zoom
                    autoZoom: region.autoZoomToRegion
                };
                setSelectedObcina(obcinaData);
                setSelectedMunicipality(null);
                
                // Takoj pridobi statistike
                fetchStatistics(region.name, 'obcina');
            }
        }
    }, [selectedRegionFromNavigation]);

    // ===========================================
    // DATA PROCESSING FUNKCIJE
    // ===========================================

    const prepareChartData = () => {
        if (!statisticsData || !statisticsData[activeTab]) return [];

        const typeData = statisticsData[activeTab]?.[chartType]?.letno || [];

        // Pripravi podatke za graf samo za izbrani tip
        const chartData = typeData.map(d => ({
            leto: d.leto,
            povprecna: d.cene?.povprecna_cena_m2 || null,
            p10: d.cene?.percentil_10_cena_m2 || null,
            p90: d.cene?.percentil_90_cena_m2 || null,
        })).sort((a, b) => a.leto - b.leto);

        return chartData;
    };

    const prepareChart2Data = () => {
        if (!statisticsData || !statisticsData[activeTab]) return [];

        const typeData = statisticsData[activeTab]?.[chartType2]?.letno || [];

        // Pripravi podatke za graf celotne cene
        const chartData = typeData.map(d => ({
            leto: d.leto,
            povprecna: d.cene?.povprecna_skupna_cena || null,
            p10: d.cene?.percentil_10_skupna_cena || null,
            p90: d.cene?.percentil_90_skupna_cena || null,
        })).sort((a, b) => a.leto - b.leto);

        return chartData;
    };

    const prepareActivityData = () => {
        if (!statisticsData || !statisticsData[activeTab]) return [];

        // Zberi vsa leta iz obeh tipov nepremičnin
        const stanovanjePodatki = statisticsData[activeTab]?.stanovanje?.letno || [];
        const hisePodatki = statisticsData[activeTab]?.hisa?.letno || [];

        // Ustvari mapo z leti
        const letaMap = new Map();

        // Dodaj podatke za stanovanja
        stanovanjePodatki.forEach(d => {
            if (!letaMap.has(d.leto)) {
                letaMap.set(d.leto, { leto: d.leto, stanovanja: 0, hise: 0 });
            }

            if(activeTab === 'najem')
                letaMap.get(d.leto).stanovanja = d.aktivnost?.aktivna_v_letu || 0;
            else
                letaMap.get(d.leto).stanovanja = d.aktivnost?.stevilo_poslov || 0;
        });

        // Dodaj podatke za hiše
        hisePodatki.forEach(d => {
            if (!letaMap.has(d.leto)) {
                letaMap.set(d.leto, { leto: d.leto, stanovanja: 0, hise: 0 });
            }

            if(activeTab === 'najem')
                letaMap.get(d.leto).hise = d.aktivnost?.aktivna_v_letu || 0;
            else
                letaMap.get(d.leto).hise = d.aktivnost?.stevilo_poslov || 0;
        });

        // Pretvori v array in sortiraj
        return Array.from(letaMap.values()).sort((a, b) => a.leto - b.leto);
    };

    const prepareSizeChartData = () => {
        if (!statisticsData || !statisticsData[activeTab]) return [];

        const typeData = statisticsData[activeTab]?.[chartType3]?.letno || [];

        // Pripravi podatke za graf velikosti samo za izbrani tip
        const chartData = typeData.map(d => ({
            leto: d.leto,
            povprecna: d.lastnosti?.povprecna_velikost_m2 || null,
            p10: d.lastnosti?.percentil_10_velikost_m2 || null,
            p90: d.lastnosti?.percentil_90_velikost_m2 || null,
        })).sort((a, b) => a.leto - b.leto);

        return chartData;
    };

    // Custom tooltip za graf
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                    <p className="font-semibold">{`Leto: ${label}`}</p>
                    {payload.map((entry, index) => {
                        if (entry.value !== null) {
                            return (
                                <p key={index} style={{ color: entry.color }}>
                                    {`${entry.name}: €${Math.round(entry.value)}`}
                                </p>
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        return null;
    };

    // Custom tooltip za celotno ceno (z localeString)
    const CustomTooltip2 = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                    <p className="font-semibold">{`Leto: ${label}`}</p>
                    {payload.map((entry, index) => {
                        if (entry.value !== null) {
                            return (
                                <p key={index} style={{ color: entry.color }}>
                                    {`${entry.name}: €${Math.round(entry.value).toLocaleString()}`}
                                </p>
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        return null;
    };

    // Custom tooltip za število poslov
    const CustomTooltip3 = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                    <p className="font-semibold">{`Leto: ${label}`}</p>
                    {payload.map((entry, index) => {
                        if (entry.value !== null && entry.value !== undefined) {
                            return (
                                <p key={index} style={{ color: entry.color }}>
                                    {`${entry.name}: ${entry.value}`}
                                </p>
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        return null;
    };

    // Custom tooltip za velikost (z m²) - nova verzija
    const CustomTooltip4 = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
                    <p className="font-semibold">{`Leto: ${label}`}</p>
                    {payload.map((entry, index) => {
                        if (entry.value !== null && entry.value !== undefined) {
                            return (
                                <p key={index} style={{ color: entry.color }}>
                                    {`${entry.name}: ${Math.round(entry.value)} m²`}
                                </p>
                            );
                        }
                        return null;
                    })}
                </div>
            );
        }
        return null;
    };

    // ===========================================
    // API FUNCTIONS
    // ===========================================

    const fetchStatistics = async (regionName, regionType) => {
        setLoading(true);
        setError(null);

        try {
            // Pretvorimo ime regije v velike črke
            const regionNameUpper = regionName.toUpperCase();

            const response = await fetch(`http://localhost:8000/api/statistike/vse/${regionType}/${encodeURIComponent(regionNameUpper)}`);

            if (!response.ok) {
                // Poskusi pridobiti error message iz response
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    }
                } catch (e) {
                    // Če ni JSON response, obdrži osnovni error
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('API Response data:', data);

            if (data.status === 'success') {
                setStatisticsData(data.statistike);
            } else {
                throw new Error(data.message || 'Napaka pri pridobivanju statistik');
            }
        } catch (err) {
            console.error('Napaka pri API klicu:', err);
            setError(err.message);
            setStatisticsData(null);
        } finally {
            setLoading(false);
        }
    };

    // ===========================================
    // POSODOBLJENI CALLBACK HANDLERI
    // ===========================================

    const handleMunicipalitySelect = useCallback((municipalityData) => {
        setSelectedMunicipality(municipalityData);
        // Clear občina selection when municipality is selected
        if (municipalityData) {
            setSelectedObcina(null);

            // Izvleci samo ime katastrske občine (brez SIFKO kode)
            let municipalityName = municipalityData.name;

            // Če ime vsebuje oklepaje z SIFKO kodo, jo odstrani
            // Primer: "LJUBLJANA (1732)" -> "LJUBLJANA"
            if (municipalityName.includes('(') && municipalityName.includes(')')) {
                municipalityName = municipalityName.split('(')[0].trim();
            }


            // Fetch statistics for kataster (katastrska_obcina)
            fetchStatistics(municipalityName, 'katastrska_obcina');
        } else {
            setStatisticsData(null);
        }
    }, []);

    const handleObcinaSelect = useCallback((obcinaData) => {
        setSelectedObcina(obcinaData);
        // Clear municipality selection when občina is selected
        if (obcinaData) {
            setSelectedMunicipality(null);
            // Fetch statistics for občina
            fetchStatistics(obcinaData.name, 'obcina');
        } else {
            setStatisticsData(null);
        }
    }, []);

    // ===========================================
    // RENDER
    // ===========================================

    return (
        <div className="min-h-screen bg-gray-100 pt-16 pb-8 px-8">
            {/* Container za celoten dashboard */}
            <div className="max-w-none mx-8">

                {/* Kombiniran container - zemljevid zgoraj, statistike spodaj, brez gapa */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">

                    {/* Zemljevid sekcija - zgoraj */}
                    <div className="h-[600px]">
                        <StatisticsZemljevid
                            onMunicipalitySelect={handleMunicipalitySelect}
                            onObcinaSelect={handleObcinaSelect}
                            selectedMunicipality={selectedMunicipality}
                            selectedObcina={selectedObcina}
                            selectedRegionFromNavigation={selectedRegionFromNavigation}
                            activeTab={activeTab} // 🆕 Posreduj aktivni tab zemljevidu
                        />
                    </div>

                    {/* Statistike sekcija - spodaj */}
                    <div className="min-h-[400px]">
                        {/* Tab Switcher - vedno viden */}
                        <div className="flex justify-center py-4 border-b border-gray-100">
                            <div className="flex space-x-8">
                                <button
                                    onClick={() => setActiveTab('prodaja')}
                                    className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'prodaja'
                                        ? 'text-black border-b-2 border-black'
                                        : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'
                                        }`}
                                >
                                    Prodaja
                                </button>
                                <button
                                    onClick={() => setActiveTab('najem')}
                                    className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'najem'
                                        ? 'text-black border-b-2 border-black'
                                        : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'
                                        }`}
                                >
                                    Najem
                                </button>
                            </div>
                        </div>

                        {/* Placeholder ali vsebina */}
                        {!selectedMunicipality && !selectedObcina ? (
                            <div className="h-full flex items-center justify-center text-gray-500 py-12">
                                <div className="text-center">
                                    {/* Ikona glede na aktivni tab */}
                                    <div className="text-6xl mb-4">
                                        {activeTab === 'najem' ? '📈' : '📊'}
                                    </div>
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
                                {/* Header */}
                                <div className="bg-white text-black p-4 border-b border-gray-200">
                                    <h2 className="text-xl font-bold">
                                        Statistike za {selectedMunicipality?.name || selectedObcina?.name}
                                    </h2>
                                    <p className="text-gray-600 text-sm">
                                        {selectedMunicipality ? 'Kataster' : 'Občina'} - Podatki za {activeTab === 'najem' ? 'najem' : 'prodajo'}
                                    </p>
                                </div>

                                {/* Vsebina glede na izbrani tab */}
                                <div className="p-6">
                                    {loading ? (
                                        <div className="text-center py-8">
                                            <div className="text-lg text-gray-600">Nalagam statistike...</div>
                                        </div>
                                    ) : error ? (
                                        <div className="text-center py-8">
                                            <div className="text-lg text-red-600 mb-2">Napaka pri nalaganju statistik</div>
                                            <div className="text-sm text-gray-500">{error}</div>
                                        </div>
                                    ) : statisticsData ? (
                                        <div className="space-y-6">
                                            {/* Osnovni podatki o regiji */}
                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                <h3 className="text-lg font-semibold mb-2">
                                                    {activeTab === 'prodaja' ? '📊 PRODAJA' : '📈 NAJEM'} - {selectedMunicipality?.name || selectedObcina?.name}
                                                </h3>
                                                <p className="text-gray-600 text-sm">
                                                    Podatki za zadnjih 12 mesecev
                                                </p>
                                            </div>

                                            {/* Statistike grid - Individual Box Style */}
                                            <div className="space-y-6">
                                                {/* Stanovanje */}
                                                {statisticsData[activeTab]?.stanovanje?.zadnjih_12m && (
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-800 mb-4">
                                                            Stanovanja - {activeTab}
                                                        </h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                                            {/* Cena/m² */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Cena/m²</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_cena_m2 ?
                                                                        `€${Math.round(statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_cena_m2)}` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Skupna cena */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Skupna cena</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_skupna_cena ?
                                                                        `€${Math.round(statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_skupna_cena).toLocaleString()}` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Velikost */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Velikost</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_velikost_m2 ?
                                                                        `${Math.round(statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_velikost_m2)} m²` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Posli/Najem */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">
                                                                        {activeTab === 'najem' ? 'V najemu' : 'Št. poslov'}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {activeTab === 'najem' ?
                                                                        (statisticsData[activeTab].stanovanje.zadnjih_12m.aktivnost.aktivna_v_letu || 0) :
                                                                        (statisticsData[activeTab].stanovanje.zadnjih_12m.aktivnost.stevilo_poslov || 0)
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Starost */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Starost</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_starost_stavbe ?
                                                                        `${statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_starost_stavbe} let` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Hiša */}
                                                {statisticsData[activeTab]?.hisa?.zadnjih_12m && (
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-800 mb-4">
                                                            Hiše - {activeTab}
                                                        </h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                                            {/* Cena/m² */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Cena/m²</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_cena_m2 ?
                                                                        `€${Math.round(statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_cena_m2)}` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Skupna cena */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Skupna cena</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_skupna_cena ?
                                                                        `€${Math.round(statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_skupna_cena).toLocaleString()}` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Velikost */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Velikost</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_velikost_m2 ?
                                                                        `${Math.round(statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_velikost_m2)} m²` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Posli/Najem */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">
                                                                        {activeTab === 'najem' ? 'V najemu' : 'Št. poslov'}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {activeTab === 'najem' ?
                                                                        (statisticsData[activeTab].hisa.zadnjih_12m.aktivnost.aktivna_v_letu || 0) :
                                                                        (statisticsData[activeTab].hisa.zadnjih_12m.aktivnost.stevilo_poslov || 0)
                                                                    }
                                                                </div>
                                                            </div>

                                                            {/* Starost */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
                                                                <div className="mb-2">
                                                                    <div className="text-xs text-gray-500">Starost</div>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-800">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_starost_stavbe ?
                                                                        `${statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_starost_stavbe} let` : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Če ni podatkov za trenutni tab */}
                                            {!statisticsData[activeTab]?.stanovanje?.zadnjih_12m && !statisticsData[activeTab]?.hisa?.zadnjih_12m && (
                                                <div className="text-center py-8 text-gray-500">
                                                    Ni podatkov za {activeTab} v tej regiji
                                                </div>
                                            )}

                                            {/* Graf sekcija - štirje grafi */}
                                            {(prepareChartData().length > 0 || prepareActivityData().length > 0 || prepareSizeChartData().length > 0) && (
                                                <div className="space-y-4">
                                                    {/* Prva vrsta - Prvi dva grafa */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Graf 1 - Cena/m² */}
                                                    {prepareChartData().length > 0 && (
                                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                            {/* Graf switcher */}
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="font-semibold text-gray-800">
                                                                    Povprečna cena/m² po letih
                                                                </h4>
                                                                <div className="flex space-x-2">
                                                                    <button
                                                                        onClick={() => setChartType('stanovanje')}
                                                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType === 'stanovanje'
                                                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                            }`}
                                                                    >
                                                                        Stanovanje
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setChartType('hisa')}
                                                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType === 'hisa'
                                                                            ? 'bg-green-100 text-green-700 border border-green-300'
                                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                            }`}
                                                                    >
                                                                        Hiša
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={prepareChartData()}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                        <XAxis
                                                                            dataKey="leto"
                                                                            stroke="#666"
                                                                            tick={{ fontSize: 11 }}
                                                                        />
                                                                        <YAxis
                                                                            stroke="#666"
                                                                            tick={{ fontSize: 11 }}
                                                                            tickFormatter={(value) => `€${value}`}
                                                                        />
                                                                        <Tooltip content={<CustomTooltip />} />
                                                                        <Legend />

                                                                        {/* Dinamične linije glede na chartType */}
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="povprecna"
                                                                            stroke={chartType === 'stanovanje' ? "#3b82f6" : "#10b981"}
                                                                            strokeWidth={3}
                                                                            name="Povprečna"
                                                                            dot={{ fill: chartType === 'stanovanje' ? "#3b82f6" : "#10b981", strokeWidth: 2, r: 4 }}
                                                                            connectNulls={false}
                                                                        />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="p10"
                                                                            stroke={chartType === 'stanovanje' ? "#93c5fd" : "#6ee7b7"}
                                                                            strokeWidth={2}
                                                                            strokeDasharray="5 5"
                                                                            name="10. percentil"
                                                                            dot={{ fill: chartType === 'stanovanje' ? "#93c5fd" : "#6ee7b7", strokeWidth: 1, r: 3 }}
                                                                            connectNulls={false}
                                                                        />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="p90"
                                                                            stroke={chartType === 'stanovanje' ? "#1e40af" : "#047857"}
                                                                            strokeWidth={2}
                                                                            strokeDasharray="5 5"
                                                                            name="90. percentil"
                                                                            dot={{ fill: chartType === 'stanovanje' ? "#1e40af" : "#047857", strokeWidth: 1, r: 3 }}
                                                                            connectNulls={false}
                                                                        />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Graf 2 - Celotna cena */}
                                                    {prepareChart2Data().length > 0 && (
                                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                            {/* Graf switcher */}
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="font-semibold text-gray-800">
                                                                    Povprečna celotna cena po letih
                                                                </h4>
                                                                <div className="flex space-x-2">
                                                                    <button
                                                                        onClick={() => setChartType2('stanovanje')}
                                                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType2 === 'stanovanje'
                                                                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                            }`}
                                                                    >
                                                                        Stanovanje
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setChartType2('hisa')}
                                                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType2 === 'hisa'
                                                                            ? 'bg-green-100 text-green-700 border border-green-300'
                                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                            }`}
                                                                    >
                                                                        Hiša
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={prepareChart2Data()}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                        <XAxis
                                                                            dataKey="leto"
                                                                            stroke="#666"
                                                                            tick={{ fontSize: 11 }}
                                                                        />
                                                                        <YAxis
                                                                            stroke="#666"
                                                                            tick={{ fontSize: 11 }}
                                                                            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                                                                        />
                                                                        <Tooltip content={<CustomTooltip2 />} />
                                                                        <Legend />

                                                                        {/* Dinamične linije glede na chartType2 */}
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="povprecna"
                                                                            stroke={chartType2 === 'stanovanje' ? "#3b82f6" : "#10b981"}
                                                                            strokeWidth={3}
                                                                            name="Povprečna"
                                                                            dot={{ fill: chartType2 === 'stanovanje' ? "#3b82f6" : "#10b981", strokeWidth: 2, r: 4 }}
                                                                            connectNulls={false}
                                                                        />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="p10"
                                                                            stroke={chartType2 === 'stanovanje' ? "#93c5fd" : "#6ee7b7"}
                                                                            strokeWidth={2}
                                                                            strokeDasharray="5 5"
                                                                            name="10. percentil"
                                                                            dot={{ fill: chartType2 === 'stanovanje' ? "#93c5fd" : "#6ee7b7", strokeWidth: 1, r: 3 }}
                                                                            connectNulls={false}
                                                                        />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="p90"
                                                                            stroke={chartType2 === 'stanovanje' ? "#1e40af" : "#047857"}
                                                                            strokeWidth={2}
                                                                            strokeDasharray="5 5"
                                                                            name="90. percentil"
                                                                            dot={{ fill: chartType2 === 'stanovanje' ? "#1e40af" : "#047857", strokeWidth: 1, r: 3 }}
                                                                            connectNulls={false}
                                                                        />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    )}

                                                    </div>

                                                    {/* Druga vrsta - Tretji in četrti graf */}
                                                    {(prepareActivityData().length > 0 || prepareSizeChartData().length > 0) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* Graf 3 - Število poslov po letih */}
                                                            {prepareActivityData().length > 0 && (
                                                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <h4 className="font-semibold text-gray-800">
                                                                            {activeTab === 'najem' ? 'Število najemov po letih' : 'Število prodaj po letih'}
                                                                        </h4>
                                                                    </div>
                                                                    
                                                                    <div className="h-64">
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={prepareActivityData()}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                                <XAxis 
                                                                                    dataKey="leto" 
                                                                                    stroke="#666"
                                                                                    tick={{ fontSize: 11 }}
                                                                                />
                                                                                <YAxis 
                                                                                    stroke="#666"
                                                                                    tick={{ fontSize: 11 }}
                                                                                />
                                                                                <Tooltip content={<CustomTooltip3 />} />
                                                                                <Legend />
                                                                                
                                                                                <Line 
                                                                                    type="monotone" 
                                                                                    dataKey="stanovanja" 
                                                                                    stroke="#3b82f6"
                                                                                    strokeWidth={3}
                                                                                    name="Stanovanja"
                                                                                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                                <Line 
                                                                                    type="monotone" 
                                                                                    dataKey="hise" 
                                                                                    stroke="#10b981"
                                                                                    strokeWidth={3}
                                                                                    name="Hiše"
                                                                                    dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Graf 4 - Velikost po letih */}
                                                            {prepareSizeChartData().length > 0 && (
                                                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                                    {/* Graf switcher */}
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <h4 className="font-semibold text-gray-800">
                                                                            Povprečna velikost po letih
                                                                        </h4>
                                                                        <div className="flex space-x-2">
                                                                            <button
                                                                                onClick={() => setChartType3('stanovanje')}
                                                                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType3 === 'stanovanje'
                                                                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                                    }`}
                                                                            >
                                                                                Stanovanje
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setChartType3('hisa')}
                                                                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${chartType3 === 'hisa'
                                                                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                                    }`}
                                                                            >
                                                                                Hiša
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="h-64">
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={prepareSizeChartData()}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                                <XAxis 
                                                                                    dataKey="leto" 
                                                                                    stroke="#666"
                                                                                    tick={{ fontSize: 11 }}
                                                                                />
                                                                                <YAxis 
                                                                                    stroke="#666"
                                                                                    tick={{ fontSize: 11 }}
                                                                                    tickFormatter={(value) => `${value} m²`}
                                                                                />
                                                                                <Tooltip content={<CustomTooltip4 />} />
                                                                                <Legend />
                                                                                
                                                                                {/* Dinamične linije glede na chartType3 */}
                                                                                <Line 
                                                                                    type="monotone" 
                                                                                    dataKey="povprecna" 
                                                                                    stroke={chartType3 === 'stanovanje' ? "#3b82f6" : "#10b981"}
                                                                                    strokeWidth={3}
                                                                                    name="Povprečna"
                                                                                    dot={{ fill: chartType3 === 'stanovanje' ? "#3b82f6" : "#10b981", strokeWidth: 2, r: 4 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                                <Line 
                                                                                    type="monotone" 
                                                                                    dataKey="p10" 
                                                                                    stroke={chartType3 === 'stanovanje' ? "#93c5fd" : "#6ee7b7"}
                                                                                    strokeWidth={2}
                                                                                    strokeDasharray="5 5"
                                                                                    name="10. percentil"
                                                                                    dot={{ fill: chartType3 === 'stanovanje' ? "#93c5fd" : "#6ee7b7", strokeWidth: 1, r: 3 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                                <Line 
                                                                                    type="monotone" 
                                                                                    dataKey="p90" 
                                                                                    stroke={chartType3 === 'stanovanje' ? "#1e40af" : "#047857"}
                                                                                    strokeWidth={2}
                                                                                    strokeDasharray="5 5"
                                                                                    name="90. percentil"
                                                                                    dot={{ fill: chartType3 === 'stanovanje' ? "#1e40af" : "#047857", strokeWidth: 1, r: 3 }}
                                                                                    connectNulls={false}
                                                                                />
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="text-lg text-gray-500">
                                                Podatki za {selectedMunicipality ? 'kataster' : 'občino'}: {selectedMunicipality?.name || selectedObcina?.name}
                                            </div>
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