import maplibregl from "maplibre-gl";
import IndividualPopup from "./IndividualPopup";
import ClusterExpander from "./ClusterExpander";

// Razred za upravljanje popupov
class PopupManager {
    constructor(map) {
        this.map = map;
        this.currentPopup = null;
        this.currentDataSourceType = 'prodaja';
        this.onPropertySelectCallback = null;

        // Inicializiraj ClusterExpander
        this.clusterExpander = new ClusterExpander(map);
    }

    updateDataSourceType(newType) {
        console.log(`PopupManager: Data source changing from ${this.currentDataSourceType} to ${newType}`);
        
        // AVTOMATSKI CLEANUP: Zapri vse expanded clustre pri menjavi data source
        this.clusterExpander.collapseAllClusters();
        
        this.currentDataSourceType = newType;
        // Posodobi tudi expansion manager
        this.clusterExpander.updateDataSourceType(newType);
        console.log(`PopupManager: Data source changed to: ${newType}`);
    }

    setupEventHandlers(onPropertySelect) {
        // Shrani callback
        this.onPropertySelectCallback = onPropertySelect;

        // Počistimo stare handlere
        this.cleanupEventHandlers();

        // Handler za individualne nepremičnine - ENAK handler za oba layer-ja
        this.map._propertiesClickHandler = (e) => {
            const features = e.features[0];
            const properties = features.properties;

            if (properties.type === 'individual') {
                this.showPropertyPopup(e.lngLat, properties, onPropertySelect);
            }
        };

        // Handler za clustre - sedaj z uporabo ClusterExpander
        this.map._clustersClickHandler = async (e) => {
            const features = e.features[0];
            const properties = features.properties;

            if (properties.type === 'cluster') {
                await this.handleClusterClick(e.lngLat, properties);
            }
        };

        // Handler za expanded properties preko custom event
        this.map._expandedPropertyHandler = (e) => {
            const { lngLat, properties } = e.detail;
            console.log('Handling expanded property click via custom event');
            this.showPropertyPopup(lngLat, properties, onPropertySelect);
        };

        // POSODOBLJENO: Dodamo click handlere za oba properties layer-ja
        this.map.on('click', 'properties-layer', this.map._propertiesClickHandler);
        this.map.on('click', 'properties-text-layer', this.map._propertiesClickHandler); // NOVO
        this.map.on('click', 'clusters-layer', this.map._clustersClickHandler);

        // Dodamo handler za expanded properties
        this.map.getContainer().addEventListener('expandedPropertyClick', this.map._expandedPropertyHandler);

        this.setupHoverHandlers();
    }

    // Glavna funkcija za handling cluster clickov
    async handleClusterClick(lngLat, clusterProperties) {
        const clusterId = clusterProperties.cluster_id;

        console.log(`PopupManager: Handling cluster click for ${clusterId}`);

        try {
            // Poskusi expandirati cluster preko ClusterExpander
            const wasExpanded = await this.clusterExpander.handleClusterClick(lngLat, clusterProperties);

        } catch (error) {
            console.error('Error handling cluster click:', error);
            // Fallback na običajen cluster popup
            this.showClusterPopup(lngLat, clusterProperties);
        }
    }

