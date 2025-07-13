import { useState, useEffect } from 'react';

export default function IntroModal({ isVisible, onClose }) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setShow(true);
        }
    }, [isVisible]);

    const handleClose = () => {
        setShow(false);
        setTimeout(() => {
            onClose();
        }, 300); // Počakaj da se animacija konča
    };

    if (!isVisible) return null;

    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
                show ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)'
            }}
        >
            <div 
                className={`bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 ${
                    show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
                }`}
            >
                {/* Header */}
                <div className="text-white p-6 rounded-t-xl" style={{ backgroundColor: 'rgba(37, 99, 235, 0.8)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Dobrodošli na Domogled.si!</h2>
                            <p className="text-blue-100 mt-1">Spoznajte funkcionalnosti aplikacije</p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                            aria-label="Zapri"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    <div className="space-y-8">
                        {/* Kaj prikazuje aplikacija */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                                    </svg>
                                </div>
                                Kaj prikazuje aplikacija?
                            </h3>
                            <ul className="space-y-3 text-gray-600 mb-6">
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                    <span><strong>Nepremičnine</strong> - prodajne in najemne cene stanovanj in hiš v Sloveniji</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                    <span><strong>Občine in katastri</strong> - Navigiranje po občinah in katastrih</span>
                                </li>
                                <li className="flex items-start">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                                    <span><strong>Interaktivni zemljevid</strong> - zoom, iskanje, filtriranje podatkov na zemljevidu</span>
                                </li>
                            </ul>

                            {/* Nasveti */}
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Koristni nasveti
                                </h4>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Približajte zemljevid za prikaz več nepremičnin</li>
                                    <li>• Preklapljajte med prodajnimi in najemnimi podatki</li>
                                    <li>• Uporabite statistika panel desno spodaj za analizo trga</li>
                                </ul>
                            </div>
                        </div>

                        {/* Kako uporabljati */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                Kako uporabljati?
                            </h3>
                            {/* Grid layout za boxe */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center mb-2">
                                        <span className="text-lg mr-2">🔍</span>
                                        <h4 className="font-medium text-gray-800">Iskanje</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">Uporabite iskalno polje za iskanje lokacij in naslovov</p>
                                    <img 
                                        src="/Iskalnik.PNG" 
                                        alt="Iskanje interface"
                                        className="w-full object-contain rounded border shadow-sm"
                                        style={{ maxHeight: '300px' }}
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center mb-2">
                                        <span className="text-lg mr-2">🏠</span>
                                        <h4 className="font-medium text-gray-800">Nepremičnine</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">Kliknite na krogce za podrobnosti nepremičnine</p>
                                    <img 
                                        src="/Nepremičnina.PNG" 
                                        alt="Podrobnosti nepremičnine"
                                        className="w-full object-contain rounded border shadow-sm"
                                        style={{ maxHeight: '300px' }}
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center mb-2">
                                        <span className="text-lg mr-2">⚙️</span>
                                        <h4 className="font-medium text-gray-800">Filtri</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">Filtrirajte po ceni, velikosti in tipu nepremičnine</p>
                                    <img 
                                        src="/Filter.PNG" 
                                        alt="Filtri interface"
                                        className="w-full object-contain rounded border shadow-sm"
                                        style={{ maxHeight: '300px' }}
                                    />
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center mb-2">
                                        <span className="text-lg mr-2">📊</span>
                                        <h4 className="font-medium text-gray-800">Statistike</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">S klikom na občino ali kataster navigiraj do nepremičnin in pridobi statistike</p>
                                    <img 
                                        src="/StatistikaPanel.PNG" 
                                        alt="Statistike panel"
                                        className="w-full object-contain rounded border shadow-sm"
                                        style={{ maxHeight: '300px' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 rounded-b-xl">
                    <button
                        onClick={handleClose}
                        className="w-full text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center hover:opacity-90"
                        style={{ backgroundColor: 'rgba(37, 99, 235, 0.8)' }}
                    >
                        <span>Razumem, začnimo!</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}