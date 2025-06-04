import React, { useState, useEffect } from 'react';

export default function Podrobnosti({ propertyId, dataSource = 'np', onClose }) {
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);
  const [selectedEnergyIndex, setSelectedEnergyIndex] = useState(0);
  const [selectedPoselId, setSelectedPoselId] = useState(null);

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

        // Če je več energetskih izkaznic, avtomatsko izberi najnovejšo
        if (data.properties.energetske_izkaznice && data.properties.energetske_izkaznice.length > 0) {
          // Najdi najnovejšo (največji datum_izdelave)
          const sortedByDate = [...data.properties.energetske_izkaznice].sort((a, b) => {
            if (!a.datum_izdelave) return 1;
            if (!b.datum_izdelave) return -1;
            return new Date(b.datum_izdelave) - new Date(a.datum_izdelave);
          });
          const latestIndex = data.properties.energetske_izkaznice.findIndex(
            ei => ei.id === sortedByDate[0].id
          );
          setSelectedEnergyIndex(latestIndex);
        }

        // Avtomatsko izberi najnovejši posel
        if (data.properties.povezani_posli && data.properties.povezani_posli.length > 0) {
          const sortedPosli = [...data.properties.povezani_posli].sort((a, b) => {
            if (!a.datum_sklenitve) return 1;
            if (!b.datum_sklenitve) return -1;
            return new Date(b.datum_sklenitve) - new Date(a.datum_sklenitve);
          });
          setSelectedPoselId(sortedPosli[0].posel_id);
        }
      } catch (err) {
        console.error('Napaka pri nalaganju podrobnosti nepremičnine:', err);
        setError('Prišlo je do napake pri nalaganju podatkov. Poskusite ponovno.');
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [propertyId, dataSource]);


  const getColorClasses = () => {
    const isNajem = dataSource === 'np';
    return {
      headerBg: isNajem ? 'bg-emerald-400' : 'bg-blue-300',
      headerText: 'text-gray-800'
    };
  };


  const getEnergyClassColor = (razred) => {
    const colors = {
      'A++': 'bg-gray-700 text-white',
      'A+': 'bg-gray-600 text-white',
      'A': 'bg-gray-500 text-white',
      'B': 'bg-gray-400 text-white',
      'C': 'bg-gray-300 text-gray-800',
      'D': 'bg-gray-200 text-gray-800',
      'E': 'bg-gray-100 text-gray-800',
      'F': 'bg-gray-50 text-gray-800',
      'G': 'bg-white text-gray-800 border border-gray-300'
    };
    return colors[razred] || 'bg-gray-400 text-white';
  };


  const getNaslov = () => {
    if (!representativeProperty) return '';

    const parts = [];
    if (representativeProperty.ulica) parts.push(representativeProperty.ulica);
    if (representativeProperty.hisna_stevilka) parts.push(representativeProperty.hisna_stevilka);
    if (representativeProperty.dodatek_hs) parts.push(representativeProperty.dodatek_hs);
    return parts.join(' ');
  };


  const getNaslovDodatek = () => {
    const naslovDodatek = [];
    if (representativeProperty.obcina) naslovDodatek.push(representativeProperty.obcina);
    if (representativeProperty.stev_stanovanja) naslovDodatek.push(`št. stan: ${representativeProperty.stev_stanovanja}`);

    return naslovDodatek.length > 0
      ? naslovDodatek.join(', ')
      : '';
  };

  const getTrznostPosla = (trznost) => {
    const trznostMap = {
      '1': 'Tržen posel',
      '2': 'Tržen posel - neustrezni podatki',
      '3': 'Drug posel',
      '4': 'Neopredeljen posel',
      '5': 'V preverjanju',
    };
    return trznostMap[trznost] || 'Neznana';
  };


  const formatPrice = (price) => {
    if (!price) return null;
    return Math.round(price).toLocaleString('sl-SI');
  };


  const getPriceLabel = () => {
    return dataSource === 'kpp' ? 'Cena' : 'Najemnina';
  };


  // Pridobi najnovejše/reprezentativne podatke o delu_stavbe. za zdaj malo nesmiselno. v prihodnosti za menjavo med prikazi istega dela stavbe skozi leta
  const getRepresentativeProperty = () => {
    if (!property) return null;

    return property.reprezentativni_del_stavbe;
  };


  // Funkcija za pridobivanje delov stavb povezanih s poslom
  const getConnectedBuildingParts = (poselId) => {
    if (!property.povezani_deli_stavb) return [];
    return property.povezani_deli_stavb.filter(del => del.posel_id === poselId);
  };


  const getSelectedPosel = () => {
    if (!property?.povezani_posli || !selectedPoselId) return null;
    return property.povezani_posli.find(posel => posel.posel_id === selectedPoselId);
  };


  const colors = getColorClasses();
  const representativeProperty = getRepresentativeProperty();
  const selectedPosel = getSelectedPosel();
  const connectedParts = selectedPosel ? getConnectedBuildingParts(selectedPosel.posel_id) : [];

  // Filtriraj povezane dele stavb, ki niso glavni del stavbe
  const filteredConnectedParts = connectedParts.filter(part =>
    part.stevilka_dela_stavbe !== representativeProperty?.stevilka_dela_stavbe
  );


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center top-30 mb-3">
      <div className="absolute inset-0"></div>
      <div className="relative rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden border border-gray-200">
        {/* Glava with dynamic colors */}
        <div className="relative backdrop-blur">
          <div className={`absolute inset-0 ${colors.headerBg} opacity-80`}></div>
          <div className={`relative ${colors.headerText} p-6 border-b border-gray-200`}>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">
                  {loading ? 'Nalaganje...' : getNaslov() || 'Nepremičnina'}
                </h2>
                {!loading && representativeProperty && (
                  <div className="mt-2 text-gray-700 text-lg">
                    {getNaslovDodatek()}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-600 hover:bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Vsebina */}
        <div className="flex h-[calc(90vh-140px)] bg-white">
          {loading ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8 w-full">{error}</div>
          ) : (
            <>
              {/* Levi del - glavne informacije */}
              <div className="flex-1 p-3 overflow-y-auto">
                <div className="space-y-3">

                  {/* Zgornji del - razdeljen v dva stolpca */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Podrobne informacije */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h3 className="font-bold text-lg text-gray-800 mb-3">Podrobne informacije</h3>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">

                          {representativeProperty.povrsina && (
                            <>
                              <div className="text-gray-600">Površina / Uporabna:</div>
                              <div className="font-medium text-gray-800">{representativeProperty.povrsina} m² / {representativeProperty.povrsina_uporabna} m²</div>
                            </>
                          )}

                          {representativeProperty.nadstropje && (
                            <>
                              <div className="text-gray-600">Nastropje:</div>
                              <div className="font-medium text-gray-800">{representativeProperty.nadstropje}</div>
                            </>
                          )}

                          {representativeProperty.stevilo_sob && (
                            <>
                              <div className="text-gray-600">Število sob:</div>
                              <div className="font-medium text-gray-800">{representativeProperty.stevilo_sob}</div>
                            </>
                          )}

                          {representativeProperty.leto_izgradnje_stavbe && (
                            <>
                            <div className="text-gray-600">Leto izgradnje:</div>
                            <div className="font-medium text-gray-800">{representativeProperty.leto_izgradnje_stavbe}</div>
                            </> 
                          )}

                          {representativeProperty.sifra_ko && (
                            <>
                              <div className="text-gray-600">Šifra KO:</div>
                              <div className="font-medium text-gray-800">{representativeProperty.sifra_ko}</div>
                            </>
                          )}

                          {representativeProperty.stevilka_stavbe && (
                            <>
                              <div className="text-gray-600">Št. stavbe:</div>
                              <div className="font-medium text-gray-800">{representativeProperty.stevilka_stavbe}</div>
                            </>
                          )}


                          <>
                            <div className="text-gray-600">Opis objekta:</div>
                            <div className="font-medium text-gray-800">{representativeProperty.dejanska_raba ? representativeProperty.dejanska_raba : 'Neznano'}</div>
                          </>
                          
                        </div>
                      </div>
                    </div>

                    {/* Energetske izkaznice */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h3 className="font-bold text-lg text-gray-800 mb-3">Energetske izkaznice</h3>
                      <div className="space-y-2">
                        {!property?.energetske_izkaznice || property.energetske_izkaznice.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">
                            Za ta del stavbe ni na voljo energetske izkaznice
                          </div>
                        ) : (
                          <>
                            {/* Dropdown za izbiro izkaznice če je več kot ena */}
                            {property?.energetske_izkaznice?.length > 1 && (
                              <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-600 mb-2">
                                  Izberi energetsko izkaznico ({property?.energetske_izkaznice?.length} na voljo):
                                </label>
                                <select
                                  value={selectedEnergyIndex}
                                  onChange={(e) => setSelectedEnergyIndex(parseInt(e.target.value))}
                                  className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                                >
                                  {property.energetske_izkaznice.map((ei, index) => (
                                    <option key={ei.id} value={index}>
                                      {ei.ei_id} - {ei.datum_izdelave ?
                                        new Date(ei.datum_izdelave).toLocaleDateString('sl-SI') :
                                        'Ni datuma'}
                                      {ei.energijski_razred && ` (${ei.energijski_razred})`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Prikaz izbrane energetske izkaznice */}
                            {(() => {
                              const selectedEI = property.energetske_izkaznice[selectedEnergyIndex];
                              if (!selectedEI) return null;

                              return (
                                <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                                  {selectedEI.energijski_razred && (
                                    <>
                                      <div className="text-gray-600">Energijski razred:</div>
                                      <div className={`inline-block px-2 py-1 rounded text-center font-bold ${getEnergyClassColor(selectedEI.energijski_razred)}`}>
                                        {selectedEI.energijski_razred}
                                      </div>
                                    </>
                                  )}

                                  {selectedEI.datum_izdelave && (
                                    <>
                                      <div className="text-gray-600">Datum izdelave:</div>
                                      <div className="font-medium text-gray-800">
                                        {new Date(selectedEI.datum_izdelave).toLocaleDateString('sl-SI')}
                                      </div>
                                    </>
                                  )}

                                  {selectedEI.velja_do && (
                                    <>
                                      <div className="text-gray-600">Velja do:</div>
                                      <div className="font-medium text-gray-800">
                                        {new Date(selectedEI.velja_do).toLocaleDateString('sl-SI')}
                                      </div>
                                    </>
                                  )}

                                  {selectedEI.primarna_energija && (
                                    <>
                                      <div className="text-gray-600">Primarna energija:</div>
                                      <div className="font-medium text-gray-800">{Math.round(selectedEI.primarna_energija)} kWh/m²a</div>
                                    </>
                                  )}

                                  {selectedEI.emisije_co2 && (
                                    <>
                                      <div className="text-gray-600">Emisije CO₂:</div>
                                      <div className="font-medium text-gray-800">{Math.round(selectedEI.emisije_co2)} kg/m²a</div>
                                    </>
                                  )}

                                  {selectedEI.kondicionirana_povrsina && (
                                    <>
                                      <div className="text-gray-600">Kond. površina:</div>
                                      <div className="font-medium text-gray-800">{selectedEI.kondicionirana_povrsina} m²</div>
                                    </>
                                  )}

                                  {selectedEI.ei_id && (
                                    <>
                                      <div className="text-gray-600">ID izkaznice:</div>
                                      <div className="font-medium text-gray-800 text-xs">{selectedEI.ei_id}</div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Podatki o izbranem poslu */}
                  {selectedPosel && (
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 mb-4">
                        Podatki o poslu ({selectedPosel.leto})
                      </h3>

                      <div className="mb-6 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        {/* Osnovni podatki o poslu */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                          {/* Finančni podatki */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2">Finančni podatki</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{getPriceLabel()}:</span>
                                <span className="font-medium text-gray-800">
                                  {dataSource === 'kpp' ?
                                    (selectedPosel.cena ? `${formatPrice(selectedPosel.cena)} €` : 'Ni podatka') :
                                    (selectedPosel.najemnina ? `${formatPrice(selectedPosel.najemnina)} €` : 'Ni podatka')
                                  }
                                </span>
                              </div>

                              {selectedPosel.vkljuceno_ddv !== null && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Vključen DDV:</span>
                                  <span className="font-medium text-gray-800">{selectedPosel.vkljuceno_ddv ? 'Da' : 'Ne'}</span>
                                </div>
                              )}

                              {dataSource === 'np' && selectedPosel.vkljuceno_stroski !== null && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Vključeni stroški:</span>
                                  <span className="font-medium text-gray-800">{selectedPosel.vkljuceno_stroski ? 'Da' : 'Ne'}</span>
                                </div>
                              )}

                              {dataSource === 'np' && selectedPosel.trajanje_najemanja && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Trajanje najema:</span>
                                  <span className="font-medium text-gray-800">{selectedPosel.trajanje_najemanja} mesecev</span>
                                </div>
                              )}

                              {dataSource === 'kpp' && selectedPosel.trznost_posla && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Tržnost posla:</span>
                                  <span className="font-medium text-gray-800">{getTrznostPosla(selectedPosel.trznost_posla)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Datumi in ostalo */}
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2">Podatki o poslu</h4>
                            <div className="space-y-1 text-sm">
                              {selectedPosel.datum_sklenitve && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Datum sklenitve:</span>
                                  <span className="font-medium text-gray-800">
                                    {new Date(selectedPosel.datum_sklenitve).toLocaleDateString('sl-SI')}
                                  </span>
                                </div>
                              )}

                              {selectedPosel.datum_uveljavitve && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Datum uveljavitve:</span>
                                  <span className="font-medium text-gray-800">
                                    {new Date(selectedPosel.datum_uveljavitve).toLocaleDateString('sl-SI')}
                                  </span>
                                </div>
                              )}

                              {selectedPosel.posredovanje_agencije !== null && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Agencija:</span>
                                  <span className="font-medium text-gray-800">{selectedPosel.posredovanje_agencije ? 'Da' : 'Ne'}</span>
                                </div>
                              )}

                              {selectedPosel.leto && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Leto:</span>
                                  <span className="font-medium text-gray-800">{selectedPosel.leto}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* opombe */}
                        {selectedPosel.opombe && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-800 mb-2">Opombe</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">{selectedPosel.opombe}</p>
                          </div>
                        )}

                        {/* Povezani deli stavb (izključujoč glavni del) */}
                        {filteredConnectedParts.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2">
                              Dodatni deli stavb ({filteredConnectedParts.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {filteredConnectedParts.map((part) => (
                                <div key={part.del_stavbe_id} className="bg-gray-50 p-3 rounded text-sm border border-gray-200">
                                  <div className="font-medium mb-2 text-gray-800">Del stavbe ID: {part.del_stavbe_id}</div>
                                  <div className="space-y-1">
                                    {part.stevilka_dela_stavbe && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Št. dela:</span>
                                        <span className="text-gray-800">{part.stevilka_dela_stavbe}</span>
                                      </div>
                                    )}
                                    {part.povrsina && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Površina:</span>
                                        <span className="text-gray-800">{part.povrsina} m²</span>
                                      </div>
                                    )}
                                    {part.stevilo_sob && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Sobe:</span>
                                        <span className="text-gray-800">{part.stevilo_sob}</span>
                                      </div>
                                    )}
                                    {part.nadstropje && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Nadstropje:</span>
                                        <span className="text-gray-800">{part.nadstropje}</span>
                                      </div>
                                    )}
                                    {part.prodana_povrsina && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Prodana površina:</span>
                                        <span className="text-gray-800">{part.prodana_povrsina} m²</span>
                                      </div>
                                    )}
                                    {part.prostori && (
                                      <div className="mt-2">
                                        <span className="text-gray-600">Prostori:</span>
                                        <div className="text-xs mt-1 text-gray-800">{part.prostori}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Podobne nepremičnine */}
                  <div>
                    <h3 className="font-bold text-lg text-gray-800 mb-4">Podobne nepremičnine</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Placeholder za podobne nepremičnine */}
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="space-y-2">
                          <div className="font-medium text-gray-800">Naslov: trg ob reki 3</div>
                          <div className="grid grid-cols-2 gap-1 text-sm">
                            <div className="text-gray-800">130m²</div>
                            <div className="text-gray-800">133k €</div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-sm">
                            <div className="text-gray-800">60km</div>
                            <div className="text-gray-800">En. raz.: B</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="space-y-2">
                          <div className="font-medium text-gray-800">Naslov: trg ob reki 3</div>
                          <div className="grid grid-cols-2 gap-1 text-sm">
                            <div className="text-gray-800">130m²</div>
                            <div className="text-gray-800">133k €</div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-sm">
                            <div className="text-gray-800">60km</div>
                            <div className="text-gray-800">En. raz.: B</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="space-y-2">
                          <div className="font-medium text-gray-800">Naslov: trg ob reki 3</div>
                          <div className="grid grid-cols-2 gap-1 text-sm">
                            <div className="text-gray-800">130m²</div>
                            <div className="text-gray-800">133k €</div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-sm">
                            <div className="text-gray-800">60km</div>
                            <div className="text-gray-800">En. raz.: B</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desni del - seznam poslov */}
              {property.povezani_posli && property.povezani_posli.length > 0 && (
                <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 sticky top-0">
                    <h3 className="font-bold text-lg text-gray-800">
                      Posli ({property.povezani_posli.length})
                    </h3>
                  </div>
                  <div className="p-2 space-y-3">
                    {property.povezani_posli
                      .sort((a, b) => {
                        if (!a.datum_sklenitve) return 1;
                        if (!b.datum_sklenitve) return -1;
                        return new Date(b.datum_sklenitve) - new Date(a.datum_sklenitve);
                      })
                      .map((posel) => {
                        const connectedPartsCount = getConnectedBuildingParts(posel.posel_id).length;
                        const isSelected = selectedPoselId === posel.posel_id;

                        return (
                          <div
                            key={posel.posel_id}
                            onClick={() => setSelectedPoselId(posel.posel_id)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${isSelected
                              ? 'bg-gray-200 border-2 border-gray-600'
                              : 'bg-white hover:bg-gray-100 border border-gray-300'
                              }`}
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-800">
                                  {posel.leto || 'Neznano leto'}
                                </span>
                                {isSelected && (
                                  <span className="text-gray-800 text-sm font-medium">Izbrano</span>
                                )}
                              </div>

                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{getPriceLabel()}:</span>
                                  <span className="font-medium text-gray-800">
                                    {dataSource === 'kpp' ?
                                      (posel.cena ? `${formatPrice(posel.cena)} €` : 'Ni podatka') :
                                      (posel.najemnina ? `${formatPrice(posel.najemnina)} €` : 'Ni podatka')
                                    }
                                  </span>
                                </div>

                                <div className="flex justify-between">
                                  <span className="text-gray-600">Delov stavb:</span>
                                  <span className="font-medium text-gray-800">{connectedPartsCount}</span>
                                </div>

                                {posel.datum_sklenitve && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Datum:</span>
                                    <span className="font-medium text-gray-800 text-xs">
                                      {new Date(posel.datum_sklenitve).toLocaleDateString('sl-SI')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}