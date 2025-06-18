import React, { useState, useEffect, useRef } from 'react';
import { getDaBoljNe, getNeBoljDa, getVrstaDelaStavbe, getGradebnaFaza, getStopnjaDDV, getCasNajemanja, getTrznostPosla, getVrstaAkta, getVrstaNajemnegaPosla, getVrstaProdajnegaPosla, getEnergyClassColor, getColorClasses, getNaslov, getNaslovDodatek, getCeloStDelaStavbe } from './PodrobnostiHelper.jsx';

export default function Podrobnosti({ propertyId, dataSource = 'np', onClose }) {
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [error, setError] = useState(null);
  const [selectedEnergyIndex, setSelectedEnergyIndex] = useState(0);
  const [selectedPoselId, setSelectedPoselId] = useState(null);

  const poselRefs = useRef({});


  useEffect(() => {

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
          selectPosel(sortedPosli[0].posel_id);
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

  const formatPrice = (price) => {
    if (!price) return null;
    return Math.round(price).toLocaleString('sl-SI');
  };

  const getPriceLabel = () => {
    return dataSource === 'kpp' ? 'Cena' : 'Najemnina';
  };

  const selectPosel = (poselId) => {
    setSelectedPoselId(poselId);

    if (poselRefs.current[poselId]) {
      poselRefs.current[poselId].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  };

  const getRepresentativeProperty = () => {
    if (!property) return null;

    // Če je posel izbran, poišči povezan del stavbe, ki se ujema s trenutnim reprezentativnim
    if (selectedPoselId && property.reprezentativni_del_stavbe) {
      const povezaniDeli = getConnectedBuildingParts(selectedPoselId);

      // Poišči povezan del, ki se ujema z identifikatorji reprezentativne nepremičnine
      const ujemajociDel = povezaniDeli.find(del =>
        del.sifra_ko === property.reprezentativni_del_stavbe.sifra_ko &&
        del.stevilka_stavbe === property.reprezentativni_del_stavbe.stevilka_stavbe &&
        del.stevilka_dela_stavbe === property.reprezentativni_del_stavbe.stevilka_dela_stavbe
      );

      if (ujemajociDel) {
        return ujemajociDel;
      }
    }

    // Rezerva na originalno reprezentativno nepremičnino
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

  const colors = getColorClasses(dataSource);
  const representativeProperty = getRepresentativeProperty();
  const selectedPosel = getSelectedPosel();
  const connectedParts = selectedPosel ? getConnectedBuildingParts(selectedPosel.posel_id) : [];

  // Filtriraj povezane dele stavb, ki niso glavni del stavbe
  const filteredConnectedParts = connectedParts.filter(part =>
    part.stevilka_dela_stavbe !== representativeProperty?.stevilka_dela_stavbe
  );

  const DetailRow = ({ label, value, className = '' }) => {
    const isInvalid =
      value === undefined ||
      value === null ||
      value === '' ||
      (typeof value === 'string' &&
        (value.toLowerCase().includes('null') || value.toLowerCase().includes('undefined')));

    if (isInvalid) return null;

    return (
      <div className="flex justify-between"> {/* Sprememba tukaj */}
        <div className="text-gray-600">{label}:</div>
        <div className={`font-medium text-gray-800 ${className}`}>{value}</div>
      </div>
    );
  };


  return (
    <div className="fixed inset-x-0 top-29 bottom-3 z-50 flex justify-center">
      <div className="absolute inset-0"></div>
      <div className="relative rounded-lg shadow-xl w-full max-w-7xl h-full overflow-hidden border border-gray-200 flex flex-col">
        <div className="relative backdrop-blur">
          <div className={`absolute inset-0 ${colors.headerBg} opacity-80`}></div>
          <div className={`relative ${colors.headerText} p-6 border-b border-gray-200`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {loading ? 'Nalaganje...' : getNaslov(representativeProperty) || 'Nepremičnina'}
                </h2>
                {!loading && representativeProperty && (
                  <>
                    <div className="mt-2 text-gray-700 text-lg">
                      {getNaslovDodatek(representativeProperty)}
                    </div>
                    <div className="mt-2 text-gray-700 text-lg">
                      {getCeloStDelaStavbe(representativeProperty)}
                    </div>
                  </>
                )}
              </div>

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

        <div className="flex flex-1 bg-white min-h-0">
          {loading ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 m-80 border-gray-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8 w-full">{error}</div>
          ) : (
            <>
              <div className="flex-1 p-3 overflow-y-auto min-h-0">
                <div className="space-y-3">

                  <div className="w-full">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h3 className="font-bold text-lg text-gray-800 mb-3">Podrobne informacije</h3>
                      <div className="space-y-4">

                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-md">Dimenzije</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
                            {(representativeProperty.povrsina_uradna || representativeProperty.povrsina_pogodba) && (
                              <div className='flex justify-between'>
                                <div className="text-gray-600">Površina uradna / pogodba:</div>
                                <div className="font-medium text-gray-800">
                                  {representativeProperty.povrsina_uradna && `${representativeProperty.povrsina_uradna} m²`}
                                  {representativeProperty.povrsina_uradna && representativeProperty.povrsina_pogodba && ' / '}
                                  {representativeProperty.povrsina_pogodba && `${representativeProperty.povrsina_pogodba} m²`}
                                </div>
                              </div>
                            )}

                            {(representativeProperty.povrsina_uporabna_uradna || representativeProperty.povrsina_uporabna_pogodba) && (
                              <div className='flex justify-between'>
                                <div className="text-gray-600">Uporabna površina uradna / pogodba:</div>
                                <div className="font-medium text-gray-800">
                                  {representativeProperty.povrsina_uporabna_uradna && `${representativeProperty.povrsina_uporabna_uradna} m²`}
                                  {representativeProperty.povrsina_uporabna_uradna && representativeProperty.povrsina_uporabna_pogodba && ' / '}
                                  {representativeProperty.povrsina_uporabna_pogodba && `${representativeProperty.povrsina_uporabna_pogodba} m²`}
                                </div>
                              </div>
                            )}

                            <DetailRow label="Število sob" value={representativeProperty.stevilo_sob} />
                            <DetailRow label="Nadstropje" value={representativeProperty.nadstropje} />
                            <DetailRow label="Lega v stavbi" value={representativeProperty.lega_v_stavbi} />

                            {dataSource === 'np' && (
                              <DetailRow label="Opremljenost" value={getDaBoljNe(representativeProperty.opremljenost)} />
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-md">Tip nepremičnine</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
                            <DetailRow label="Vrsta" value={getVrstaDelaStavbe(representativeProperty.vrsta_nepremicnine)} />
                            <DetailRow label="Dejanska raba" value={representativeProperty.dejanska_raba} />
                            <DetailRow label="Prodani delež" value={representativeProperty.prodani_delez} />
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-md">Prostori</h4>
                          {representativeProperty.prostori && representativeProperty.prostori !== '-' && (
                            <div className="mb-2">
                              <div className="font-medium text-gray-800 text-sm leading-relaxed bg-white p-2 rounded border border-gray-200">
                                {representativeProperty.prostori}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="font-semibold text-gray-800 mb-2 text-md">Podatki o stavbi</h4>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
                            <DetailRow label="Leto izgradnje" value={representativeProperty.leto_izgradnje_stavbe} />
                            <DetailRow label="Stavba dokončana" value={getNeBoljDa(representativeProperty.stavba_je_dokoncana)} />
                            <DetailRow label="Novogradnja" value={getDaBoljNe(representativeProperty.novogradnja)} />
                            <DetailRow label="Gradbena faza" value={getGradebnaFaza(representativeProperty.gradbena_faza)} />
                            <DetailRow label="Leto podatka" value={representativeProperty.leto} />
                          </div>
                        </div>

                        {(representativeProperty.pogodbena_cena || representativeProperty.stopnja_ddv) && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2 text-md">Finančni podatki</h4>
                            <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-sm">
                              <DetailRow label="Pogodbena cena" value={`${formatPrice(representativeProperty.pogodbena_cena)} €`} />
                              <DetailRow label="Stopnja DDV" value={getStopnjaDDV(representativeProperty.stopnja_ddv)} />
                            </div>
                          </div>
                        )}

                        {(representativeProperty.opombe) && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-2 text-md">Opombe</h4>

                            {representativeProperty.opombe && (
                              <div className="mb-2">
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

                  {!loading && property?.energetske_izkaznice && property.energetske_izkaznice.length > 0 && (
                    <div className="w-full">
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <h3 className="font-bold text-lg text-gray-800 mb-3">Energetska izkaznica</h3>

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

                        {(() => {
                          const selectedEI = property.energetske_izkaznice[selectedEnergyIndex];
                          if (!selectedEI) return null;

                          return (
                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm items-center">
                              <DetailRow label="Id" value={selectedEI.ei_id} />
                              <div className="flex justify-between items-center">
                                <div className="text-gray-600">Energijski razred:</div>
                                <div className={`font-medium px-2 py-1 rounded text-center min-w-[60px] flex items-center justify-center ${getEnergyClassColor(selectedEI.energijski_razred)}`}>
                                  {selectedEI.energijski_razred}
                                </div>
                              </div>
                              <DetailRow label="Datum izdelave" value={new Date(selectedEI.datum_izdelave).toLocaleDateString('sl-SI')} />
                              <DetailRow label="Velja do" value={new Date(selectedEI.velja_do).toLocaleDateString('sl-SI')} />
                              <DetailRow label="Primarna energija" value={`${Math.round(selectedEI.primarna_energija)} kWh/m²a`} />
                              <DetailRow label="Emisije CO₂" value={`${Math.round(selectedEI.emisije_co2)} kg/m²a`} />
                              <DetailRow label="Kond. površina" value={`${selectedEI.kondicionirana_povrsina} m²`} />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {!loading && (!property?.energetske_izkaznice || property.energetske_izkaznice.length === 0) && (
                    <div className="w-full">
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="text-center py-2 text-gray-500 text-sm">
                          Za ta del stavbe ni na voljo energetske izkaznice
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPosel && filteredConnectedParts.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg text-gray-800 mb-4">
                        Dodatni deli stavb vključeni v posel ({filteredConnectedParts.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredConnectedParts.map((part) => (
                          <div key={part.del_stavbe_id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="space-y-2">
                              <div className="font-medium text-gray-800 border-b border-gray-300 pb-2">
                                Del stavbe {part.stevilka_dela_stavbe}
                              </div>

                              <div className="grid grid-cols-1 gap-y-1 gap-x-2 text-sm">
                                <DetailRow label="Površina uradna" value={part.povrsina_uradna && `${part.povrsina_uradna} m²`} />
                                <DetailRow label="Površina pogodba" value={part.povrsina_pogodba && `${part.povrsina_pogodba} m²`} />
                                <DetailRow label="Uporabna ur." value={part.povrsina_uporabna_uradna && `${part.povrsina_uporabna_uradna} m²`} />
                                <DetailRow label="Uporabna pog." value={part.povrsina_uporabna_pogodba && `${part.povrsina_uporabna_pogodba} m²`} />
                                <DetailRow label="Število sob" value={part.stevilo_sob > 0 ? part.stevilo_sob : null} />
                                <DetailRow label="Nadstropje" value={part.nadstropje} />
                                <DetailRow label="Lega" value={part.lega_v_stavbi} />
                                <DetailRow label="Vrsta" value={getVrstaDelaStavbe(part.vrsta_nepremicnine)} />
                                <DetailRow label="Opremljenost" value={getDaBoljNe(part.opremljenost)} />
                                <DetailRow label="Prodani delež" value={part.prodani_delez} />
                                <DetailRow label="Št. stanovanja" value={part.stev_stanovanja} />
                                <DetailRow label="Leto izgradnje" value={part.leto_izgradnje_stavbe} />
                                <DetailRow label="Stavba dokončana" value={getNeBoljDa(part.stavba_je_dokoncana)} />
                                <DetailRow label="Novogradnja" value={getDaBoljNe(part.novogradnja)} />
                                <DetailRow label="Gradbena faza" value={getGradebnaFaza(part.gradbena_faza)} />
                                <DetailRow label="Št. stavbe" value={part.stevilka_stavbe} />
                                <DetailRow label="Šifra KO" value={part.sifra_ko} />
                                <DetailRow label="Ime KO" value={part.ime_ko} />
                                <DetailRow label="Naselje" value={part.naselje} />
                                <DetailRow label="Pogodbena cena" value={part.pogodbena_cena && `${formatPrice(part.pogodbena_cena)} €`} />
                                <DetailRow label="Stopnja DDV" value={getStopnjaDDV(part.stopnja_ddv)} />
                                <DetailRow label="Leto" value={part.leto} />
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

                  <div>
                    <h3 className="font-bold text-lg text-gray-800 mb-4">Podobne nepremičnine</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

              {property.povezani_posli && property.povezani_posli.length > 0 && (
                <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto min-h-0 flex flex-col">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 sticky top-0">
                    <h3 className="font-bold text-lg text-gray-800">
                      Posli ({property.povezani_posli.length})
                    </h3>
                  </div>
                  <div className="p-2 space-y-3 flex-1">
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
                            ref={el => poselRefs.current[posel.posel_id] = el}
                            onClick={() => selectPosel(posel.posel_id)}
                            className={`rounded-lg cursor-pointer transition-colors ${isSelected
                              ? 'bg-gray-200 border-2 border-gray-600 p-3'
                              : 'bg-white hover:bg-gray-100 border border-gray-300 p-3 m-px mb-3'
                              }`}
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-800">
                                  {posel.datum_sklenitve && new Date(posel.datum_sklenitve).toLocaleDateString('sl-SI') || 'Neznano leto'}
                                </span>
                                {isSelected && (
                                  <span className="text-gray-800 text-sm font-medium">Izbrano</span>
                                )}
                              </div>

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
                                      <span className="font-medium text-gray-800">{getDaBoljNe(posel.vkljuceno_ddv)}</span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.vkljuceno_stroski !== null && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Vključeni stroški:</span>
                                      <span className="font-medium text-gray-800">{getDaBoljNe(posel.vkljuceno_stroski)}</span>
                                    </div>
                                  )}

                                  {dataSource === 'np' && posel.stopnja_ddv && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Stopnja DDV:</span>
                                      <span className="font-medium text-gray-800">{getStopnjaDDV(posel.stopnja_ddv)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-gray-50 p-2 rounded text-sm">
                                <h5 className="font-semibold text-gray-800 mb-2">Podatki o poslu</h5>
                                <div className="grid grid-cols-1 gap-x-2 gap-y-1 text-sm">
                                  <DetailRow label="Datum sklenitve" value={posel.datum_sklenitve && new Date(posel.datum_sklenitve).toLocaleDateString('sl-SI')} />
                                  <DetailRow label="Datum uveljavitve" value={posel.datum_uveljavitve && new Date(posel.datum_uveljavitve).toLocaleDateString('sl-SI')} />
                                  <DetailRow label="Zadnja uveljavitev" value={posel.datum_zadnje_uveljavitve && new Date(posel.datum_zadnje_uveljavitve).toLocaleDateString('sl-SI')} />
                                  <DetailRow label="Zadnja sprememba" value={posel.datum_zadnje_spremembe && new Date(posel.datum_zadnje_spremembe).toLocaleDateString('sl-SI')} />
                                  {dataSource === 'np' && (
                                    <>
                                      <DetailRow label="Začetek najema" value={posel.datum_zacetka_najemanja && new Date(posel.datum_zacetka_najemanja).toLocaleDateString('sl-SI')} />
                                      <DetailRow label="Prenehanje najema" value={posel.datum_prenehanja_najemanja && new Date(posel.datum_prenehanja_najemanja).toLocaleDateString('sl-SI')} />
                                      <DetailRow label="Zaključek najema" value={posel.datum_zakljucka_najema && new Date(posel.datum_zakljucka_najema).toLocaleDateString('sl-SI')} />
                                      <DetailRow label="Čas najemanja" value={getCasNajemanja(posel.cas_najemanja)} />
                                      <DetailRow label="Trajanje najema" value={posel.trajanje_najemanja && `${posel.trajanje_najemanja} mesecev`} />
                                    </>
                                  )}
                                  {dataSource === 'np' ? (
                                    <DetailRow label="Vrsta posla" value={getVrstaNajemnegaPosla(posel.vrsta_posla)} />
                                  ) : ( // kpp
                                    <DetailRow label="Vrsta posla" value={getVrstaProdajnegaPosla(posel.vrsta_posla)} />
                                  )}
                                  <DetailRow label="Vrsta akta" value={getVrstaAkta(posel.vrsta_akta)} />
                                  <DetailRow label="Tržnost posla" value={getTrznostPosla(posel.trznost_posla)} />
                                  <DetailRow label="Delov stavb" value={getConnectedBuildingParts(posel.posel_id).length} />
                                </div>
                              </div>

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