    // Prikaz popupa za posamezno nepremičnino
    showPropertyPopup(lngLat, properties, onPropertySelect) {
        const popupContent = IndividualPopup({
            properties,
            dataSourceType: this.currentDataSourceType
        });

        this.closeCurrentPopup();

        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '320px',
            className: 'custom-popup'
        })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);

        // Setup details button event listener
        setTimeout(() => {
            const detailsButton = document.getElementById(`btnShowDetails_${properties.id}`);
            if (detailsButton) {
                detailsButton.addEventListener('click', () => {
                    const dataSource = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
                    onPropertySelect({
                        ...properties,
                        dataSource: dataSource,
                        deduplicatedId: properties.id
                    });

                    this.closeCurrentPopup();
                });
            }
        }, 100);
    }

    // Zapri trenutni popup
    closeCurrentPopup() {
        if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
        }
    }

    // NOVA FUNKCIJA: Cleanup za menjavo občine
    handleMunicipalityChange() {
        console.log('PopupManager: Municipality change detected - cleaning up clusters');
        this.clusterExpander.collapseAllClusters();
        this.closeCurrentPopup();
    }

    // NOVA FUNKCIJA: Cleanup za reset občine
    handleMunicipalityReset() {
        console.log('PopupManager: Municipality reset detected - cleaning up everything');
        this.clusterExpander.collapseAllClusters();
        this.closeCurrentPopup();
    }

    // NOVA FUNKCIJA: Cleanup za zoom events
    handleZoomChange() {
        console.log('PopupManager: Zoom change detected - cleaning up clusters');
        this.clusterExpander.collapseAllClusters();
        // Ne zapiramo popup-a pri zoom-u, samo clustre
    }

    // NOVA FUNKCIJA: Cleanup za reload podatkov
    handleDataReload() {
        console.log('PopupManager: Data reload detected - cleaning up clusters');
        this.clusterExpander.collapseAllClusters();
        this.closeCurrentPopup();
    }

    // Debug funkcija za cluster properties
    async debugClusterProperties(clusterProperties) {
        const clusterId = clusterProperties.cluster_id;
        const dataSource = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';

        console.log('=== CLUSTER DEBUG ===');
        console.log('Cluster ID:', clusterId);
        console.log('Cluster type:', clusterProperties.cluster_type);
        console.log('Point count:', clusterProperties.point_count);
        console.log('Data source:', dataSource);
        console.log('Deduplicated IDs:', clusterProperties.deduplicated_ids);

        if (!clusterId.startsWith('b_') && !clusterId.startsWith('d_')) {
            console.log('Unknown cluster type - ni podrobnih podatkov');
            return;
        }

        try {
            const currentZoom = this.map.getZoom();
            const url = `http://localhost:8000/cluster/${clusterId}/properties?data_source=${dataSource}&zoom=${currentZoom}`;
            console.log('Fetching cluster details from:', url);

            const response = await fetch(url);

            if (!response.ok) {
                console.log('Error response:', response.status);
                return;
            }

            const data = await response.json();
            console.log('=== CLUSTER PROPERTIES ===');
            console.log(`Found ${data.features.length} deduplicated properties in cluster:`);

            data.features.forEach((feature, index) => {
                const props = feature.properties;
                const address = `${props.ulica || ''} ${props.hisna_stevilka || ''}`.trim() || 'Brez naslova';

                console.log(`${index + 1}. ${address}`);
                console.log(`   - Deduplicated ID: ${props.id}`);
                console.log(`   - Površina: ${props.povrsina || 'N/A'} m²`);
                console.log(`   - Posli: ${props.stevilo_poslov || 1}`);
                console.log(`   - Koordinate: [${feature.geometry.coordinates[0].toFixed(6)}, ${feature.geometry.coordinates[1].toFixed(6)}]`);
                console.log('   ---');
            });

            console.log('=== END CLUSTER DEBUG ===');

        } catch (error) {
            console.error('Error fetching cluster properties:', error);
        }
    }

    setupHoverHandlers() {
        if (!this.map._propertiesHoverHandler) {
            this.map._propertiesHoverHandler = () => {
                this.map.getCanvas().style.cursor = 'pointer';
            };

            this.map._propertiesLeaveHandler = () => {
                this.map.getCanvas().style.cursor = '';
            };

            // Hover handlers za oba properties layer-ja
            this.map.on('mouseenter', 'properties-layer', this.map._propertiesHoverHandler);
            this.map.on('mouseleave', 'properties-layer', this.map._propertiesLeaveHandler);

            // NOVO: Hover handlers za text layer
            this.map.on('mouseenter', 'properties-text-layer', this.map._propertiesHoverHandler);
            this.map.on('mouseleave', 'properties-text-layer', this.map._propertiesLeaveHandler);

            this.map.on('mouseenter', 'clusters-layer', this.map._propertiesHoverHandler);
            this.map.on('mouseleave', 'clusters-layer', this.map._propertiesLeaveHandler);
        }
    }

    // Cleanup event handlerjev
    cleanupEventHandlers() {
        if (this.map._propertiesClickHandler) {
            this.map.off('click', 'properties-layer', this.map._propertiesClickHandler);
            this.map.off('click', 'properties-text-layer', this.map._propertiesClickHandler); // NOVO
            delete this.map._propertiesClickHandler;
        }

        if (this.map._clustersClickHandler) {
            this.map.off('click', 'clusters-layer', this.map._clustersClickHandler);
            delete this.map._clustersClickHandler;
        }

        if (this.map._expandedPropertyHandler) {
            this.map.getContainer().removeEventListener('expandedPropertyClick', this.map._expandedPropertyHandler);
            delete this.map._expandedPropertyHandler;
        }
    }

    // Cleanup hover handlerjev
    cleanupHoverHandlers() {
        if (this.map._propertiesHoverHandler) {
            this.map.off('mouseenter', 'properties-layer', this.map._propertiesHoverHandler);
            this.map.off('mouseleave', 'properties-layer', this.map._propertiesLeaveHandler);

            // NOVO: Cleanup za text layer
            this.map.off('mouseenter', 'properties-text-layer', this.map._propertiesHoverHandler);
            this.map.off('mouseleave', 'properties-text-layer', this.map._propertiesLeaveHandler);

            this.map.off('mouseenter', 'clusters-layer', this.map._propertiesHoverHandler);
            this.map.off('mouseleave', 'clusters-layer', this.map._propertiesLeaveHandler);
            delete this.map._propertiesHoverHandler;
            delete this.map._propertiesLeaveHandler;
        }
    }

    // Glavna cleanup funkcija
    cleanup() {
        console.log('PopupManager: Starting cleanup...');

        // Cleanup expansion manager
        if (this.clusterExpander) {
            this.clusterExpander.cleanup();
        }

        // Cleanup event handlers
        this.cleanupEventHandlers();
        this.cleanupHoverHandlers();

        // Cleanup popup
        this.closeCurrentPopup();

        // Reset callbacks
        this.onPropertySelectCallback = null;

        console.log('PopupManager: Cleanup completed');
    }

    // Public API za dostop do expansion manager funkcionalnosti
    collapseAllClusters() {
        this.clusterExpander.collapseAllClusters();
    }

    isClusterExpanded(clusterId) {
        return this.clusterExpander.isClusterExpanded(clusterId);
    }
}

export default PopupManager;