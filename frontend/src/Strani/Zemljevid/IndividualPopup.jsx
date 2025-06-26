import {getEnergyClassColor, getColorClasses, getNaslovString, getNaslovDodatek, getNaslov, getVrstaDelaStavbe} from './PodrobnostiHelper.jsx';

const getPovrsinaInfo = (properties) => {
    const parts = [];
    const valueParts = [];
    
    if (properties.povrsina_uradna) {
        parts.push('Površina');
        valueParts.push(`${properties.povrsina_uradna} m²`);
    }
    
    if (properties.povrsina_uporabna) {
        parts.push('Uporabna');
        valueParts.push(`${properties.povrsina_uporabna} m²`);
    }
    
    return {
        label: parts.join(' / '),
        value: valueParts.join(' / ')
    };
};

const buildDDVInfo = (properties) => {
    if (!properties.zadnje_vkljuceno_ddv) return 'brez DDV';
    const percentage = properties.zadnja_stopnja_ddv ? ` (${properties.zadnja_stopnja_ddv}%)` : '';
    return `z DDV${percentage}`;
};

const getCenaData = (properties, dataSourceType) => {
    const isKPP = dataSourceType === 'prodaja' || properties.data_source === 'kpp';
    
    if (isKPP) {
        const cena = properties.zadnja_cena;
        return {
            hasCena: !!cena,
            cenaText: cena ? `€${cena.toLocaleString('sl-SI')}` : null,
            cenaLabel: 'Prodajna cena:',
            ddvInfo: buildDDVInfo(properties)
        };
    }
    
    const najemnina = properties.zadnja_najemnina;
    const stroskiInfo = properties.zadnje_vkljuceno_stroski ? 'stroški vključeni' : 'stroški niso vključeni';
    
    return {
        hasCena: !!najemnina,
        cenaText: najemnina ? `€${najemnina.toLocaleString('sl-SI')} / mesec` : null,
        cenaLabel: 'Najemnina:',
        ddvInfo: buildDDVInfo(properties),
        stroskiInfo
    };
};

const buildHeaderTags = (properties, contractCount, hasMultipleContracts) => {
    const tags = [];
    
    if (properties.zadnje_leto) {
        tags.push(`<span class="bg-gray-50 px-2 py-1 rounded text-xs text-gray-800 h-6 flex items-center">${properties.zadnje_leto}</span>`);
    }
    
    if (hasMultipleContracts) {
        tags.push(`<span class="bg-gray-50 px-2 py-1 rounded text-xs h-6 flex items-center">${contractCount}x poslov</span>`);
    }
    
    if (properties.energijski_razred) {
        tags.push(`<span class="${getEnergyClassColor(properties.energijski_razred)} px-2 py-1 rounded text-xs h-6 flex items-center">${properties.energijski_razred}</span>`);
    }
    
    return tags.join('');
};

const buildPropertyGrid = (properties, povrsina) => {
    const rows = [];
    
    const propertyMappings = [
        { key: 'obe_povrsini', label: povrsina.label , value: povrsina.value },
        { key: 'stevilo_sob', label: 'Število sob:', value: properties.stevilo_sob },
        { key: 'opremljenost', label: 'Opremljeno:', value: properties.opremljenost ? (properties.opremljenost == 1 ? 'Da' : 'Ne') : null },
        { key: 'leto_izgradnje_stavbe', label: 'Leto izgradnje:', value: properties.leto_izgradnje_stavbe },
        { key: 'vrsta_nepremicnine', label: 'Vrsta Nepremičnine:', value: getVrstaDelaStavbe(properties.vrsta_nepremicnine) }
    ];
    
    propertyMappings.forEach(({ key, label, value }) => {
        if (value) {
            rows.push(`
                <div class="text-gray-600">${label}</div>
                <div class="font-medium">${value}</div>
            `);
        }
    });
    
    return rows.join('');
};

const buildPriceSection = (priceInfo) => {
    const noPriceContent = '<div class="font-bold text-lg text-gray-600">Podatek ni na voljo</div>';
    
    if (!priceInfo.hasCena) return noPriceContent;
    
    const costsText = priceInfo.stroskiInfo ? ` • ${priceInfo.stroskiInfo}` : '';
    
    return `
        <div class="font-bold text-xl text-gray-800 mb-1">${priceInfo.cenaText}</div>
        <div class="text-xs text-gray-500">${priceInfo.ddvInfo}${costsText}</div>
    `;
};

const IndividualPopup = ({ properties, dataSourceType = 'prodaja' }) => {
    const contractCount = properties.stevilo_poslov || 1;
    const hasMultipleContracts = properties.ima_vec_poslov || false;
    
    const priceInfo = getCenaData(properties, dataSourceType);
    const naslovDodatek = getNaslovDodatek(properties);
    const naslov = getNaslovString(properties);
    const colors = getColorClasses(properties.data_source);
    const povrsina = getPovrsinaInfo(properties);
    
    const titleText = naslov || properties.naselje || '';
    const headerTags = buildHeaderTags(properties, contractCount, hasMultipleContracts);
    const propertyGrid = buildPropertyGrid(properties, povrsina);
    const priceSection = buildPriceSection(priceInfo);
    const buttonText = hasMultipleContracts ? 'Prikaži vse posle' : 'Več podrobnosti';
    const delovStavbCount = properties.zadnje_stevilo_delov_stavb > 1 ? 
    `<div class="text-gray-800 text-sm mb-1"> <span class="font-semibold text-black">${properties.zadnje_stevilo_delov_stavb}</span> delov stavb</div>` 
    : '';

    

    return `
        <div class="font-sans rounded-lg overflow-hidden w-80">
            <div class="backdrop-blur">
                <div class="${colors.headerBg} opacity-80 ${colors.headerText} p-4">
                    <h3 class="font-bold text-lg mb-1">${titleText}</h3>
                    <p class="text-blue-100 text-sm">${naslovDodatek}</p>
                    <div class="mt-2 flex gap-2">${headerTags}</div>
                </div>
            </div>

            <div class="p-4 bg-white">
                <div class="text-sm mb-4">
                    <div class="grid grid-cols-2 gap-y-2 mb-2">
                        ${propertyGrid}
                    </div>
                </div>
                
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <div class="text-center">
                        <div class="text-gray-600 text-sm mb-1">${priceInfo.cenaLabel}</div>
                        ${delovStavbCount}
                        ${priceSection}
                    </div>
                </div>
                
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
                
                <div class="text-center">
                    <button 
                        class="${colors.buttonBg} ${colors.buttonHover} text-white py-2 px-4 rounded text-sm transition-colors duration-200 w-full"
                        id="btnShowDetails_${properties.id}"
                    >
                        ${buttonText}
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default IndividualPopup;