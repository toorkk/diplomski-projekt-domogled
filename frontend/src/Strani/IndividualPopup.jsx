
const IndividualPopup = ({ properties, onShowDetails }) => {
    // Sestavi naslov z ulico in hišno številko, če obstajata
    const naslov = `${properties.ulica || ''} ${properties.hisna_stevilka || ''} ${properties.dodatek_hs || ''}`.trim();

    return `
        <div class="font-sans bg-white rounded-lg overflow-hidden">
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
                </div>
                
                <!-- Moder gumb za podrobnosti -->
                <div class="mt-4 text-center">
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