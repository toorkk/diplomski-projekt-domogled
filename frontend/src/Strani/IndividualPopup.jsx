const IndividualPopup = ({ properties, dataSourceType = 'prodaja' }) => {
    // Sestavi naslov z ulico in hišno številko, če obstajata
    const naslov = `${properties.ulica || ''} ${properties.hisna_stevilka || ''} ${properties.dodatek_hs || ''}`.trim();
    
    const contractCount = properties.contract_count || 1;
    const hasMultipleContracts = properties.has_multiple_contracts || false;
    
    return `
        <div class="font-sans bg-white rounded-lg overflow-hidden w-80">
            <!-- Modro zglavje -->
            <div class="bg-[rgb(59,130,246)] text-white p-4">
                ${naslov ? `<h3 class="font-bold text-lg mb-1">${naslov}</h3>` :
                properties.naselje ? `<p class="text-white">${properties.naselje}</p>` : ''}
                
                ${hasMultipleContracts ? `
                <div class="mt-1">
                    <span class="bg-blue-600 px-2 py-1 rounded text-xs">
                        ${contractCount}x poslov
                    </span>
                </div>
                ` : ''}
            </div>

            <!-- Vsebina -->
            <div class="p-4">
                <div class="grid grid-cols-2 gap-y-2 text-sm">
                    
                    ${properties.obcina ? `
                    <div class="text-gray-600">Občina:</div>
                    <div class="font-medium">${properties.obcina}</div>
                    ` : ''}
                    
                    ${properties.naselje ? `
                    <div class="text-gray-600">Naselje:</div>
                    <div class="font-medium">${properties.naselje}</div>
                    ` : ''}
                    
                    ${(properties.ulica && !naslov) ? `
                    <div class="text-gray-600">Ulica:</div>
                    <div class="font-medium">${properties.ulica}</div>
                    ` : ''}
                    
                    ${(properties.hisna_stevilka && !naslov) ? `
                    <div class="text-gray-600">Hišna številka:</div>
                    <div class="font-medium">${properties.hisna_stevilka}</div>
                    ` : ''}

                    ${properties.povrsina ? `
                    <div class="text-gray-600">Površina:</div>
                    <div class="font-medium">${properties.povrsina} m²</div>
                    ` : ''}
                    
                    ${properties.sifra_ko ? `
                    <div class="text-gray-600">Šifra KO:</div>
                    <div class="font-medium">${properties.sifra_ko}</div>
                    ` : ''}
                    
                    ${properties.stevilka_stavbe ? `
                    <div class="text-gray-600">Št. stavbe:</div>
                    <div class="font-medium">${properties.stevilka_stavbe}</div>
                    ` : ''}
                    
                    ${properties.stevilka_dela_stavbe ? `
                    <div class="text-gray-600">Št. dela stavbe:</div>
                    <div class="font-medium">${properties.stevilka_dela_stavbe}</div>
                    ` : ''}
                    
                    ${properties.dejanska_raba ? `
                    <div class="text-gray-600">Opis objekta:</div>
                    <div class="font-medium">${properties.dejanska_raba}</div>
                    ` : ''}
                    
                </div>
                
                <!-- Črta kot separator -->
                <hr class="my-4 border-gray-200">
                
                <!-- Cena nepremičnine - simplified for deduplicated data -->
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <div class="text-center">
                        <div class="text-gray-600 text-sm mb-1">
                            ${dataSourceType === 'prodaja' ? 'Cena nakupa:' : 'Cena najemnine:'}
                        </div>
                        <div class="font-bold text-lg text-gray-600">Kliknite za podrobnosti</div>
                        ${hasMultipleContracts ? `
                        <div class="text-xs text-blue-600 mt-1">
                            Več poslov na voljo
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Moder gumb za podrobnosti -->
                <div class="text-center">
                    <button 
                        class="bg-[rgb(59,130,246)] hover:bg-[rgb(29,100,216)] text-white py-2 px-4 rounded text-sm transition-colors duration-200 w-full"
                        id="btnShowDetails_${properties.id}"
                    >
                        Podrobnosti
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default IndividualPopup;