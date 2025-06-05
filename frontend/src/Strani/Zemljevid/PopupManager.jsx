// components/PopupManager.jsx
import maplibregl from "maplibre-gl";
import { LAYER_IDS, UI_CONFIG, TIMEOUTS } from './MapConstants.jsx';
import { getApiDataSource } from './MapUtils.jsx';
import IndividualPopup from "./IndividualPopup";
import ClusterExpander from "./ClusterExpander";

class PopupManager {
    constructor(map) {
        this.map = map;
        this.currentPopup = null;
        this.currentDataSourceType = 'prodaja';
        this.currentFilters = {};
        this.onPropertySelectCallback = null;
        this.eventHandlers = {};

        // Inicializacija cluster expanderja
        this.clusterExpander = new ClusterExpander(map);
    }

    updateDataSourceType(newType) {
        console.log(`PopupManager: Data source changing from ${this.currentDataSourceType} to ${newType}`);
        
        this.clusterExpander.collapseAllClusters();
        this.currentDataSourceType = newType;
        this.clusterExpander.updateDataSourceType(newType);
        
        console.log(`PopupManager: Data source changed to: ${newType}`);
    }

    updateFilters(newFilters) {
        this.currentFilters = newFilters || {};
        this.clusterExpander.updateFilters(this.currentFilters);
        console.log(`PopupManager: Filters updated:`, this.currentFilters);
    }

    setupEventHandlers(onPropertySelect) {
        this.onPropertySelectCallback = onPropertySelect;
        this._cleanupEventHandlers();

        // Setup glavnih click hanlerjev
        this._setupPropertyClickHandlers();
        this._setupClusterClickHandlers();
        this._setupExpandedPropertyHandlers();
        this._setupHoverHandlers();
    }

    _setupPropertyClickHandlers() {
        const handler = (e) => {
            const feature = e.features[0];
            if (feature.properties.type === 'individual') {
                this._showPropertyPopup(e.lngLat, feature.properties);
            }
        };

        [LAYER_IDS.PROPERTIES.MAIN, LAYER_IDS.PROPERTIES.TEXT].forEach(layerId => {
            this.map.on('click', layerId, handler);
        });

        this.eventHandlers.propertyClick = handler;
    }

    _setupClusterClickHandlers() {
        const handler = async (e) => {
            const feature = e.features[0];
            if (feature.properties.type === 'cluster') {
                await this._handleClusterClick(e.lngLat, feature.properties);
            }
        };

        this.map.on('click', LAYER_IDS.CLUSTERS.MAIN, handler);
        this.eventHandlers.clusterClick = handler;
    }

    _setupExpandedPropertyHandlers() {
        const handler = (e) => {
            const { lngLat, properties } = e.detail;
            console.log('Handling expanded property click via custom event');
            this._showPropertyPopup(lngLat, properties);
        };

        this.map.getContainer().addEventListener('expandedPropertyClick', handler);
        this.eventHandlers.expandedPropertyClick = handler;
    }

    _setupHoverHandlers() {
        const hoverLayers = [
            LAYER_IDS.PROPERTIES.MAIN,
            LAYER_IDS.PROPERTIES.TEXT,
            LAYER_IDS.CLUSTERS.MAIN
        ];

        const enterHandler = () => {
            this.map.getCanvas().style.cursor = 'pointer';
        };

        const leaveHandler = () => {
            this.map.getCanvas().style.cursor = '';
        };

        hoverLayers.forEach(layerId => {
            this.map.on('mouseenter', layerId, enterHandler);
            this.map.on('mouseleave', layerId, leaveHandler);
        });

        this.eventHandlers.hoverEnter = enterHandler;
        this.eventHandlers.hoverLeave = leaveHandler;
        this.eventHandlers.hoverLayers = hoverLayers;
    }

    async _handleClusterClick(lngLat, clusterProperties) {
        const clusterId = clusterProperties.cluster_id;
        console.log(`PopupManager: Handling cluster click for ${clusterId}`);

        try {
            const wasExpanded = await this.clusterExpander.handleClusterClick(lngLat, clusterProperties);
            
            if (!wasExpanded) {

                this._showClusterInfo(lngLat, clusterProperties);
            }
        } catch (error) {
            console.error('Error handling cluster click:', error);
            this._showClusterInfo(lngLat, clusterProperties);
        }
    }

