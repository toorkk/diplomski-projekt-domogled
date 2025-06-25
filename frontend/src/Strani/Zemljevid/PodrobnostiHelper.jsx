
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
        '15': 'Drugo',
        '16': 'Stanovanjska soba ali sobe'
    };
    return vrstaMap[vrsta] || `Vrsta ${vrsta} - neznano`;
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

const getVrstaNajemnegaPosla = (vrsta) => {
    const vrstMap = {
        '1': 'Oddajanje stavb ali njihovih delov na prostem trgu',
        '2': 'Oddajanje stavb ali njihovih delov med povezanimi fizičnimi ali pravnimi osebami',
        '3': 'Oddajanje denacionaliziranih stanovanjskih nepremičnin na podlagi upravne ali sodne odločbe',
        '4': 'Drugo odplačno oddajanje',
        '5': 'Oddajanje stanovanjskih nepremičnin za najemnino, določeno na podlagi zakona',
    };
    return vrstMap[vrsta] || `${vrsta}`;
};

const getVrstaProdajnegaPosla = (vrsta) => {
    const vrstMap = {
        '1': 'Prodaja nepremičnin na prostem trgu',
        '2': 'Prodaja nepremičnin na prostovoljni javni dražbi ali druga oblika prostovoljne javne prodaje',
        '3': 'Prodaja nepremicnin na javni dražbi ali druga oblika javne prodaje v izvršilnem postopku, prisilni poravnavi, stečaju ali stečajnem postopku',
        '4': 'Prodaja nepremičnin družinskim članom, med povezanimi fizičnimi in pravnimi osebami ali med povezanimi pravnimi osebami',
        '5': 'Finančni najem (lizing)',
        '6': 'Stavbna pravica - ustanovitev ali prenos',
        '7': 'Prodaja nepremičnine namesto razlastitve lastnika',
        '8': 'Razlastitev lastnika nepremičnine na podlagi zakona',
    };
    return vrstMap[vrsta] || `${vrsta}`;
};

// vcasih so vrednosti prazne in odvisno od podatka je Da ali Ne (prazna novogradnja je recimo ne, prazna stavba dokoncana pa je da)
const getDaBoljNe = (vrednost) => {
    return vrednost === 1 || vrednost === '1' ? 'Da' : 'Ne';
};

const getNeBoljDa = (vrednost) => {
    return vrednost === 0 || vrednost === '0' ? 'Ne' : 'Da';
};

const getEnergyClassColor = (razred) => {
    const colors = {
        'A1': 'bg-lime-400 text-gray-800',      // svetlo zelena
        'A2': 'bg-lime-300 text-gray-800',      // svetlejša zelena
        'B1': 'bg-green-300 text-gray-800',     // zelena
        'B2': 'bg-green-200 text-gray-800',     // svetlejša zelena
        'C': 'bg-yellow-300 text-gray-800',     // rumena
        'D': 'bg-orange-400 text-white',        // oranžna
        'E': 'bg-red-400 text-white',           // svetlo rdeča
        'F': 'bg-red-500 text-white',           // rdeča
        'G': 'bg-red-600 text-white'            // temno rdeča
    };
    return colors[razred] || 'bg-gray-400 text-white';
};

const getColorClasses = (dataSource) => {
    const isNajem = dataSource === 'np';
    return {
        headerBg: isNajem ? 'bg-emerald-400' : 'bg-blue-400',
        headerText: 'text-gray-800',
        badgeBg: isNajem ? 'bg-emerald-400' : 'bg-blue-400',
        buttonBg: isNajem ? 'bg-emerald-400' : 'bg-blue-400',
        buttonHover: isNajem ? 'hover:bg-emerald-00' : 'hover:bg-blue-600'
    };
};

