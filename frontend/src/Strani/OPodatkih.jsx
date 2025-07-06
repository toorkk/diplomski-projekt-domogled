export default function OPodatkih() {
  return (
    <div className="min-h-screen bg-gray-100 lg:pt-16 lg:pb-8 lg:px-16">
      <div className="max-w-none">          
        {/* Vsebina */}
        <div className="pt-8 px-4 pb-8 lg:pt-16 lg:px-8">
          <div className="space-y-6 lg:space-y-10 max-w-6xl mx-auto">
            
            {/* Viri podatkov */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-8 mt-20 lg:mt-0">
              <h2 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4 text-gray-900">
                Viri podatkov
              </h2>
              <div className="space-y-4 text-gray-700 text-sm lg:text-base">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Zunanji viri podatkov (javni geodetski podatki)
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Podatki o cenah in lokacijah prodanih ter oddanih nepremičnin so pridobljeni iz javnih geodetskih podatkov, 
                    ki jih zagotavlja Geodetska uprava Republike Slovenije. Ti podatki vsebujejo informacije o vseh registriranih 
                    nepremičninskih transakcijah, vključno s cenami, lokacijami, velikostmi in drugimi lastnostmi nepremičnin.
                  </p>
                  <div className="text-xs lg:text-sm">
                    <strong>Vir:</strong> 
                    <a 
                      href="https://ipi.eprostor.gov.si/jgp/data" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline ml-1 break-all"
                    >
                      https://ipi.eprostor.gov.si/jgp/data
                    </a>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Register energetskih izkaznic
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Energetski podatki za posamezne nepremičnine so pridobljeni iz javno dostopnega registra energetskih izkaznic. 
                    Ta register vsebuje energetske izkaznice za praktično vsako posamezno nepremičnino v Sloveniji, 
                    vključno z energetskimi razredi, letno porabo energije, emisijami CO₂ in drugimi energetskimi kazalniki. 
                    Ti podatki omogočajo podrobno analizo energetske učinkovitosti nepremičnin.
                  </p>
                  <div className="text-xs lg:text-sm">
                    <strong>Vir:</strong> 
                    <a 
                      href="https://www.energetika-portal.si/podrocja/energetika/energetske-izkaznice-stavb/register-energetskih-izkaznic/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline ml-1 break-words"
                    >
                      Register energetskih izkaznic
                    </a>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 lg:p-4 mt-4">
                  <p className="text-xs lg:text-sm text-blue-800 leading-relaxed">
                    <strong>Opomba:</strong> Vsi podatki so javno dostopni in se redno posodabljajo v skladu z uradnimi viri. 
                    Kombinacija obeh virov omogoča celovit pregled nad nepremičninskim trgom in energetsko učinkovitostjo stavb v Sloveniji.
                  </p>
                </div>
              </div>
            </div>

            {/* Metodologija */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-8">
              <h2 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4 text-gray-900">
                Metodologija obdelave podatkov
              </h2>
              <div className="space-y-4 text-gray-700 text-sm lg:text-base">
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Prikazovanje podatkov na zemljevidu
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Podatki, prikazani na zemljevidu nepremičnin, so <strong>direktni podatki iz GURS-a</strong> 
                    (Geodetska uprava Republike Slovenije) brez dodatne obdelave. Vsaka nepremičnina je prikazana 
                    z njenimi dejanskimi lastnostmi, kot so registrirane v uradnih evidencah.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Statistični izračuni
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Na strani statistik so prikazani <strong>izračunani povprečni kazalniki</strong> na podlagi 
                    vseh razpoložljivih podatkov. Ti vključujejo:
                  </p>
                  <ul className="list-disc pl-4 lg:pl-6 space-y-1 text-xs lg:text-sm">
                    <li>Povprečno ceno na kvadratni meter</li>
                    <li>Povprečno skupno ceno nepremičnin</li>
                    <li>Povprečno velikost nepremičnin</li>
                    <li>Povprečno starost stavb</li>
                    <li>Število transakcij po obdobjih</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Čiščenje in validacija podatkov
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Pred statistično obdelavo so podatki <strong>očiščeni in validirani</strong> z namenom 
                    zagotavljanja kakovosti analiz:
                  </p>
                  <ul className="list-disc pl-4 lg:pl-6 space-y-1 text-xs lg:text-sm">
                    <li><strong>Odstranjevanje podvojenih zapisov:</strong> Eliminacija duplikatov za preprečevanje popačenja statistik</li>
                    <li><strong>Filtriranje osamelcev:</strong> Izločitev ekstremnih vrednosti, ki bi lahko izkrivile povprečja</li>
                    <li><strong>Validacija podatkov:</strong> Preverjanje logičnosti vrednosti (npr. pozitivne cene, realne velikosti)</li>
                    <li><strong>Standardizacija kategorij:</strong> Enotno razvrstitev tipov nepremičnin in transakcij</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Časovni okviri analiz
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Statistike so razdeljene na dva časovna okvira:
                  </p>
                  <ul className="list-disc pl-4 lg:pl-6 space-y-1 text-xs lg:text-sm">
                    <li><strong>Zadnjih 12 mesecev:</strong> Povprečja za najnovejše 12-mesečno obdobje</li>
                    <li><strong>Letni trendi:</strong> Zgodovinski pregled povprečij po posameznih letih</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 lg:p-4 mt-4">
                  <p className="text-xs lg:text-sm text-amber-800 leading-relaxed">
                    <strong>Opomba o metodologiji:</strong> Vsi statistični izračuni temeljijo na standardnih 
                    matematičnih metodah za izračun povprečij. Kjer je to smiselno, so upoštevana tudi tehtana 
                    povprečja glede na število transakcij v posameznih kategorijah.
                  </p>
                </div>
              </div>
            </div>

            {/* Posodobitve */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-8">
              <h2 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4 text-gray-900">
                Posodobitve podatkov
              </h2>
              <div className="space-y-4 text-gray-700 text-sm lg:text-base">
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Dinamično posodabljanje
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Podatki v aplikaciji se posodabljajo avtomatsko v skladu z urniki objav uradnih virov. 
                    Sistem spremlja spremembe in zagotavlja, da so uporabnikom vedno na voljo najnovejši podatki.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Nepremičninski podatki (GURS)
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Podatki o prodajah in najemih nepremičnin se posodabljajo <strong>sočasno z objavami 
                    Geodetske uprave Republike Slovenije</strong>. GURS redno objavlja nove transakcije 
                    in posodobitve obstoječih zapisov, naša aplikacija pa te spremembe prevzame takoj, 
                    ko postanejo javno dostopne.
                  </p>
                  <ul className="list-disc pl-4 lg:pl-6 space-y-1 text-xs lg:text-sm">
                    <li>Novi podatki o prodajah in najemih</li>
                    <li>Popravki obstoječih zapisov</li>
                    <li>Dodatne lastnosti nepremičnin</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Energetski podatki
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Energetske izkaznice se posodabljajo <strong>ob vsaki posodobitvi registra energetskih 
                    izkaznic</strong>. Ko lastniki nepremičnin pridobijo nove energetske izkaznice ali 
                    se obstoječe posodobijo, so te spremembe samodejno vključene v naše analize.
                  </p>
                  <ul className="list-disc pl-4 lg:pl-6 space-y-1 text-xs lg:text-sm">
                    <li>Nove energetske izkaznice</li>
                    <li>Posodobitve energetskih razredov</li>
                    <li>Spremembe porabe energije</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Statistike in analitika
                  </h3>
                  <p className="mb-2 leading-relaxed">
                    Statistični podatki in povprečja se <strong>preračunavajo takoj po vsaki posodobitvi 
                    osnovnih podatkov</strong>. To zagotavlja, da odražajo najnovejše tržne razmere in 
                    energetske standarde.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 lg:p-4 mt-4">
                  <div className="flex items-start space-x-2">
                    <svg className="w-4 h-4 lg:w-5 lg:h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs lg:text-sm text-green-800 font-medium">
                        Zagotovilo svežih podatkov
                      </p>
                      <p className="text-xs lg:text-sm text-green-700 mt-1 leading-relaxed">
                        Naš sistem zagotavlja, da so vsi prikazani podatki sinhronizirани z uradnimi viri 
                        in odražajo najnovejše stanje na nepremičninskem trgu ter v energetski evidenci.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Kontakt */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-8">
              <h2 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4 text-gray-900">
                Kontakt in podpora
              </h2>
              <div className="space-y-4 text-gray-700 text-sm lg:text-base">
                
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">
                    Vprašanja in pomoč
                  </h3>
                  <p className="mb-3 leading-relaxed">
                    Za vsa vprašanja ali predloge se obrnite na naš e-naslov. 
                    Trudimo se odgovoriti v najkrajšem možnem času.
                  </p>
                  
                  <div className="flex items-center space-x-3 bg-blue-50 border border-blue-200 rounded-lg p-3 lg:p-4">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-blue-900 text-sm lg:text-base">E-pošta</p>
                      <a 
                        href="mailto:domogled-info@gmail.com" 
                        className="text-blue-700 hover:text-blue-900 underline text-sm lg:text-base break-all"
                      >
                        domogled-info@gmail.com
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 lg:p-4 mt-4">
                  <p className="text-xs lg:text-sm text-gray-700 leading-relaxed">
                    <strong>Zahvala:</strong> Cenimo vaše mnenje in povratne informacije, ki nam pomagajo 
                    izboljševati aplikacijo. Vaš prispevek je pomemben za razvoj boljše uporabniške izkušnje 
                    za vse uporabnike platforme Domogled.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}