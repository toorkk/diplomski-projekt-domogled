const IndividualPopup = ({ properties, onShowDetails, dataSourceType = 'prodaja' }) => {
    // Sestavi naslov z ulico in hišno številko, če obstajata
    const naslov = `${properties.ulica || ''} ${properties.hisna_stevilka || ''} ${properties.dodatek_hs || ''}`.trim();
    
    // Pridobi ceno iz JOIN podatkov
    const cena = dataSourceType === 'prodaja' 
        ? properties.cena || properties.pogodbena_cena 
        : properties.najemnina;
    
    // Formatiranje cene
    const formatiranaoCena = cena ? `${Math.round(cena).toLocaleString('sl-SI')} €` : 'Ni podatka';

    return `
        <div class="font-sans bg-white rounded-lg overflow-hidden w-80">
            <!-- Modro zglavje -->
            <div class="bg-[rgb(59,130,246)] text-white p-4">
                ${naslov ? `<h3 class="font-bold text-lg mb-1">${naslov}</h3>` :
                properties.naselje ? `<p class="text-white">${properties.naselje}</p>` : ''}
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
                    
                    ${properties.stevilo_sob && dataSourceType === 'prodaja' ? `
                    <div class="text-gray-600">Število sob:</div>
                    <div class="font-medium">${properties.stevilo_sob}</div>
                    ` : ''}
                    
                    ${properties.datum_sklenitve ? `
                    <div class="text-gray-600">Datum sklenitve:</div>
                    <div class="font-medium">${new Date(properties.datum_sklenitve).toLocaleDateString('sl-SI')}</div>
                    ` : ''}
                    
                    ${properties.vkljuceno_stroski !== null && dataSourceType === 'najem' ? `
                    <div class="text-gray-600">Vključeni stroški:</div>
                    <div class="font-medium">${properties.vkljuceno_stroski ? 'Da' : 'Ne'}</div>
                    ` : ''}
                    
                </div>
                
                <!-- Črta kot separator -->
                <hr class="my-4 border-gray-200">
                
                <!-- Cena nepremičnine -->
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <div class="text-center">
                        <div class="text-gray-600 text-sm mb-1">
                            ${dataSourceType === 'prodaja' ? 'Cena nakupa:' : 'Cena najemnine:'}
                        </div>
                        <div class="font-bold text-lg text-gray-900">${formatiranaoCena}</div>
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