    _showPropertyPopup(lngLat, properties) {
        const popupContent = IndividualPopup({
            properties,
            dataSourceType: this.currentDataSourceType
        });

        this._closeCurrentPopup();

        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: UI_CONFIG.POPUP.MAX_WIDTH,
            className: UI_CONFIG.POPUP.CLASS_NAME
        })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);

        this._setupPopupDetailsButton(properties);
    }

    _setupPopupDetailsButton(properties) {
        setTimeout(() => {
            const detailsButton = document.getElementById(`btnShowDetails_${properties.id}`);
            if (detailsButton && this.onPropertySelectCallback) {
                detailsButton.addEventListener('click', () => {
                    const dataSource = getApiDataSource(this.currentDataSourceType);
                    this.onPropertySelectCallback({
                        ...properties,
                        dataSource: dataSource,
                        deduplicatedId: properties.id
                    });
                    this._closeCurrentPopup();
                });
            }
        }, TIMEOUTS.POPUP_SETUP);
    }

    _showClusterInfo(lngLat, clusterProperties) {
        const content = `
            <div class="cluster-popup">
                <h3>Cluster ${clusterProperties.cluster_id}</h3>
                <p>Nepremičnin: ${clusterProperties.point_count}</p>
                <p>Tip: ${clusterProperties.cluster_type || 'Unknown'}</p>
            </div>
        `;

        this._closeCurrentPopup();

        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: UI_CONFIG.POPUP.MAX_WIDTH
        })
            .setLngLat(lngLat)
            .setHTML(content)
            .addTo(this.map);
    }

    _closeCurrentPopup() {
        if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
        }
    }

    // Cleanup metode za razlicne scenarije
    handleMunicipalityChange() {
        console.log('PopupManager: Municipality change detected - cleaning up clusters');
        this.clusterExpander.collapseAllClusters();
        this._closeCurrentPopup();
    }

    handleMunicipalityReset() {
        console.log('PopupManager: Municipality reset detected - cleaning up everything');
        this.clusterExpander.collapseAllClusters();
        this._closeCurrentPopup();
    }

    handleZoomChange() {
        console.log('PopupManager: Zoom change detected - cleaning up clusters');
        this.clusterExpander.collapseAllClusters();
        // zapre clustre na zoomu ne pa popupe
    }

    handleDataReload() {
        console.log('PopupManager: Data reload detected - cleaning up clusters');
        this.clusterExpander.collapseAllClusters();
        this._closeCurrentPopup();
    }

    handleFiltersChange(newFilters) {
        console.log('PopupManager: Filters change detected - updating cluster expander');
        this.updateFilters(newFilters);
        this.clusterExpander.collapseAllClusters();
    }

    // Api za cluster management
    collapseAllClusters() {
        this.clusterExpander.collapseAllClusters();
    }

    isClusterExpanded(clusterId) {
        return this.clusterExpander.isClusterExpanded(clusterId);
    }

    _cleanupEventHandlers() {
        // Odstrani property click handlerje
        if (this.eventHandlers.propertyClick) {
            [LAYER_IDS.PROPERTIES.MAIN, LAYER_IDS.PROPERTIES.TEXT].forEach(layerId => {
                this.map.off('click', layerId, this.eventHandlers.propertyClick);
            });
        }

        // Odstrani cluster click handler
        if (this.eventHandlers.clusterClick) {
            this.map.off('click', LAYER_IDS.CLUSTERS.MAIN, this.eventHandlers.clusterClick);
        }

        // Odstrani expanded property handler
        if (this.eventHandlers.expandedPropertyClick) {
            this.map.getContainer().removeEventListener('expandedPropertyClick', this.eventHandlers.expandedPropertyClick);
        }

        // Odstrani hover handlerje
        if (this.eventHandlers.hoverLayers && this.eventHandlers.hoverEnter && this.eventHandlers.hoverLeave) {
            this.eventHandlers.hoverLayers.forEach(layerId => {
                this.map.off('mouseenter', layerId, this.eventHandlers.hoverEnter);
                this.map.off('mouseleave', layerId, this.eventHandlers.hoverLeave);
            });
        }

        this.eventHandlers = {};
    }

    cleanup() {
        console.log('PopupManager: Starting cleanup...');

        // Pocisti clsuter expander
        if (this.clusterExpander) {
            this.clusterExpander.cleanup();
        }

        // Pocisti event handlerje
        this._cleanupEventHandlers();

        // Pocisti popup
        this._closeCurrentPopup();

        // Resetira callback-e
        this.onPropertySelectCallback = null;

        console.log('PopupManager: Cleanup completed');
    }
}

export default PopupManager;