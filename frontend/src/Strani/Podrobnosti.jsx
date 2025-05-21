import React, { useState, useEffect } from 'react';

export default function Podrobnosti({ propertyId, onClose, initialData = null }) {
  const [loading, setLoading] = useState(!initialData);
  const [property, setProperty] = useState(initialData);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Če že imamo podatke, jih ne nalagamo ponovno
    if (initialData) {
      setProperty(initialData);
      setLoading(false);
      return;
    }

    // Funkcija za nalaganje podrobnosti
    const fetchPropertyDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/properties/${propertyId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        setProperty(data);
        setError(null);
      } catch (err) {
        console.error('Napaka pri nalaganju podrobnosti nepremičnine:', err);
        setError('Prišlo je do napake pri nalaganju podatkov. Poskusite ponovno.');
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [propertyId, initialData]);

  // Sestavljanje naslova
  const getFullAddress = () => {
    if (!property) return '';
    
    const parts = [];
    if (property.ulica) parts.push(property.ulica);
    if (property.hisna_stevilka) parts.push(property.hisna_stevilka);
    
    return parts.join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center top-20">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-auto">
        {/* Glava */}
        <div className="bg-[rgb(59,130,246)] text-white p-6 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">
                {loading ? 'Nalaganje...' : getFullAddress() || 'Nepremičnina'}
              </h2>
              {!loading && property && property.povrsina && (
                <div className="mt-2 text-white text-lg">
                  Površina: {property.povrsina} m²
                  {property.cena && <span className="ml-4">{property.cena.toLocaleString()} €</span>}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-black hover:bg-opacity-20 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Vsebina */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(59,130,246)]"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8">{error}</div>
          ) : (
            <div className="space-y-6">
              {/* Zgornji del - razdeljen v tri stolpce */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Stroški */}
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Stroški</h3>
                  <div className="space-y-2">
                    {/* Tu dodajte vaše podatke o stroških */}
                    <div className="text-center py-4">
                      {/* Placeholder za vsebino */}
                    </div>
                  </div>
                </div>
                
                {/* Podrobne informacije */}
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Podrobne informacije</h3>
                  <div className="space-y-2">
                    {/* Osnovni podatki iz originalnega dizajna */}
                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                      {property.obcina && (
                        <>
                          <div className="text-gray-600">Občina:</div>
                          <div className="font-medium">{property.obcina}</div>
                        </>
                      )}
                      
                      {property.naselje && (
                        <>
                          <div className="text-gray-600">Naselje:</div>
                          <div className="font-medium">{property.naselje}</div>
                        </>
                      )}
                      
                      {/* Površino smo premaknili v glavo, lahko pa jo pustimo tudi tukaj */}
                      
                      {property.leto && (
                        <>
                          <div className="text-gray-600">Leto izgradnje:</div>
                          <div className="font-medium">{property.leto}</div>
                        </>
                      )}
                      
                      {property.dejanska_raba && (
                        <>
                          <div className="text-gray-600">Opis objekta:</div>
                          <div className="font-medium">{property.dejanska_raba}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Storitve v bližini */}
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Storitve v bližini</h3>
                  <div className="space-y-2">
                    {/* Tu dodajte vaše podatke o storitvah v bližini */}
                    <div className="text-center py-4">
                      {/* Placeholder za vsebino */}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Podobne nepremičnine */}
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-4">Podobne nepremičnine</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Podobna nepremičnina 1 */}
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <div className="space-y-2">
                      <div className="font-medium">Naslov: trg ob reki 3</div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>130m²</div>
                        <div>133k €</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>60km</div>
                        <div>En. raz.: B</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Podobna nepremičnina 2 */}
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <div className="space-y-2">
                      <div className="font-medium">Naslov: trg ob reki 3</div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>130m²</div>
                        <div>133k €</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>60km</div>
                        <div>En. raz.: B</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Podobna nepremičnina 3 */}
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <div className="space-y-2">
                      <div className="font-medium">Naslov: trg ob reki 3</div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>130m²</div>
                        <div>133k €</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>60km</div>
                        <div>En. raz.: B</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Podobna nepremičnina 4 */}
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <div className="space-y-2">
                      <div className="font-medium">Naslov: trg ob reki 3</div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>130m²</div>
                        <div>133k €</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        <div>60km</div>
                        <div>En. raz.: B</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Transakcije - ohranimo iz originalnega dizajna če so na voljo */}
              {property.transactions && property.transactions.length > 0 && (
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Transakcije</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Datum</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Cena</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Vrsta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {property.transactions.map((transaction, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                            <td className="px-4 py-2 text-sm">{new Date(transaction.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-sm">{transaction.price.toLocaleString()} €</td>
                            <td className="px-4 py-2 text-sm">{transaction.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Gumb za zapiranje */}
              <div className="mt-6 text-center">
                <button
                  onClick={onClose}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-6 rounded transition-colors duration-200"
                >
                  Zapri
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}