const getNaslov = (delStavbe) => {
    if (!delStavbe) return null;

    const parts = [];
    if (delStavbe.obcina) parts.push(`${delStavbe.obcina},`);
    if (delStavbe.naselje && delStavbe.naselje !== delStavbe.obcina && !delStavbe.ulica?.includes(delStavbe.naselje) && !delStavbe.naselje?.includes(delStavbe.ulica)) parts.push(`${delStavbe.naselje},`);
    if (delStavbe.ulica) parts.push(delStavbe.ulica);
    if (delStavbe.hisna_stevilka) parts.push(delStavbe.hisna_stevilka);
    if (delStavbe.dodatek_hs) parts.push(delStavbe.dodatek_hs);

    if (!delStavbe.ulica && !delStavbe.hisna_stevilka && !delStavbe.dodatek_hs) parts.push('NEZNAN NASLOV')
    
    const addressText = parts.join(' ');
    
    return addressText
};

const getNaslovString = (delStavbe) => {
    if (!delStavbe) return '';

    const parts = [];
    if (delStavbe.ulica) parts.push(delStavbe.ulica);
    if (delStavbe.hisna_stevilka) parts.push(delStavbe.hisna_stevilka);
    if (delStavbe.dodatek_hs) parts.push(delStavbe.dodatek_hs);

    const addressText = parts.length > 0 ? parts.join(' ') : 'NEZNAN NASLOV';
    
    return addressText;
};

const getNaslovDodatek = (delStavbe) => {
    const naslovDodatek = [];
    if (delStavbe.obcina) naslovDodatek.push(delStavbe.obcina);
    if (delStavbe.naselje && delStavbe.naselje !== delStavbe.obcina) naslovDodatek.push(delStavbe.naselje);
    if (delStavbe.stev_stanovanja) naslovDodatek.push(`št. stan: ${delStavbe.stev_stanovanja}`);

    return naslovDodatek.length > 0
        ? naslovDodatek.join(', ')
        : '';
};

const getCeloStDelaStavbe = (delStavbe) => {
    const celoStDelaStavbe = [];
    if (delStavbe.sifra_ko) celoStDelaStavbe.push(delStavbe.sifra_ko);
    if (delStavbe.stevilka_stavbe) celoStDelaStavbe.push(`-${delStavbe.stevilka_stavbe}`);
    if (delStavbe.stevilka_dela_stavbe) celoStDelaStavbe.push(`-${delStavbe.stevilka_dela_stavbe}`);
    if (delStavbe.ime_ko) celoStDelaStavbe.push(` (${delStavbe.ime_ko})`);

    return celoStDelaStavbe;
};

const sortPosli  = (posli, dataSource) => {
    return posli.sort((a, b) => {

        let sortingDatumA, sortingDatumB;

        if (dataSource === 'np') {

            if (a.datum_zacetka_najemanja === b.datum_zacetka_najemanja) {
                sortingDatumA = a.datum_zakljucka_najema;
                sortingDatumB = b.datum_zakljucka_najema;
            } else {
                sortingDatumA = a.datum_zacetka_najemanja;
                sortingDatumB = b.datum_zacetka_najemanja;
            }

        } else {

            if (a.datum_sklenitve === b.datum_sklenitve) {
                sortingDatumA = a.datum_uveljavitve;
                sortingDatumB = b.datum_uveljavitve;
            } else {
                sortingDatumA = a.datum_sklenitve;
                sortingDatumB = b.datum_sklenitve;
            }

        }

        if (!sortingDatumA && !sortingDatumB) return 0;
        if (!sortingDatumA) return 1;
        if (!sortingDatumB) return -1;

        return new Date(sortingDatumB) - new Date(sortingDatumA);
    });
}

const sortEnergetskeIzkaznice = (ei) => {
    return ei.sort((a, b) => {
        if (!a.datum_izdelave) return 1;
        if (!b.datum_izdelave) return -1;
        return new Date(b.datum_izdelave) - new Date(a.datum_izdelave);
    });
}

export {
    getTrznostPosla,
    getVrstaDelaStavbe,
    getGradebnaFaza,
    getStopnjaDDV,
    getCasNajemanja,
    getVrstaAkta,
    getVrstaNajemnegaPosla,
    getVrstaProdajnegaPosla,
    getDaBoljNe,
    getNeBoljDa,
    getEnergyClassColor,
    getColorClasses,
    getNaslov,
    getNaslovDodatek,
    getCeloStDelaStavbe,
    sortPosli  as sortPosli,
    sortEnergetskeIzkaznice,
    getNaslovString
};