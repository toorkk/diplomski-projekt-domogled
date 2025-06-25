import { useState, useEffect, useRef } from 'react';
import { getDaBoljNe, getNeBoljDa, getVrstaDelaStavbe, getGradebnaFaza, getStopnjaDDV, getCasNajemanja, getTrznostPosla, getVrstaAkta, getVrstaNajemnegaPosla, getVrstaProdajnegaPosla, getEnergyClassColor, getColorClasses, getNaslov, getCeloStDelaStavbe } from './PodrobnostiHelper.jsx';
import { API_CONFIG } from './MapConstants.jsx';

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
        const response = await fetch(`${API_CONFIG.BASE_URL}/property-details/${propertyId}?data_source=${dataSource}`);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // izbere najnovejši posel
        if (data.properties.povezani_posli && data.properties.povezani_posli.length > 0) {
          selectPosel(data.properties.povezani_posli[0].posel_id);
        }

        setProperty(data.properties); // nastavi dele stavb

      } catch (err) {
        console.error('Napaka pri nalaganju podrobnosti nepremičnine:', err);
        setError('Prišlo je do napake pri nalaganju podatkov. Poskusite ponovno.');
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [propertyId, dataSource]);

  const getZadnjaCenaInfo = (posel) => {
    if (dataSource === 'kpp') {
      // KPP
      const cena = posel.cena;
      return {
        hasCena: !!cena,
        cenaText: cena ? `€${cena.toLocaleString('sl-SI')}` : null,
        cenaLabel: 'Prodajna cena:',
        ddvInfo: posel.vkljuceno_ddv ?
          `z DDV${posel.stopnja_ddv ? ` (${posel.stopnja_ddv}%)` : ' (% neznan)'}` :
          'brez DDV'

      };
    } else {
      // NP
      const najemnina = posel.najemnina;
      return {
        hasCena: !!najemnina,
        cenaText: najemnina ? `€${najemnina.toLocaleString('sl-SI')}/mesec` : null,
        cenaLabel: 'Najemnina:',
        ddvInfo: posel.vkljuceno_ddv ?
          `z DDV${posel.stopnja_ddv ? ` (${posel.stopnja_ddv}%)` : ''}` :
          'brez DDV',
        stroskiInfo: posel.vkljuceno_stroski ? 'stroški vključeni' : 'stroški niso vključeni'
      };
    }
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

  const formatPrice = (price) => {
    if (!price) return null;
    return Math.round(price).toLocaleString('sl-SI');
  };

  const formatirajDatum = (dateString) => {
    if (!dateString) return 'Neznano';

    const date = new Date(dateString);

    return date.toLocaleDateString('sl-SI', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRentalPeriod = (startDate, endDate) => {
    if (!startDate && !endDate) return 'Neznano obdobje';
    if (!startDate) return `Do ${formatirajDatum(endDate)}`;
    if (!endDate) return `Od ${formatirajDatum(startDate)}`;

    return `${formatirajDatum(startDate)} – ${formatirajDatum(endDate)}`;
  };

  const colors = getColorClasses(dataSource);
  const representativeProperty = getRepresentativeProperty();
  const selectedPosel = getSelectedPosel();
  const connectedParts = selectedPosel ? getConnectedBuildingParts(selectedPosel.posel_id) : [];
  // Filtriraj povezane dele stavb, ki niso glavni del stavbe
  const filteredConnectedParts = connectedParts.filter(part =>
    part.stevilka_dela_stavbe !== representativeProperty?.stevilka_dela_stavbe ||
    part.dejanska_raba !== representativeProperty?.dejanska_raba
  );
  const DetailRow = ({ label, value, className = '' }) => {
    const displayValue = value || 'N/A';

    return (
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}:</div>
        <div className={`text-sm font-semibold text-gray-800 ${className}`}>{displayValue}</div>
      </div>
    );
  };

  const EnergetskaIzkaznicaContainer = () => {
    if (!property?.energetske_izkaznice || property.energetske_izkaznice.length === 0) {
      return (
        <div className="bg-white border border-gray-300 rounded-lg p-3">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Energetska izkaznica</h4>
          <div className="text-center py-4 text-gray-500 text-sm">
            Za ta del stavbe ni na voljo energetske izkaznice
          </div>
        </div>
      );
    }

    const selectedEI = property.energetske_izkaznice?.[selectedEnergyIndex];
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-3">
        <h4 className="text-lg font-semibold text-gray-800 mb-3">Energetska izkaznica {selectedEI.ei_id ? ': ' + selectedEI.ei_id : ''}</h4>
        <div className="space-y-2">
          {property?.energetske_izkaznice?.length > 1 && (
            <div className="mb-3">
              <select
                value={selectedEnergyIndex}
                onChange={(e) => setSelectedEnergyIndex(parseInt(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                {property.energetske_izkaznice.map((ei, index) => (
                  <option key={ei.id} value={index}>
                    {ei.ei_id} - {ei.datum_izdelave ?
                      new Date(ei.datum_izdelave).toLocaleDateString('sl-SI') :
                      'Neznan datum'}
                    {ei.energijski_razred && ` (${ei.energijski_razred})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedEI && (
            <div className="bg-gray-50 p-2 rounded text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Razred:</div>
                  <div className={`font-medium px-2 py-1 rounded text-center min-w-[50px] text-sm ${getEnergyClassColor(selectedEI.energijski_razred)}`}>
                    {selectedEI.energijski_razred || 'N/A'}
                  </div>
                </div>
                <DetailRow label="Prim. energija" value={selectedEI.primarna_energija ? `${Math.round(selectedEI.primarna_energija)} kWh/m²a` : null} />
                <DetailRow label="CO₂ emisije" value={selectedEI.emisije_co2 ? `${Math.round(selectedEI.emisije_co2)} kg/m²a` : null} />
                <DetailRow label="Izdelano" value={selectedEI.datum_izdelave ? new Date(selectedEI.datum_izdelave).toLocaleDateString('sl-SI') : null} />
                <DetailRow label="Velja do" value={selectedEI.velja_do ? new Date(selectedEI.velja_do).toLocaleDateString('sl-SI') : null} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  //glavni return
  return (
    <div className="fixed inset-x-0 top-29 bottom-3 z-50 flex justify-center">
      <div className="absolute inset-0"></div>
      <div className="relative rounded-lg shadow-xl w-full max-w-7xl h-full overflow-hidden border border-gray-200 flex flex-col">

        {/* Header */}
        <div className="relative backdrop-blur">
          <div className={`absolute inset-0 ${colors.headerBg} opacity-80`}></div>
          <div className={`relative ${colors.headerText} p-4 border-b border-gray-200`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">
                  {loading ? 'Nalaganje...' : getNaslov(representativeProperty)}
                </h2>
                {!loading && (
                  <div className="mt-1 text-gray-800 font-semibold text-lg pt-2">
                    {getCeloStDelaStavbe(representativeProperty)}
                    {representativeProperty.stev_stanovanja && `, št. stanovanja: ${representativeProperty.stev_stanovanja}`}
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="text-gray-600 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors ml-4 flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 bg-gray-50 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 m-80 border-gray-600"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8 w-full">{error}</div>
          ) : (
            <>
              <div className="flex-1 p-4 overflow-y-auto min-h-0">
                <div className="max-w-5xl mx-auto space-y-4">

                  {/* Osnove podatki v kompaktni mreži */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* Dimenzije */}
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Dimenzije</h4>
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <DetailRow label="Površina" value={representativeProperty.povrsina_uradna ? `${representativeProperty.povrsina_uradna} m²` : null} />
                          <DetailRow label="Uporabna pov. " value={representativeProperty.povrsina_uporabna ? `${representativeProperty.povrsina_uporabna} m²` : null} />
                          {representativeProperty.stevilo_sob && (
                            <DetailRow label="Število sob" value={representativeProperty.stevilo_sob} />
                          )}
                          {representativeProperty.nadstropje && (
                            <DetailRow label="Nadstropje" value={representativeProperty.nadstropje} />
                          )}
                          <DetailRow label="Lega v stavbi" value={representativeProperty.lega_v_stavbi} />
                        </div>
                      </div>
                    </div>

                    {/* Tip nepremičnine */}
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Tip nepremičnine</h4>
                      <div className="bg-gray-50 p-2 rounded text-sm space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                          <DetailRow label="Vrsta" value={getVrstaDelaStavbe(representativeProperty.vrsta_nepremicnine)} />
                          {dataSource === 'kpp' && (
                            <DetailRow label="Prodani delež" value={representativeProperty.prodani_delez} />
                          )}
                          {dataSource === 'np' && (
                            <DetailRow label="Opremljenost" value={getDaBoljNe(representativeProperty.opremljenost)} />
                          )}
                        </div>
                        <DetailRow label="Dejanska raba" value={representativeProperty.dejanska_raba} />
                      </div>
                    </div>

                    {/* Prostori opis */}
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Opis prostorov</h4>
                      {representativeProperty.prostori && representativeProperty.prostori !== '-' && (

                        <div className="bg-gray-50 p-2 rounded text-sm text-gray-800 leading-relaxed">{representativeProperty.prostori}</div>
                      )}
                      {(!representativeProperty.prostori || representativeProperty.prostori == '-') &&
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Opis ni podan
                        </div>
                      }
                    </div>

                    {/* Druga vrstica */}

                    {/* Podatki o stavbi */}
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Podatki o stavbi</h4>
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        <div className="grid grid-cols-2 gap-6">
                          <DetailRow label="Leto izgradnje" value={representativeProperty.leto_izgradnje_stavbe} />
                          <DetailRow label="Novogradnja" value={getDaBoljNe(representativeProperty.novogradnja)} />
                          <DetailRow label="Stavba dokončana" value={getNeBoljDa(representativeProperty.stavba_je_dokoncana)} />
                          {representativeProperty.stavba_je_dokoncana == 0 ? <DetailRow label="Gradbena faza" value={getGradebnaFaza(representativeProperty.gradbena_faza)} /> : ''}
                        </div>
                      </div>
                    </div>

                    {/* Finančni podatki */}
                    {(representativeProperty.pogodbena_cena || representativeProperty.stopnja_ddv) && (
                      <div className="bg-white border border-gray-300 rounded-lg p-3">
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Finančni podatki</h4>
                        <div className="bg-gray-50 p-2 rounded text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <DetailRow label="Pogodbena cena" value={representativeProperty.pogodbena_cena ? `€${formatPrice(representativeProperty.pogodbena_cena)}` : null} />
                            <DetailRow label="Stopnja DDV" value={getStopnjaDDV(representativeProperty.stopnja_ddv)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Energetska izkaznica */}
                  <EnergetskaIzkaznicaContainer />

                  {/* Opombe */}
                  {representativeProperty.opombe && (
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Opombe</h4>
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        <div className="text-sm text-gray-800 leading-relaxed">
                          {representativeProperty.opombe}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dodatni deli stavb */}
                  {selectedPosel && filteredConnectedParts.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-gray-800 mb-3">Dodatni deli stavb vključeni v posel ({filteredConnectedParts.length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filteredConnectedParts.map((part) => (
                          <div key={part.del_stavbe_id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="font-medium text-gray-900 text-sm mb-2 border-b border-gray-200 pb-1">
                              Del stavbe {part.stevilka_dela_stavbe}
                            </div>
                            <div className="space-y-1 text-xs">
                              <DetailRow label="Površina" value={part.povrsina_uradna ? `${part.povrsina_uradna} m²` : null} />
                              <DetailRow label="Uporabna pov. " value={part.povrsina_uporabna ? `${part.povrsina_uporabna} m²` : null} />
                              <DetailRow label="Število sob" value={part.stevilo_sob > 0 ? part.stevilo_sob : null} />
                              <DetailRow label="Nadstropje" value={part.nadstropje} />
                              <DetailRow label="Vrsta" value={getVrstaDelaStavbe(part.vrsta_nepremicnine)} />
                              {dataSource === 'np' && (
                                <DetailRow label="Opremljenost" value={getDaBoljNe(part.opremljenost)} />
                              )}
                              <DetailRow label="Prodani delež" value={part.prodani_delez} />
                              {part.pogodbena_cena && (
                                <DetailRow label="Pogodbena cena" value={`€${formatPrice(part.pogodbena_cena)}`} />
                              )}
                            </div>

                            {/* Dodatne informacije v manjših sekcijah */}
                            {part.dejanska_raba && (
                              <div className="mt-2 pt-2 border-t border-gray-300">
                                <div className="text-xs text-gray-500 mb-1">Dejanska raba:</div>
                                <div className="text-xs text-gray-800">{part.dejanska_raba}</div>
                              </div>
                            )}

                            {part.prostori && part.prostori !== '-' && (
                              <div className="mt-2 pt-2 border-t border-gray-300">
                                <div className="text-xs text-gray-500 mb-1">Prostori:</div>
                                <div className="text-xs text-gray-800">{part.prostori}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Podobne nepremičnine - placeholder */}
                  <div className="bg-white border border-gray-300 rounded-lg p-3">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Podobne nepremičnine</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="space-y-2">
                            <div className="font-medium text-gray-800 text-sm">Naslov: trg ob reki {i}</div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="text-gray-800">130 m²</div>
                              <div className="text-gray-800">€133.000</div>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="text-gray-800">Razdalja: 2 km</div>
                              <div className="text-gray-800">Energijski razred: B</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Desni panel s posli - ohranem originalen izgled */}
              {property.povezani_posli && property.povezani_posli.length > 0 && (
                <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto min-h-0 flex flex-col">
                  <div className="p-3 bg-gray-100 border-b border-gray-200 sticky top-0">
                    <h3 className="font-bold text-lg text-gray-800">
                      Posli ({property.povezani_posli.length})
                    </h3>
                  </div>
                  <div className="p-2 space-y-3 flex-1">
                    {property.povezani_posli
                      .map((posel) => {
                        const connectedPartsCount = getConnectedBuildingParts(posel.posel_id).length;
                        const isSelected = selectedPoselId === posel.posel_id;
                        const priceInfo = getZadnjaCenaInfo(posel);

                        return (
                          <div
                            key={posel.posel_id}
                            ref={el => poselRefs.current[posel.posel_id] = el}
                            onClick={() => selectPosel(posel.posel_id)}
                            className={`rounded-lg cursor-pointer transition-colors bg-white ${isSelected
                              ? ' border-2 border-gray-600 p-3'
                              : ' hover:bg-gray-100 border border-gray-300 p-3 m-px mb-3'
                              }`}
                          >
                            <div className="space-y-3">

                              <div>
                                <div className="flex justify-between items-center">
                                  {dataSource === 'np' &&
                                    <span className="text-gray-800 text-sm font-medium">
                                      {getCasNajemanja(posel.cas_najemanja)}{posel.cas_najemanja === 1 && ` (${posel.trajanje_najemanja} mesecev)`}
                                    </span>
                                  }
                                  {dataSource === 'kpp' &&
                                    <span className="font-bold text-gray-800">
                                      {posel.datum_sklenitve && formatirajDatum(posel.datum_sklenitve)}
                                    </span>
                                  }
                                  {isSelected && (
                                    <span className="text-gray-800 text-sm font-medium">Izbrano</span>
                                  )}
                                </div>
                                <div className="flex justify-between items-center">
                                  {dataSource === 'np' &&
                                    <div className="flex flex-col">
                                      <span className="font-bold text-gray-800">
                                        {formatRentalPeriod(posel.datum_zacetka_najemanja, posel.datum_prenehanja_najemanja)}
                                      </span>
                                      {!posel.datum_prenehanja_najemanja && !posel.datum_zakljucka_najema && (
                                        <span className="text-green-600 text-sm  font-medium">Aktivno</span>
                                      )}
                                      {posel.datum_zakljucka_najema && posel.datum_prenehanja_najemanja != posel.datum_zakljucka_najema && (
                                        <span className="text-sm text-gray-800  font-medium">Predčasen zaključek: {formatirajDatum(posel.datum_zakljucka_najema)}</span>
                                      )}
                                    </div>
                                  }
                                </div>
                              </div>

                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                                <div className="text-center">
                                  <div className="text-gray-600 text-sm mb-1">
                                    {priceInfo.cenaLabel}
                                  </div>
                                  {connectedPartsCount > 1 && (
                                    <div className="text-gray-800 text-sm mb-1"> <span className="font-semibold text-black">{connectedPartsCount}</span> delov stavb</div>
                                  )}
                                  {priceInfo.hasCena ?
                                    <><div className="font-bold text-xl text-gray-800 mb-1">
                                      {priceInfo.cenaText}
                                    </div><div className="text-sm text-gray-500">
                                        {priceInfo.ddvInfo}
                                        {priceInfo.stroskiInfo ? ` • ${priceInfo.stroskiInfo}` : ''}
                                      </div></>
                                    :
                                    <div className="font-bold text-lg text-gray-600">Podatek ni na voljo</div>
                                  }
                                </div>
                              </div>

                              <div className="bg-gray-50 p-2 rounded text-sm">
                                <h5 className="font-semibold text-gray-800 mb-2">Podatki o poslu</h5>
                                <div className="grid grid-cols-1 gap-x-2 gap-y-1 text-sm">
                                  <DetailRow
                                    label="Datum sklenitve"
                                    value={posel.datum_sklenitve ? formatirajDatum(posel.datum_sklenitve) : null}
                                  />
                                  <DetailRow
                                    label="Datum uveljavitve"
                                    value={posel.datum_uveljavitve ? formatirajDatum(posel.datum_uveljavitve) : null}
                                  />
                                  <DetailRow
                                    label="Zadnja uveljavitev"
                                    value={posel.datum_zadnje_uveljavitve ? formatirajDatum(posel.datum_zadnje_uveljavitve) : null}
                                  />
                                  <DetailRow
                                    label="Zadnja sprememba"
                                    value={posel.datum_zadnje_spremembe ? formatirajDatum(posel.datum_zadnje_spremembe) : null}
                                  />
                                  <DetailRow label="Tržnost posla" value={getTrznostPosla(posel.trznost_posla)} />
                                  {dataSource === 'np' ? (
                                    <>
                                      <DetailRow label="Vrsta akta" value={getVrstaAkta(posel.vrsta_akta)} />
                                      <DetailRow label="Vrsta posla" value={getVrstaNajemnegaPosla(posel.vrsta_posla)} />
                                    </>
                                  ) : (
                                    <DetailRow label="Vrsta posla" value={getVrstaProdajnegaPosla(posel.vrsta_posla)} />
                                  )}

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