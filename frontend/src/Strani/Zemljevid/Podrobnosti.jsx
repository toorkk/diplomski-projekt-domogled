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

  // Šifranti za pretvorbo kodiranih vrednosti
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

  const getVrstaDelaStavbe = (vrsta) => {
    const vrstaMap = {
      '1': 'Stanovanjska hiša',
      '2': 'Stanovanje',
      '3': 'Parkirni prostor',
      '4': 'Garaža',
      '5': 'Pisarniški prostori',
      '6': 'Prostori za poslovanje s strankami',
      '7': 'Prostori za zdravstveno dejavnost',
      '8': 'Trgovski ali storitveni lokal',
      '9': 'Gostinski lokal',
      '10': 'Prostori za šport, kulturo ali izobraževanje',
      '11': 'Industrijski prostori',
      '12': 'Turistični nastanitveni objekt',
      '13': 'Kmetijski objekt',
      '14': 'Tehnični ali pomožni prostori',
      '15': 'Drugo'
    };
    return vrstaMap[vrsta] || `Vrsta ${vrsta}`;
  };

  const getGradebnaFaza = (faza) => {
    const fazaMap = {
      '1': 'I. gradbena faza',
      '2': 'II. gradbena faza',
      '3': 'III. gradbena faza',
      '4': 'III. podaljšana faza',
      '5': 'IV. gradbena faza',
      '6': 'V. gradbena faza'
    };
    return fazaMap[faza] || `Faza ${faza}`;
  };

  const getStopnjaDDV = (stopnja) => {
    const stopnjaMap = {
      '1': '8,5%',
      '2': '20,0%',
      '3': '9,5%',
      '4': '22,0%',
      '5': 'Različne stopnje'
    };
    return stopnjaMap[stopnja] || `${stopnja}%`;
  };

  const getCasNajemanja = (cas) => {
    const casMap = {
      '1': 'Določen čas',
      '2': 'Nedoločen čas'
    };
    return casMap[cas] || `${cas}`;
  };

  const getVrstaAkta = (vrsta) => {
    const vrstMap = {
      '1': 'Osnovna pogodba',
      '2': 'Aneks k pogodbi'
    };
    return vrstMap[vrsta] || `${vrsta}`;
  };

  const getOpremljenost = (opremljenost) => {
    const opremljenostMap = {
      '1': 'Opremljeno',
      '2': 'Delno opremljeno', 
      '3': 'Neopremljeno'
    };
    return opremljenostMap[opremljenost] || `${opremljenost}`;
  };

  const getDaNe = (vrednost) => {
    return vrednost === 1 || vrednost === '1' ? 'Da' : 'Ne';
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

  const formatPrice = (price) => {
    if (!price) return null;
    return Math.round(price).toLocaleString('sl-SI');
  };

  const getPriceLabel = () => {
    return dataSource === 'kpp' ? 'Cena' : 'Najemnina';
  };

  // Pridobi najnovejše/reprezentativne podatke o delu_stavbe
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
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {loading ? 'Nalaganje...' : getNaslov() || 'Nepremičnina'}
                </h2>
                {!loading && representativeProperty && (
                  <div className="mt-2 text-gray-700 text-lg">
                    {getNaslovDodatek()}
                  </div>
                )}
              </div>

              {/* Energetske izkaznice v headerju */}
              {!loading && property?.energetske_izkaznice && property.energetske_izkaznice.length > 0 && (
                <div className="mx-6 bg-white bg-opacity-90 p-4 rounded-lg border border-gray-300 min-w-80">
                  <h3 className="font-bold text-gray-800 mb-3">Energetske izkaznice</h3>
                  
                  {/* Dropdown za izbiro izkaznice če je več kot ena */}
                  {property?.energetske_izkaznice?.length > 1 && (
                    <div className="mb-3">
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
                      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
                        {selectedEI.energijski_razred && (
                          <>
                            <div className="text-gray-600">Energijski razred:</div>
                            <div className={`inline-block px-3 py-1 rounded text-center font-bold text-lg ${getEnergyClassColor(selectedEI.energijski_razred)}`}>
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
                </div>
              )}

              {/* Če ni energetskih izkaznic */}
              {!loading && (!property?.energetske_izkaznice || property.energetske_izkaznice.length === 0) && (
                <div className="mx-6 bg-white bg-opacity-60 p-4 rounded-lg border border-gray-300 min-w-60">
                  <h3 className="font-bold text-gray-800 mb-2">Energetske izkaznice</h3>
                  <div className="text-center py-2 text-gray-500 text-sm">
                    Za ta del stavbe ni na voljo energetske izkaznice
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="text-gray-600 hover:bg-gray-200 rounded-full w-10 h-10 flex items-center justify-center transition-colors ml-4"
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

                  {/* Zgornji del - podrobne informacije preko celotne širine */}
                  <div className="w-full">
                    {/* Podrobne informacije */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h3 className="font-bold text-lg text-gray-800 mb-3">Podrobne informacije</h3>
                      <div className="space-y-4">
                        
                        {/* Osnovne dimenzije */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Dimenzije in prostori</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                            {(representativeProperty.povrsina_uradna || representativeProperty.povrsina_pogodba) && (
                              <>
                                <div className="text-gray-600">Površina uradna/pogodba:</div>
                                <div className="font-medium text-gray-800">
                                  {representativeProperty.povrsina_uradna && `${representativeProperty.povrsina_uradna} m²`}
                                  {representativeProperty.povrsina_uradna && representativeProperty.povrsina_pogodba && ' / '}
                                  {representativeProperty.povrsina_pogodba && `${representativeProperty.povrsina_pogodba} m²`}
                                </div>
                              </>
                            )}

                            {(representativeProperty.povrsina_uporabna_uradna || representativeProperty.povrsina_uporabna_pogodba) && (
                              <>
                                <div className="text-gray-600">Uporabna površina ur./pog.:</div>
                                <div className="font-medium text-gray-800">
                                  {representativeProperty.povrsina_uporabna_uradna && `${representativeProperty.povrsina_uporabna_uradna} m²`}
                                  {representativeProperty.povrsina_uporabna_uradna && representativeProperty.povrsina_uporabna_pogodba && ' / '}
                                  {representativeProperty.povrsina_uporabna_pogodba && `${representativeProperty.povrsina_uporabna_pogodba} m²`}
                                </div>
                              </>
                            )}

                            {representativeProperty.stevilo_sob && (
                              <>
                                <div className="text-gray-600">Število sob:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.stevilo_sob}</div>
                              </>
                            )}

                            {representativeProperty.stev_stanovanja && (
                              <>
                                <div className="text-gray-600">Št. stanovanja:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.stev_stanovanja}</div>
                              </>
                            )}

                            {representativeProperty.nadstropje && (
                              <>
                                <div className="text-gray-600">Nadstropje:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.nadstropje}</div>
                              </>
                            )}

                            {representativeProperty.lega_v_stavbi && (
                              <>
                                <div className="text-gray-600">Lega v stavbi:</div>
                                <div className="font-medium text-gray-800 capitalize">{representativeProperty.lega_v_stavbi}</div>
                              </>
                            )}

                            {representativeProperty.opremljenost && (
                              <>
                                <div className="text-gray-600">Opremljenost:</div>
                                <div className="font-medium text-gray-800">{getOpremljenost(representativeProperty.opremljenost)}</div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Identifikacijski podatki */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Identifikacijski podatki</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                            {representativeProperty.stevilka_stavbe && (
                              <>
                                <div className="text-gray-600">Št. stavbe:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.stevilka_stavbe}</div>
                              </>
                            )}

                            {representativeProperty.stevilka_dela_stavbe && (
                              <>
                                <div className="text-gray-600">Št. dela stavbe:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.stevilka_dela_stavbe}</div>
                              </>
                            )}

                            {representativeProperty.del_stavbe_id && (
                              <>
                                <div className="text-gray-600">ID dela stavbe:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.del_stavbe_id}</div>
                              </>
                            )}

                            {representativeProperty.sifra_ko && (
                              <>
                                <div className="text-gray-600">Šifra KO:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.sifra_ko}</div>
                              </>
                            )}

                            {representativeProperty.ime_ko && (
                              <>
                                <div className="text-gray-600">Ime KO:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.ime_ko}</div>
                              </>
                            )}

                            {representativeProperty.naselje && (
                              <>
                                <div className="text-gray-600">Naselje:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.naselje}</div>
                              </>
                            )}

                            {representativeProperty.coordinates && (
                              <>
                                <div className="text-gray-600">Koordinate:</div>
                                <div className="font-medium text-gray-800 text-xs">{representativeProperty.coordinates}</div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Tip in klasifikacija */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Tip nepremičnine</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                            {representativeProperty.tip_nepremicnine && (
                              <>
                                <div className="text-gray-600">Tip:</div>
                                <div className="font-medium text-gray-800 capitalize">{representativeProperty.tip_nepremicnine}</div>
                              </>
                            )}

                            {representativeProperty.vrsta && (
                              <>
                                <div className="text-gray-600">Vrsta:</div>
                                <div className="font-medium text-gray-800">{getVrstaDelaStavbe(representativeProperty.vrsta)}</div>
                              </>
                            )}

                            {representativeProperty.prodani_delez && (
                              <>
                                <div className="text-gray-600">Prodani delež:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.prodani_delez}</div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Podatki o stavbi */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-sm">Podatki o stavbi</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                            {representativeProperty.leto_izgradnje_stavbe && (
                              <>
                                <div className="text-gray-600">Leto izgradnje:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.leto_izgradnje_stavbe}</div>
                              </>
                            )}

                            {representativeProperty.stavba_je_dokoncana !== null && (
                              <>
                                <div className="text-gray-600">Stavba dokončana:</div>
                                <div className="font-medium text-gray-800">{getDaNe(representativeProperty.stavba_je_dokoncana)}</div>
                              </>
                            )}

                            {representativeProperty.novogradnja !== null && (
                              <>
                                <div className="text-gray-600">Novogradnja:</div>
                                <div className="font-medium text-gray-800">{getDaNe(representativeProperty.novogradnja)}</div>
                              </>
                            )}

                            {representativeProperty.gradbena_faza && (
                              <>
                                <div className="text-gray-600">Gradbena faza:</div>
                                <div className="font-medium text-gray-800">{getGradebnaFaza(representativeProperty.gradbena_faza)}</div>
                              </>
                            )}

                            {representativeProperty.leto && (
                              <>
                                <div className="text-gray-600">Leto podatka:</div>
                                <div className="font-medium text-gray-800">{representativeProperty.leto}</div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Finančni podatki */}
                        {(representativeProperty.pogodbena_cena || representativeProperty.stopnja_ddv || representativeProperty.posel_id) && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2 text-sm">Finančni podatki</h4>
                            <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                              {representativeProperty.pogodbena_cena && (
                                <>
                                  <div className="text-gray-600">Pogodbena cena:</div>
                                  <div className="font-medium text-gray-800">{formatPrice(representativeProperty.pogodbena_cena)} €</div>
                                </>
                              )}

                              {representativeProperty.stopnja_ddv && (
                                <>
                                  <div className="text-gray-600">Stopnja DDV:</div>
                                  <div className="font-medium text-gray-800">{getStopnjaDDV(representativeProperty.stopnja_ddv)}</div>
                                </>
                              )}

                              {representativeProperty.posel_id && (
                                <>
                                  <div className="text-gray-600">ID posla:</div>
                                  <div className="font-medium text-gray-800">{representativeProperty.posel_id}</div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Opisi */}
                        {(representativeProperty.dejanska_raba || representativeProperty.prostori || representativeProperty.opombe) && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2 text-sm">Opisi in opombe</h4>
                            
                            {representativeProperty.dejanska_raba && (
                              <div className="mb-2">
                                <div className="text-gray-600 text-sm mb-1">Dejanska raba:</div>
                                <div className="font-medium text-gray-800 text-sm leading-relaxed bg-white p-2 rounded border border-gray-200">
                                  {representativeProperty.dejanska_raba}
                                </div>
                              </div>
                            )}

                            {representativeProperty.prostori && representativeProperty.prostori !== '-' && (
                              <div className="mb-2">
                                <div className="text-gray-600 text-sm mb-1">Prostori:</div>
                                <div className="font-medium text-gray-800 text-sm leading-relaxed bg-white p-2 rounded border border-gray-200">
                                  {representativeProperty.prostori}
                                </div>
                              </div>
                            )}

                            {representativeProperty.opombe && (
                              <div className="mb-2">
                                <div className="text-gray-600 text-sm mb-1">Opombe:</div>
                                <div className="font-medium text-gray-800 text-sm leading-relaxed bg-white p-2 rounded border border-gray-200">
                                  {representativeProperty.opombe}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                      </div>
                    </div>
                  </div>

                  {/* Dodatni deli stavb za izbrani posel */}
                  {selectedPosel && filteredConnectedParts.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 mb-4">
                        Dodatni deli stavb za posel {selectedPosel.leto} ({filteredConnectedParts.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredConnectedParts.map((part) => (
                          <div key={part.del_stavbe_id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="space-y-2">
                              <div className="font-medium text-gray-800 border-b border-gray-300 pb-2">
                                Del stavbe {part.stevilka_dela_stavbe}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-sm">
                                {part.tip_nepremicnine && (
                                  <>
                                    <div className="text-gray-600">Tip:</div>
                                    <div className="font-medium text-gray-800 capitalize">{part.tip_nepremicnine}</div>
                                  </>
                                )}

                                {part.povrsina_uradna && (
                                  <>
                                    <div className="text-gray-600">Površina uradna:</div>
                                    <div className="font-medium text-gray-800">{part.povrsina_uradna} m²</div>
                                  </>
                                )}

                                {part.povrsina_pogodba && (
                                  <>
                                    <div className="text-gray-600">Površina pogodba:</div>
                                    <div className="font-medium text-gray-800">{part.povrsina_pogodba} m²</div>
                                  </>
                                )}

                                {part.povrsina_uporabna_uradna && (
                                  <>
                                    <div className="text-gray-600">Uporabna ur.:</div>
                                    <div className="font-medium text-gray-800">{part.povrsina_uporabna_uradna} m²</div>
                                  </>
                                )}

                                {part.povrsina_uporabna_pogodba && (
                                  <>
                                    <div className="text-gray-600">Uporabna pog.:</div>
                                    <div className="font-medium text-gray-800">{part.povrsina_uporabna_pogodba} m²</div>
                                  </>
                                )}

                                {part.stevilo_sob > 0 && (
                                  <>
                                    <div className="text-gray-600">Število sob:</div>
                                    <div className="font-medium text-gray-800">{part.stevilo_sob}</div>
                                  </>
                                )}

                                {part.nadstropje && (
                                  <>
                                    <div className="text-gray-600">Nadstropje:</div>
                                    <div className="font-medium text-gray-800">{part.nadstropje}</div>
                                  </>
                                )}

                                {part.lega_v_stavbi && (
                                  <>
                                    <div className="text-gray-600">Lega:</div>
                                    <div className="font-medium text-gray-800 capitalize">{part.lega_v_stavbi}</div>
                                  </>
                                )}

                                {part.vrsta && (
                                  <>
                                    <div className="text-gray-600">Vrsta:</div>
                                    <div className="font-medium text-gray-800">{getVrstaDelaStavbe(part.vrsta)}</div>
                                  </>
                                )}

                                {part.opremljenost && (
                                  <>
                                    <div className="text-gray-600">Opremljenost:</div>
                                    <div className="font-medium text-gray-800">{getOpremljenost(part.opremljenost)}</div>
                                  </>
                                )}

                                {part.prodani_delez && (
                                  <>
                                    <div className="text-gray-600">Prodani delež:</div>
                                    <div className="font-medium text-gray-800">{part.prodani_delez}</div>
                                  </>
                                )}

                                {part.stev_stanovanja && (
                                  <>
                                    <div className="text-gray-600">Št. stanovanja:</div>
                                    <div className="font-medium text-gray-800">{part.stev_stanovanja}</div>
                                  </>
                                )}

                                {part.leto_izgradnje_stavbe && (
                                  <>
                                    <div className="text-gray-600">Leto izgradnje:</div>
                                    <div className="font-medium text-gray-800">{part.leto_izgradnje_stavbe}</div>
                                  </>
                                )}

                                {part.stavba_je_dokoncana !== null && (
                                  <>
                                    <div className="text-gray-600">Stavba dokončana:</div>
                                    <div className="font-medium text-gray-800">{getDaNe(part.stavba_je_dokoncana)}</div>
                                  </>
                                )}

                                {part.novogradnja !== null && (
                                  <>
                                    <div className="text-gray-600">Novogradnja:</div>
                                    <div className="font-medium text-gray-800">{getDaNe(part.novogradnja)}</div>
                                  </>
                                )}

                                {part.gradbena_faza && (
                                  <>
                                    <div className="text-gray-600">Gradbena faza:</div>
                                    <div className="font-medium text-gray-800">{getGradebnaFaza(part.gradbena_faza)}</div>
                                  </>
                                )}

                                {part.stevilka_stavbe && (
                                  <>
                                    <div className="text-gray-600">Št. stavbe:</div>
                                    <div className="font-medium text-gray-800">{part.stevilka_stavbe}</div>
                                  </>
                                )}

                                {part.sifra_ko && (
                                  <>
                                    <div className="text-gray-600">Šifra KO:</div>
                                    <div className="font-medium text-gray-800">{part.sifra_ko}</div>
                                  </>
                                )}

                                {part.ime_ko && (
                                  <>
                                    <div className="text-gray-600">Ime KO:</div>
                                    <div className="font-medium text-gray-800">{part.ime_ko}</div>
                                  </>
                                )}

                                {part.naselje && (
                                  <>
                                    <div className="text-gray-600">Naselje:</div>
                                    <div className="font-medium text-gray-800">{part.naselje}</div>
                                  </>
                                )}

                                {part.pogodbena_cena && (
                                  <>
                                    <div className="text-gray-600">Pogodbena cena:</div>
                                    <div className="font-medium text-gray-800">{formatPrice(part.pogodbena_cena)} €</div>
                                  </>
                                )}

                                {part.stopnja_ddv && (
                                  <>
                                    <div className="text-gray-600">Stopnja DDV:</div>
                                    <div className="font-medium text-gray-800">{getStopnjaDDV(part.stopnja_ddv)}</div>
                                  </>
                                )}

                                {part.leto && (
                                  <>
                                    <div className="text-gray-600">Leto:</div>
                                    <div className="font-medium text-gray-800">{part.leto}</div>
                                  </>
                                )}

                                <>
                                  <div className="text-gray-600">ID dela:</div>
                                  <div className="font-medium text-gray-800 text-xs">{part.del_stavbe_id}</div>
                                </>
                              </div>

                              {part.dejanska_raba && (
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <div className="text-gray-600 text-xs mb-1">Dejanska raba:</div>
                                  <div className="text-gray-800 text-xs leading-tight">{part.dejanska_raba}</div>
                                </div>
                              )}

                              {part.prostori && part.prostori !== '-' && (
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <div className="text-gray-600 text-xs mb-1">Prostori:</div>
                                  <div className="text-gray-800 text-xs leading-tight">{part.prostori}</div>
                                </div>
                              )}

                              {part.opombe && (
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <div className="text-gray-600 text-xs mb-1">Opombe:</div>
                                  <div className="text-gray-800 text-xs leading-tight">{part.opombe}</div>
                                </div>
                              )}

                              {/* Naslov in lokacija */}
                              {(part.ulica || part.hisna_stevilka || part.dodatek_hs) && (
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                  <div className="text-gray-600 text-xs mb-1">Naslov:</div>
                                  <div className="text-gray-800 text-xs">
                                    {[part.ulica, part.hisna_stevilka, part.dodatek_hs].filter(Boolean).join(' ')}
                                    {part.obcina && (
                                      <div className="text-gray-600">{part.obcina}</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
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

              {/* Desni del - seznam poslov z razširenimi podatki */}
              {property.povezani_posli && property.povezani_posli.length > 0 && (
                <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto">
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
                            <div className="space-y-3">
                              {/* Osnovna identifikacija posla */}
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-800">
                                  {posel.leto || 'Neznano leto'}
                                </span>
                                {isSelected && (
                                  <span className="text-gray-800 text-sm font-medium">Izbrano</span>
                                )}
                              </div>

                              {/* Finančni podatki */}
                              <div className="bg-gray-50 p-2 rounded text-sm">
                                <h5 className="font-semibold text-gray-800 mb-2">Finančni podatki</h5>
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">{getPriceLabel()}:</span>
                                    <span className="font-medium text-gray-800">
                                      {dataSource === 'kpp' ?
                                        (posel.cena ? `${formatPrice(posel.cena)} €` : 'Ni podatka') :
                                        (posel.najemnina ? `${formatPrice(posel.najemnina)} €` : 'Ni podatka')
                                      }
                                    </span>
                                  </div>

                                  {posel.vkljuceno_ddv !== null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Vključen DDV:</span>
                                      <span className="font-medium text-gray-800">{getDaNe(posel.vkljuceno_ddv)}</span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.vkljuceno_stroski !== null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Vključeni stroški:</span>
                                      <span className="font-medium text-gray-800">{getDaNe(posel.vkljuceno_stroski)}</span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.stopnja_ddv && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Stopnja DDV:</span>
                                      <span className="font-medium text-gray-800">{getStopnjaDDV(posel.stopnja_ddv)}</span>
                                    </div>
                                  )}

                                  {dataSource === 'kpp' && posel.trznost_posla && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Tržnost posla:</span>
                                      <span className="font-medium text-gray-800">{getTrznostPosla(posel.trznost_posla)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Podatki o poslu */}
                              <div className="bg-gray-50 p-2 rounded text-sm">
                                <h5 className="font-semibold text-gray-800 mb-2">Podatki o poslu</h5>
                                <div className="space-y-1">
                                  {posel.datum_sklenitve && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Datum sklenitve:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_sklenitve).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {posel.datum_uveljavitve && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Datum uveljavitve:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_uveljavitve).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {/* Najemni specifični podatki */}
                                  {dataSource === 'np' && posel.datum_zacetka_najemanja && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Začetek najema:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_zacetka_najemanja).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.datum_prenehanja_najemanja && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Prenehanje najema:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_prenehanja_najemanja).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.datum_zakljucka_najema && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Zaključek najema:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_zakljucka_najema).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.cas_najemanja && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Čas najemanja:</span>
                                      <span className="font-medium text-gray-800">{getCasNajemanja(posel.cas_najemanja)}</span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.trajanje_najemanja && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Trajanje najema:</span>
                                      <span className="font-medium text-gray-800">{posel.trajanje_najemanja} mesecev</span>
                                    </div>
                                  )}

                                  {posel.datum_zadnje_spremembe && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Zadnja sprememba:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_zadnje_spremembe).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {posel.datum_zadnje_uveljavitve && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Zadnja uveljavitev:</span>
                                      <span className="font-medium text-gray-800">
                                        {new Date(posel.datum_zadnje_uveljavitve).toLocaleDateString('sl-SI')}
                                      </span>
                                    </div>
                                  )}

                                  {posel.vrsta_posla && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Vrsta posla:</span>
                                      <span className="font-medium text-gray-800">{posel.vrsta_posla}</span>
                                    </div>
                                  )}

                                  {posel.vrsta_akta && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Vrsta akta:</span>
                                      <span className="font-medium text-gray-800">{getVrstaAkta(posel.vrsta_akta)}</span>
                                    </div>
                                  )}

                                  {posel.trznost_posla && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Tržnost posla:</span>
                                      <span className="font-medium text-gray-800">{getTrznostPosla(posel.trznost_posla)}</span>
                                    </div>
                                  )}

                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Delov stavb:</span>
                                    <span className="font-medium text-gray-800">{connectedPartsCount}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Opombe */}
                              {posel.opombe && (
                                <div className="bg-gray-50 p-2 rounded text-sm">
                                  <h5 className="font-semibold text-gray-800 mb-1">Opombe</h5>
                                  <p className="text-gray-600">{posel.opombe}</p>
                                </div>
                              )}
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