import { useState } from "react";
import StatisticsZemljevid from "./StatisticsZemljevid.jsx";

export default function Statistika() {
    // States za izbrane regije
    const [selectedMunicipality, setSelectedMunicipality] = useState(null);
    const [selectedObcina, setSelectedObcina] = useState(null);

    // ===========================================
    // CALLBACK HANDLERI
    // ===========================================

    const handleMunicipalitySelect = (municipalityData) => {
        setSelectedMunicipality(municipalityData);
        // Clear občina selection when municipality is selected
        if (municipalityData) {
            setSelectedObcina(null);
        }
    };

    const handleObcinaSelect = (obcinaData) => {
        setSelectedObcina(obcinaData);
        // Clear municipality selection when občina is selected
        if (obcinaData) {
            setSelectedMunicipality(null);
        }
    };

    // ===========================================
    // RENDER
    // ===========================================

    return (
        <div className="min-h-screen bg-gray-100 pt-40 pb-8 px-8">
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
                        {/* Placeholder za statistike */}
                        {!selectedMunicipality && !selectedObcina ? (
                            <div className="h-full flex items-center justify-center text-gray-500 py-12">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">📊</div>
                                    <h3 className="text-lg font-medium mb-2">Izberi občino ali kataster</h3>
                                    <p className="text-sm">Klikni na zemljevid za prikaz statistik</p>
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
                                        {selectedMunicipality ? 'Kataster' : 'Občina'} - Podrobni podatki in analiza
                                    </p>
                                </div>

                                {/* Podatki za občino/kataster */}
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold mb-2">
                                        Podatki za {selectedMunicipality ? 'kataster' : 'občino'}: {selectedMunicipality?.name || selectedObcina?.name}
                                    </h3>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}