const IndividualPopup = ({ properties, dataSourceType = 'prodaja' }) => {

    const naslov = `${properties.ulica || ''} ${properties.hisna_stevilka || ''} ${properties.dodatek_hs || ''}`.trim();
    
    const contractCount = properties.stevilo_poslov || 1;
    const hasMultipleContracts = properties.ima_vec_poslov || false;
    

    const getLatestPriceInfo = () => {
        if (dataSourceType === 'prodaja' || properties.data_source === 'kpp') {
            // KPP
            const cena = properties.zadnja_cena;
            return {
                hasPrice: !!cena,
                priceText: cena ? `€${cena.toLocaleString('sl-SI')}` : null,
                priceLabel: 'Prodajna cena:',
                vatInfo: properties.zadnje_vkljuceno_ddv ? 
                    `z DDV${properties.zadnja_stopnja_ddv ? ` (${properties.zadnja_stopnja_ddv}%)` : ' (% neznan)'}` : 
                    'brez DDV'
            };
        } else {
            // NP
            const najemnina = properties.zadnja_najemnina;
            return {
                hasPrice: !!najemnina,
                priceText: najemnina ? `€${najemnina.toLocaleString('sl-SI')}/mesec` : null,
                priceLabel: 'Najemnina:',
                vatInfo: properties.zadnje_vkljuceno_ddv ? 
                    `z DDV${properties.zadnja_stopnja_ddv ? ` (${properties.zadnja_stopnja_ddv}%)` : ''}` : 
                    'brez DDV',
                costsInfo: properties.zadnje_vkljuceno_stroski ? 'stroški vključeni' : 'stroški niso vključeni'
            };
        }
    };
    
    const priceInfo = getLatestPriceInfo();
    
    return `
        <div class="font-sans bg-white rounded-lg overflow-hidden w-80">
            <!-- Modro zglavje -->
            <div class="bg-[rgb(59,130,246)] text-white p-4">
                ${naslov ? `<h3 class="font-bold text-lg mb-1">${naslov}</h3>` :
                properties.naselje ? `<h3 class="font-bold text-lg mb-1">${properties.naselje}</h3>` : ''}
                
                ${properties.obcina && properties.obcina !== properties.naselje ? 
                    `<p class="text-blue-100 text-sm">${properties.obcina}</p>` : ''}
                
                <div class="mt-2 flex gap-2">
                    ${properties.zadnje_leto ? `
                    <span class="bg-gray-50 px-2 py-1 rounded text-xs text-gray-800 h-6 flex items-center">
                        ${properties.zadnje_leto}
                    </span>
                    ` : ''}
                    ${hasMultipleContracts ? `
                    <span class="bg-blue-600 px-2 py-1 rounded text-xs h-6 flex items-center">
                        ${contractCount}x poslov
                    </span>
                    ` : ''}
                    ${properties.energijski_razred ? `
                    <span class="bg-blue-600 px-2 py-1 rounded text-xs h-6 flex items-center">
                        ${properties.energijski_razred}
                    </span>
                    ` : ''}
                </div>
            </div>

            <!-- Vsebina -->
            <div class="p-4">
                <div class="text-sm mb-4">
                    <div class="grid grid-cols-2 gap-y-2 mb-2">
                        
                        ${properties.povrsina ? `
                        <div class="text-gray-600">Površina / Uporabna:</div>
                        <div class="font-medium">${properties.povrsina} m² / ${properties.povrsina_uporabna} m²</div>
                        ` : ''}
                        
                        ${properties.leto_izgradnje_stavbe ? `
                        <div class="text-gray-600">Leto izgradnje:</div>
                        <div class="font-medium">${properties.leto_izgradnje_stavbe}</div>
                        ` : ''}
                        
                        ${properties.stevilo_sob ? `
                        <div class="text-gray-600">Število sob:</div>
                        <div class="font-medium">${properties.stevilo_sob}</div>
                        ` : ''}
                        
                        ${properties.opremljenost ? `
                        <div class="text-gray-600">Opremljenost:</div>
                        <div class="font-medium">${properties.opremljenost}</div>
                        ` : ''}
                        
                        ${properties.stev_stanovanja ? `
                        <div class="text-gray-600">Št. stanovanja:</div>
                        <div class="font-medium">${properties.stev_stanovanja}</div>
                        ` : ''}
                        
                    </div>

                    ${properties.dejanska_raba ? `
                    <div class="text-gray-600 mb-1">Tip objekta:</div>
                    <div class="font-medium">${properties.dejanska_raba}</div>
                    ` : ''}
                </div>
                
                <!-- Cena nepremičnine -->
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <div class="text-center">
                        <div class="text-gray-600 text-sm mb-1">
                            ${priceInfo.priceLabel}
                        </div>
                        ${priceInfo.hasPrice ? `
                        <div class="font-bold text-xl text-gray-800 mb-1">
                            ${priceInfo.priceText}
                        </div>
                        <div class="text-xs text-gray-500">
                            ${priceInfo.vatInfo}
                            ${priceInfo.costsInfo ? ` • ${priceInfo.costsInfo}` : ''}
                        </div>
                        ` : `
                        <div class="font-bold text-lg text-gray-600">Podatek ni na voljo</div>
                        `}
                        
                        ${hasMultipleContracts ? `
                        <div class="text-xs text-blue-600 mt-2">
                            ${contractCount - 1} ${contractCount === 2 ? 'dodatni posel' : 'dodatnih poslov'} na voljo
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Tehnični podatki (skrčeni) -->
                <details class="mb-4">
                    <summary class="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                        Tehnični podatki
                    </summary>
                    <div class="grid grid-cols-2 gap-y-1 text-xs mt-2 pl-2">
                        <div class="text-gray-500">Šifra KO:</div>
                        <div class="font-mono">${properties.sifra_ko || 'N/A'}</div>
                        
                        <div class="text-gray-500">Št. stavbe:</div>
                        <div class="font-mono">${properties.stevilka_stavbe || 'N/A'}</div>
                        
                        <div class="text-gray-500">Št. dela stavbe:</div>
                        <div class="font-mono">${properties.stevilka_dela_stavbe || 'N/A'}</div>
                    </div>
                </details>
                
                <!-- Moder gumb za podrobnosti -->
                <div class="text-center">
                    <button 
                        class="bg-[rgb(59,130,246)] hover:bg-[rgb(29,100,216)] text-white py-2 px-4 rounded text-sm transition-colors duration-200 w-full"
                        id="btnShowDetails_${properties.id}"
                    >
                        ${hasMultipleContracts ? 'Prikaži vse posle' : 'Več podrobnosti'}
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default IndividualPopup;