const ClusterPopup = ({ properties }) => {
    const count = properties.point_count || 0;
    const clusterId = properties.cluster_id || 'unknown';
    const avgPrice = properties.avg_price ? `${properties.avg_price.toLocaleString()} €` : 'Ni podatka';
    const minPrice = properties.min_price ? `${properties.min_price.toLocaleString()} €` : 'Ni podatka';
    const maxPrice = properties.max_price ? `${properties.max_price.toLocaleString()} €` : 'Ni podatka';
    
    return `
        <div class="font-sans bg-white rounded-lg overflow-hidden">
            <!-- Modro zglavje -->
            <div class="bg-[rgb(59,130,246)] text-white p-4">
                <h3 class="font-bold text-lg mb-1">Skupina nepremičnin</h3>
            </div>

            <!-- Vsebina -->
            <div class="p-4">
                <div class="grid grid-cols-2 gap-y-2 text-sm">
                    <div class="text-gray-600">Število nepremičnin:</div>
                    <div class="font-medium">${count}</div>
                    
                    <div class="text-gray-600">Povprečna cena:</div>
                    <div class="font-medium">${avgPrice}</div>
                    
                    <div class="text-gray-600">Min. cena:</div>
                    <div class="font-medium">${minPrice}</div>
                    
                    <div class="text-gray-600">Max. cena:</div>
                    <div class="font-medium">${maxPrice}</div>
                </div>
                
                <!-- Moder gumb za približanje -->
                <div class="mt-4 text-center">
                    <button 
                        class="bg-[rgb(59,130,246)] hover:bg-[rgb(29,100,216)] text-white py-2 px-4 rounded text-sm transition-colors duration-200 w-full"
                        id="btnZoomCluster_${clusterId}"
                    >
                        Približaj skupino
                    </button>
                </div>
            </div>
        </div>
    `;
};

export default ClusterPopup;