const ClusterPopup = ({ properties }) => {
    const count = properties.point_count || 0;
    const clusterId = properties.cluster_id || 'unknown';
    const clusterType = properties.cluster_type || 'unknown';
    const deduplicatedIds = properties.deduplicated_ids || [];
    

    const avgPrice = properties.avg_price ? `${properties.avg_price.toLocaleString()} €` : 'Ni podatka';
    const minPrice = properties.min_price ? `${properties.min_price.toLocaleString()} €` : 'Ni podatka';
    const maxPrice = properties.max_price ? `${properties.max_price.toLocaleString()} €` : 'Ni podatka';
    
    const actionText = clusterType === 'building' ? 'Prikaži nepremičnine' : 'Približaj skupino';
    const actionDescription = clusterType === 'building' ? 
        'Kliknite za prikaz vseh nepremičnin v stavbi' : 
        'Povečajte za več podrobnosti';
    
    return `
        <div class="font-sans bg-white rounded-lg overflow-hidden">
            <!-- Modro zglavje -->
            <div class="bg-[rgb(59,130,246)] text-white p-4">
                <h3 class="font-bold text-lg mb-1">
                    ${clusterType === 'building' ? 'Stavba' : 'Skupina nepremičnin'}
                </h3>
                <div class="text-sm opacity-90">
                    ${clusterType === 'building' ? 'Več nepremičnin v isti stavbi' : 'Geografsko povezane nepremičnine'}
                </div>
            </div>

            <!-- Vsebina -->
            <div class="p-4">
                <div class="grid grid-cols-2 gap-y-2 text-sm">
                    <div class="text-gray-600">Število nepremičnin:</div>
                    <div class="font-medium">${count}</div>
                    
                    <div class="text-gray-600">Tip skupine:</div>
                    <div class="font-medium">${clusterType === 'building' ? 'Stavba' : 'Geografska'}</div>
                    
                    ${deduplicatedIds.length > 0 ? `
                    <div class="text-gray-600">Deduplicirani IDs:</div>
                    <div class="font-medium text-xs">${deduplicatedIds.length} zapisov</div>
                    ` : ''}
                    
                    ${properties.sifra_ko ? `
                    <div class="text-gray-600">Šifra KO:</div>
                    <div class="font-medium">${properties.sifra_ko}</div>
                    ` : ''}
                    
                    ${properties.stevilka_stavbe ? `
                    <div class="text-gray-600">Št. stavbe:</div>
                    <div class="font-medium">${properties.stevilka_stavbe}</div>
                    ` : ''}
                </div>
                
                <!-- Price info if available -->
                ${(avgPrice !== 'Ni podatka' || minPrice !== 'Ni podatka' || maxPrice !== 'Ni podatka') ? `
                <hr class="my-3 border-gray-200">
                <div class="grid grid-cols-2 gap-y-1 text-xs">
                    ${avgPrice !== 'Ni podatka' ? `
                    <div class="text-gray-600">Povprečna cena:</div>
                    <div class="font-medium">${avgPrice}</div>
                    ` : ''}
                    
                    ${minPrice !== 'Ni podatka' ? `
                    <div class="text-gray-600">Min. cena:</div>
                    <div class="font-medium">${minPrice}</div>
                    ` : ''}
                    
                    ${maxPrice !== 'Ni podatka' ? `
                    <div class="text-gray-600">Max. cena:</div>
                    <div class="font-medium">${maxPrice}</div>
                    ` : ''}
                </div>
                ` : ''}
                
                <!-- Info about action -->
                <div class="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                    ${actionDescription}
                </div>
                
                <!-- Moder gumb za akcijo -->
                <div class="mt-4 text-center">
                    <button 
                        class="bg-[rgb(59,130,246)] hover:bg-[rgb(29,100,216)] text-white py-2 px-4 rounded text-sm transition-colors duration-200 w-full"
                        id="btnZoomCluster_${clusterId}"
                    >
                        ${actionText}
                    </button>
                </div>
                
                <!-- Debug info (only in development) -->
                ${window.location.hostname === 'localhost' ? `
                <div class="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                    <div>Debug: ${clusterId}</div>
                    <div>Type: ${clusterType}</div>
                    ${deduplicatedIds.length > 0 ? `<div>IDs: ${deduplicatedIds.slice(0, 3).join(', ')}${deduplicatedIds.length > 3 ? '...' : ''}</div>` : ''}
                </div>
                ` : ''}
            </div>
        </div>
    `;
};

export default ClusterPopup;