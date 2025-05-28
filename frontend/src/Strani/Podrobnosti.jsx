import React, { useState, useEffect } from 'react';

export default function Podrobnosti({ propertyId, dataSource = 'np', onClose }) {
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {

    // Funkcija za nalaganje podrobnosti
    const fetchPropertyDetails = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/property-details/${propertyId}?data_source=${dataSource}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        setProperty(data.properties); // pridobi dele stavb
        setError(null);
      } catch (err) {
        console.error('Napaka pri nalaganju podrobnosti nepremičnine:', err);
        setError('Prišlo je do napake pri nalaganju podatkov. Poskusite ponovno.');
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [propertyId, dataSource]);

  // Sestavljanje naslova
  const getFullAddress = () => {
    if (!property) return '';
    
    const parts = [];
    if (property.ulica) parts.push(property.ulica);
    if (property.hisna_stevilka) parts.push(property.hisna_stevilka);
    if (property.dodatek_hs) parts.push(property.dodatek_hs);
    return parts.join(' ');
  };

  // Pridobivanje cene glede na data source
  const getPrice = () => {
    if (!property) return null;
    
    // Za deduplicirane nepremičnine pridobimo ceno iz zadnjega posla
    if (property.all_contracts && property.all_contracts.length > 0) {
      const latestContract = property.all_contracts[property.all_contracts.length - 1];
      
      if (dataSource === 'kpp') {
        return latestContract.cena;
      } else {
        return latestContract.najemnina;
      }
    }
    
    // Fallback = mogoce spremenit v prihodnosti
    const isKpp = dataSource === 'kpp';
    
    if (isKpp) {
      return property.cena || property.pogodbena_cena;
    } else {
      return property.najemnina;
    }
  };

  // Formatiranje cene
  const formatPrice = (price) => {
    if (!price) return null;
    return Math.round(price).toLocaleString('sl-SI');
  };

  // Določi tip podatkov za label
  const getPriceLabel = () => {
    return dataSource === 'kpp' ? 'Cena' : 'Najemnina';
  };

  // Pridobi najnovejše/reprezentativne podatke o delu_stavbe. za zdaj malo nesmiselno. v prihodnosti za menjavo med prikazi istega dela stavbe skozi leta
  const getRepresentativeProperty = () => {
    if (!property) return null;
    
    if (property.all_del_stavbe_records && property.all_del_stavbe_records.length > 0) {
      return property;
    }
    
    return property;
  };

  const representativeProperty = getRepresentativeProperty();

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
              {!loading && representativeProperty && (
                <div className="mt-2 text-white text-lg">
                  {representativeProperty.povrsina && (
                    <span>Površina: {representativeProperty.povrsina} m²</span>
                  )}
                  {getPrice() && (
                    <span className="ml-4">
                      {getPriceLabel()}: {formatPrice(getPrice())} €
                    </span>
                  )}
                  {property.stevilo_poslov > 1 && (
                    <span className="ml-4 bg-blue-600 px-2 py-1 rounded text-sm">
                      {property.stevilo_poslov}x poslov
                    </span>
                  )}
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
              {/* ko je več poslov warning */}
              {property.ima_vec_poslov && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                  <p className="font-medium">Ta nepremičnina ima {property.stevilo_poslov} poslov</p>
                  <p className="text-sm">Prikazani so podatki iz najnovejšega posla. Vsi posli so navedeni spodaj.</p>
                </div>
              )}

              {/* Zgornji del - razdeljen v tri stolpce */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Finančne informacije */}
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Finančne informacije</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                      {/* Cena */}
                      {getPrice() && (
                        <>
                          <div className="text-gray-600">{getPriceLabel()}:</div>
                          <div className="font-medium text-lg text-green-600">
                            {formatPrice(getPrice())} €
                          </div>
                        </>
                      )}
                      
                      {/* podatki za zadnji posel */}
                      {property.all_contracts && property.all_contracts.length > 0 && (() => {
                        const latestContract = property.all_contracts[property.all_contracts.length - 1];
                        return (
                          <>
                            {dataSource === 'np' && (
                              <>
                                {latestContract.vkljuceno_stroski !== null && (
                                  <>
                                    <div className="text-gray-600">Vključeni stroški:</div>
                                    <div className="font-medium">{latestContract.vkljuceno_stroski ? 'Da' : 'Ne'}</div>
                                  </>
                                )}
                                {latestContract.vkljuceno_ddv !== null && (
                                  <>
                                    <div className="text-gray-600">Vključen DDV:</div>
                                    <div className="font-medium">{latestContract.vkljuceno_ddv ? 'Da' : 'Ne'}</div>
                                  </>
                                )}
                                {latestContract.trajanje_najemanja && (
                                  <>
                                    <div className="text-gray-600">Trajanje najema:</div>
                                    <div className="font-medium">{latestContract.trajanje_najemanja} mesecev</div>
                                  </>
                                )}
                              </>
                            )}
                            
                            {dataSource === 'kpp' && (
                              <>
                                {latestContract.vkljuceno_ddv !== null && (
                                  <>
                                    <div className="text-gray-600">Vključen DDV:</div>
                                    <div className="font-medium">{latestContract.vkljuceno_ddv ? 'Da' : 'Ne'}</div>
                                  </>
                                )}
                                {latestContract.trznost_posla && (
                                  <>
                                    <div className="text-gray-600">Tržnost posla:</div>
                                    <div className="font-medium">{latestContract.trznost_posla}</div>
                                  </>
                                )}
                              </>
                            )}
                            
                            {latestContract.datum_sklenitve && (
                              <>
                                <div className="text-gray-600">Datum sklenitve:</div>
                                <div className="font-medium">
                                  {new Date(latestContract.datum_sklenitve).toLocaleDateString('sl-SI')}
                                </div>
                              </>
                            )}
                            
                            {latestContract.posredovanje_agencije !== null && (
                              <>
                                <div className="text-gray-600">Agencija:</div>
                                <div className="font-medium">{latestContract.posredovanje_agencije ? 'Da' : 'Ne'}</div>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Podrobne informacije */}
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Podrobne informacije</h3>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                      {representativeProperty.obcina && (
                        <>
                          <div className="text-gray-600">Občina:</div>
                          <div className="font-medium">{representativeProperty.obcina}</div>
                        </>
                      )}
                      
                      {representativeProperty.naselje && (
                        <>
                          <div className="text-gray-600">Naselje:</div>
                          <div className="font-medium">{representativeProperty.naselje}</div>
                        </>
                      )}
                      
                      {representativeProperty.povrsina && (
                        <>
                          <div className="text-gray-600">Površina:</div>
                          <div className="font-medium">{representativeProperty.povrsina} m²</div>
                        </>
                      )}
                      
                      {representativeProperty.stevilo_sob && (
                        <>
                          <div className="text-gray-600">Število sob:</div>
                          <div className="font-medium">{representativeProperty.stevilo_sob}</div>
                        </>
                      )}
                      
                      {representativeProperty.sifra_ko && (
                        <>
                          <div className="text-gray-600">Šifra KO:</div>
                          <div className="font-medium">{representativeProperty.sifra_ko}</div>
                        </>
                      )}
                      
                      {representativeProperty.stevilka_stavbe && (
                        <>
                          <div className="text-gray-600">Št. stavbe:</div>
                          <div className="font-medium">{representativeProperty.stevilka_stavbe}</div>
                        </>
                      )}
                      
                      {representativeProperty.dejanska_raba && (
                        <>
                          <div className="text-gray-600">Opis objekta:</div>
                          <div className="font-medium">{representativeProperty.dejanska_raba}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Storitve v bližini */}
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Storitve v bližini</h3>
                  <div className="space-y-2">
                    <div className="text-center py-4 text-gray-500">
                      Podatki o storitvah v bližini bodo dodani v prihodnje
                    </div>
                  </div>
                </div>
              </div>

              {/* vsi posli section */}
              {property.all_contracts && property.all_contracts.length > 1 && (
                <div className="bg-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Vsi posli ({property.all_contracts.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Datum sklenitve</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">{getPriceLabel()}</th>
                          {dataSource === 'np' && <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Trajanje</th>}
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Agencija</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {property.all_contracts.map((contract, index) => (
                          <tr key={contract.posel_id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                            <td className="px-4 py-2 text-sm">
                              {contract.datum_sklenitve ? 
                                new Date(contract.datum_sklenitve).toLocaleDateString('sl-SI') : 
                                'Ni podatka'
                              }
                            </td>
                            <td className="px-4 py-2 text-sm font-medium">
                              {dataSource === 'kpp' ? 
                                (contract.cena ? `${formatPrice(contract.cena)} €` : 'Ni podatka') :
                                (contract.najemnina ? `${formatPrice(contract.najemnina)} €` : 'Ni podatka')
                              }
                            </td>
                            {dataSource === 'np' && (
                              <td className="px-4 py-2 text-sm">
                                {contract.trajanje_najemanja ? `${contract.trajanje_najemanja} mes.` : 'Ni podatka'}
                              </td>
                            )}
                            <td className="px-4 py-2 text-sm">
                              {contract.posredovanje_agencije !== null ? 
                                (contract.posredovanje_agencije ? 'Da' : 'Ne') : 
                                'Ni podatka'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Podobne nepremičnine */}
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-4">Podobne nepremičnine</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Placeholder za podobne nepremičnine */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}