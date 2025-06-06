import { useState, useEffect } from "react";
import StatisticsZemljevid from "./StatisticsZemljevid.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Statistika() {
    // States za izbrane regije
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);
    const [activeTab, setActiveTab] = useState('prodaja'); // nov state za tab switcher
    const [statisticsData, setStatisticsData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ===========================================
    // DATA PROCESSING FUNCTIONS
    // ===========================================

    const prepareChartData = () => {
        if (!statisticsData || !statisticsData[activeTab]) return [];

        const stanovanjeData = statisticsData[activeTab]?.stanovanje?.letno || [];
        const hisaData = statisticsData[activeTab]?.hisa?.letno || [];

        // Ustvari set vseh let
        const allYears = new Set([
            ...stanovanjeData.map(d => d.leto),
            ...hisaData.map(d => d.leto)
        ]);

        // Pripravi podatke za graf
        const chartData = Array.from(allYears).sort().map(leto => {
            const stanovanjeYear = stanovanjeData.find(d => d.leto === leto);
            const hisaYear = hisaData.find(d => d.leto === leto);

            return {
                leto: leto,
                // Stanovanje podatki
                stanovanje_povprecna: stanovanjeYear?.cene?.povprecna_cena_m2 || null,
                stanovanje_p10: stanovanjeYear?.cene?.percentil_10_cena_m2 || null,
                stanovanje_p90: stanovanjeYear?.cene?.percentil_90_cena_m2 || null,
                // Hiša podatki
                hisa_povprecna: hisaYear?.cene?.povprecna_cena_m2 || null,
                hisa_p10: hisaYear?.cene?.percentil_10_cena_m2 || null,
                hisa_p90: hisaYear?.cene?.percentil_90_cena_m2 || null,
            };
        });

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

    // ===========================================
    // API FUNCTIONS
    // ===========================================

    const fetchStatistics = async (regionName, regionType) => {
        setLoading(true);
        setError(null);
        
        try {
            // Pretvorimo ime regije v velike črke
            const regionNameUpper = regionName.toUpperCase();
            
            console.log('Calling API with:', {
                regionName: regionName,
                regionNameUpper: regionNameUpper,
                regionType: regionType,
                encodedName: encodeURIComponent(regionNameUpper)
            });
            
            const response = await fetch(`http://localhost:8000/api/statistike/vse/${regionType}/${encodeURIComponent(regionNameUpper)}`);
            
            console.log('API Response status:', response.status);
            
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
    // CALLBACK HANDLERI
    // ===========================================

    const handleMunicipalitySelect = (municipalityData) => {
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
            
            console.log('Original municipality name:', municipalityData.name);
            console.log('Cleaned municipality name:', municipalityName);
            
            // Fetch statistics for kataster (katastrska_obcina)
            fetchStatistics(municipalityName, 'katastrska_obcina');
        } else {
            setStatisticsData(null);
        }
    };

    const handleObcinaSelect = (obcinaData) => {
        setSelectedObcina(obcinaData);
        // Clear municipality selection when občina is selected
        if (obcinaData) {
            setSelectedMunicipality(null);
            // Fetch statistics for občina
            fetchStatistics(obcinaData.name, 'obcina');
        } else {
            setStatisticsData(null);
        }
    };

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
                        />
                    </div>

                    {/* Statistike sekcija - spodaj */}
                    <div className="min-h-[400px]">
                        {/* Tab Switcher - vedno viden */}
                        <div className="flex justify-center py-4 border-b border-gray-100">
                            <div className="flex space-x-8">
                                <button
                                    onClick={() => setActiveTab('prodaja')}
                                    className={`pb-2 px-4 text-sm font-medium transition-colors relative ${
                                        activeTab === 'prodaja'
                                            ? 'text-black border-b-2 border-black'
                                            : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'
                                    }`}
                                >
                                    Prodaja
                                </button>
                                <button
                                    onClick={() => setActiveTab('najem')}
                                    className={`pb-2 px-4 text-sm font-medium transition-colors relative ${
                                        activeTab === 'najem'
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

                                            {/* Statistike grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Stanovanje */}
                                                {statisticsData[activeTab]?.stanovanje?.zadnjih_12m && (
                                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                        <h4 className="font-semibold text-gray-800 mb-3">
                                                            Stanovanje - {activeTab}
                                                        </h4>
                                                        
                                                        <div className="space-y-2">
                                                            {/* Cena */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna cena/m²:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_cena_m2 ? 
                                                                        `€${Math.round(statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_cena_m2)}` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Skupna cena */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna skupna cena:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_skupna_cena ? 
                                                                        `€${Math.round(statisticsData[activeTab].stanovanje.zadnjih_12m.cene.povprecna_skupna_cena).toLocaleString()}` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Število poslov */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Število poslov:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.aktivnost.stevilo_poslov || 0}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Trenutno v najemu (samo za najem) */}
                                                            {activeTab === 'najem' && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-sm text-gray-600">Trenutno v najemu:</span>
                                                                    <span className="font-medium">
                                                                        {statisticsData[activeTab].stanovanje.zadnjih_12m.aktivnost.trenutno_v_najemu || 0}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Povprečna velikost */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna velikost:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_velikost_m2 ? 
                                                                        `${Math.round(statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_velikost_m2)} m²` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Starost stavbe */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna starost:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_starost_stavbe ? 
                                                                        `${statisticsData[activeTab].stanovanje.zadnjih_12m.lastnosti.povprecna_starost_stavbe} let` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Hiša */}
                                                {statisticsData[activeTab]?.hisa?.zadnjih_12m && (
                                                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                        <h4 className="font-semibold text-gray-800 mb-3">
                                                            Hiša - {activeTab}
                                                        </h4>
                                                        
                                                        <div className="space-y-2">
                                                            {/* Cena */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna cena/m²:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_cena_m2 ? 
                                                                        `€${Math.round(statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_cena_m2)}` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Skupna cena */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna skupna cena:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_skupna_cena ? 
                                                                        `€${Math.round(statisticsData[activeTab].hisa.zadnjih_12m.cene.povprecna_skupna_cena).toLocaleString()}` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Število poslov */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Število poslov:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.aktivnost.stevilo_poslov || 0}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Trenutno v najemu (samo za najem) */}
                                                            {activeTab === 'najem' && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-sm text-gray-600">Trenutno v najemu:</span>
                                                                    <span className="font-medium">
                                                                        {statisticsData[activeTab].hisa.zadnjih_12m.aktivnost.trenutno_v_najemu || 0}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Povprečna velikost */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna velikost:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_velikost_m2 ? 
                                                                        `${Math.round(statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_velikost_m2)} m²` : 'N/A'
                                                                    }
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Starost stavbe */}
                                                            <div className="flex justify-between">
                                                                <span className="text-sm text-gray-600">Povprečna starost:</span>
                                                                <span className="font-medium">
                                                                    {statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_starost_stavbe ? 
                                                                        `${statisticsData[activeTab].hisa.zadnjih_12m.lastnosti.povprecna_starost_stavbe} let` : 'N/A'
                                                                    }
                                                                </span>
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

                                            {/* Graf - Povprečna cena m² po letih */}
                                            {prepareChartData().length > 0 && (
                                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                                    <h4 className="font-semibold text-gray-800 mb-4">
                                                        Povprečna cena/m² po letih - {activeTab}
                                                    </h4>
                                                    <div className="h-80">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <LineChart data={prepareChartData()}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                                <XAxis 
                                                                    dataKey="leto" 
                                                                    stroke="#666"
                                                                    tick={{ fontSize: 12 }}
                                                                />
                                                                <YAxis 
                                                                    stroke="#666"
                                                                    tick={{ fontSize: 12 }}
                                                                    tickFormatter={(value) => `€${value}`}
                                                                />
                                                                <Tooltip content={<CustomTooltip />} />
                                                                <Legend />
                                                                
                                                                {/* Stanovanje linije */}
                                                                <Line 
                                                                    type="monotone" 
                                                                    dataKey="stanovanje_povprecna" 
                                                                    stroke="#3b82f6" 
                                                                    strokeWidth={3}
                                                                    name="Stanovanje - Povprečna"
                                                                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                                                    connectNulls={false}
                                                                />
                                                                <Line 
                                                                    type="monotone" 
                                                                    dataKey="stanovanje_p10" 
                                                                    stroke="#93c5fd" 
                                                                    strokeWidth={2}
                                                                    strokeDasharray="5 5"
                                                                    name="Stanovanje - 10. percentil"
                                                                    dot={{ fill: '#93c5fd', strokeWidth: 1, r: 3 }}
                                                                    connectNulls={false}
                                                                />
                                                                <Line 
                                                                    type="monotone" 
                                                                    dataKey="stanovanje_p90" 
                                                                    stroke="#1e40af" 
                                                                    strokeWidth={2}
                                                                    strokeDasharray="5 5"
                                                                    name="Stanovanje - 90. percentil"
                                                                    dot={{ fill: '#1e40af', strokeWidth: 1, r: 3 }}
                                                                    connectNulls={false}
                                                                />
                                                                
                                                                {/* Hiša linije */}
                                                                <Line 
                                                                    type="monotone" 
                                                                    dataKey="hisa_povprecna" 
                                                                    stroke="#10b981" 
                                                                    strokeWidth={3}
                                                                    name="Hiša - Povprečna"
                                                                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                                                    connectNulls={false}
                                                                />
                                                                <Line 
                                                                    type="monotone" 
                                                                    dataKey="hisa_p10" 
                                                                    stroke="#6ee7b7" 
                                                                    strokeWidth={2}
                                                                    strokeDasharray="5 5"
                                                                    name="Hiša - 10. percentil"
                                                                    dot={{ fill: '#6ee7b7', strokeWidth: 1, r: 3 }}
                                                                    connectNulls={false}
                                                                />
                                                                <Line 
                                                                    type="monotone" 
                                                                    dataKey="hisa_p90" 
                                                                    stroke="#047857" 
                                                                    strokeWidth={2}
                                                                    strokeDasharray="5 5"
                                                                    name="Hiša - 90. percentil"
                                                                    dot={{ fill: '#047857', strokeWidth: 1, r: 3 }}
                                                                    connectNulls={false}
                                                                />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
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