import { 
    CLUSTER_CONFIG, 
    LAYER_IDS,
} from './MapConstants.jsx';
import {
    buildClusterDetailsUrl,
    calculateClusterCenter,
    calculateExpansionRadius,
    getDataSourceType,
    handleApiError
} from './MapUtils.jsx';
import LayerManager from './LayerManager.jsx';

class ClusterExpander {
    constructor(map) {
        this.map = map;
        this.layerManager = new LayerManager(map);
        this.expandedClusters = new Set();
        this.currentDataSourceType = 'prodaja';
        this.currentFilters = {}; // Add filters storage
    }

    updateDataSourceType(newType) {
        this.collapseAllClusters();
        this.currentDataSourceType = newType;
    }

    // Add method to update filters
    updateFilters(newFilters) {
        this.currentFilters = newFilters || {};
    }

    async handleClusterClick(lngLat, clusterProperties) {
        const clusterId = clusterProperties.cluster_id;


        // Toggle expansion
        if (this.expandedClusters.has(clusterId)) {
            this.collapseCluster(clusterId);
            return true;
        }

        // Collapse other clusters
        this.collapseAllClusters();

        // Check if cluster is expandable
        if (!this._isExpandableCluster(clusterId)) {
            return false;
        }

        try {
            await this.expandCluster(clusterId, clusterProperties);
            return true;
        } catch (error) {
            console.error('Error expanding cluster:', error);
            return false;
        }
    }

    async expandCluster(clusterId, clusterProperties) {
        const dataSource = this._getClusterDataSource(clusterProperties);
        const currentZoom = this.map.getZoom();


        try {
            const url = buildClusterDetailsUrl(clusterId, dataSource, currentZoom, this.currentFilters);
            
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.features || data.features.length === 0) {
                throw new Error('No properties found');
            }

            await this._createExpandedVisualization(clusterId, data.features, clusterProperties, dataSource);
            this.expandedClusters.add(clusterId);
            
            return true;

        } catch (error) {
            handleApiError(error, `expanding cluster ${clusterId}`);
            throw error;
        }
    }

    async _createExpandedVisualization(clusterId, properties, originalClusterProperties, dataSource) {
        // Calculate center and arrange properties
        const centerCoords = calculateClusterCenter(properties, originalClusterProperties);
        if (!centerCoords) {
            throw new Error('Could not determine cluster center position');
        }

        const arrangedProperties = this._arrangePropertiesInCircles(properties, centerCoords);
        const dataSourceType = getDataSourceType(dataSource);

        // Create layers using LayerManager
        const { layerId, textLayerId } = this.layerManager.addExpandedClusterLayers(
            clusterId, 
            arrangedProperties, 
            dataSourceType
        );

        // Setup event handlers
        this._setupExpandedLayerHandlers(layerId, textLayerId);

    }

    _arrangePropertiesInCircles(properties, centerCoords) {
        const totalProperties = properties.length;


        if (totalProperties <= CLUSTER_CONFIG.EXPANSION.SINGLE_CIRCLE_MAX) {

            return this._arrangeInSingleCircle(properties, centerCoords);

        } else {

            return this._arrangeInDualCircles(properties, centerCoords);
        }
    }

    _arrangeInSingleCircle(properties, centerCoords) {
        const [centerLng, centerLat] = centerCoords;
        const radius = calculateExpansionRadius(this.map.getZoom());

        return properties.map((prop, index) => {
            const angle = (2 * Math.PI * index) / properties.length;
            const offsetLng = centerLng + (radius * Math.cos(angle));
            const offsetLat = centerLat + (radius * Math.sin(angle));


            return {
                ...prop,
                geometry: {
                    ...prop.geometry,
                    coordinates: [offsetLng, offsetLat]
                }
            };
        });
    }

    _arrangeInDualCircles(properties, centerCoords) {
        const [centerLng, centerLat] = centerCoords;
        const baseRadius = calculateExpansionRadius(this.map.getZoom());
        
        const innerRadius = baseRadius * CLUSTER_CONFIG.EXPANSION.RADIUS_MULTIPLIERS.INNER;
        const outerRadius = baseRadius * CLUSTER_CONFIG.EXPANSION.RADIUS_MULTIPLIERS.OUTER;

        const totalProperties = properties.length;
        const innerCircleCount = Math.min(
            CLUSTER_CONFIG.EXPANSION.INNER_CIRCLE_MAX,
            Math.floor(totalProperties * CLUSTER_CONFIG.EXPANSION.INNER_CIRCLE_PERCENTAGE)
        );
        const outerCircleCount = totalProperties - innerCircleCount;


        const modifiedProperties = [];

        // Inner circle
        for (let i = 0; i < innerCircleCount; i++) {
            const angle = (2 * Math.PI * i) / innerCircleCount;
            const offsetLng = centerLng + (innerRadius * Math.cos(angle));
            const offsetLat = centerLat + (innerRadius * Math.sin(angle));


            modifiedProperties.push({
                ...properties[i],
                geometry: {
                    ...properties[i].geometry,
                    coordinates: [offsetLng, offsetLat]
                }
            });
        }

        // Outer circle
        for (let i = 0; i < outerCircleCount; i++) {
            const propertyIndex = innerCircleCount + i;
            const angle = (2 * Math.PI * i) / outerCircleCount;
            const angleOffset = Math.PI / outerCircleCount;
            const adjustedAngle = angle + angleOffset;

            const offsetLng = centerLng + (outerRadius * Math.cos(adjustedAngle));
            const offsetLat = centerLat + (outerRadius * Math.sin(adjustedAngle));

            modifiedProperties.push({
                ...properties[propertyIndex],
                geometry: {
                    ...properties[propertyIndex].geometry,
                    coordinates: [offsetLng, offsetLat]
                }
            });
        }

        return modifiedProperties;
    }

    _setupExpandedLayerHandlers(layerId, textLayerId) {
        const clickHandler = (e) => {
            const feature = e.features[0];
            if (feature.properties.type === 'individual') {
                const clickEvent = new CustomEvent('expandedPropertyClick', {
                    detail: {
                        lngLat: e.lngLat,
                        properties: feature.properties
                    }
                });
                this.map.getContainer().dispatchEvent(clickEvent);
            }
        };

        const hoverEnterHandler = () => {
            this.map.getCanvas().style.cursor = 'pointer';
        };

        const hoverLeaveHandler = () => {
            this.map.getCanvas().style.cursor = '';
        };

        // Add handlers for both layers
        [layerId, textLayerId].forEach(id => {
            this.map.on('click', id, clickHandler);
            this.map.on('mouseenter', id, hoverEnterHandler);
            this.map.on('mouseleave', id, hoverLeaveHandler);
        });

        // Store handlers for cleanup
        this.map[`_${layerId}_handlers`] = { clickHandler, hoverEnterHandler, hoverLeaveHandler };
        this.map[`_${textLayerId}_handlers`] = { clickHandler, hoverEnterHandler, hoverLeaveHandler };
    }

    collapseCluster(clusterId) {

        const layerId = `${LAYER_IDS.EXPANDED.PREFIX}${clusterId}`;
        const textLayerId = `${layerId}${LAYER_IDS.EXPANDED.TEXT_SUFFIX}`;

        // Remove event handlers
        [layerId, textLayerId].forEach(id => {
            const handlers = this.map[`_${id}_handlers`];
            if (handlers) {
                this.map.off('click', id, handlers.clickHandler);
                this.map.off('mouseenter', id, handlers.hoverEnterHandler);
                this.map.off('mouseleave', id, handlers.hoverLeaveHandler);
                delete this.map[`_${id}_handlers`];
            }
        });

        // Remove layers
        this.layerManager.removeExpandedClusterLayers(clusterId);
        this.expandedClusters.delete(clusterId);

    }

    collapseAllClusters() {
        const clustersToCollapse = Array.from(this.expandedClusters);
        clustersToCollapse.forEach(clusterId => {
            this.collapseCluster(clusterId);
        });
    }

    isClusterExpanded(clusterId) {
        return this.expandedClusters.has(clusterId);
    }

    // Private helper methods
    _isExpandableCluster(clusterId) {
        return clusterId.startsWith(CLUSTER_CONFIG.TYPES.BUILDING);
    }

    _getClusterDataSource(clusterProperties) {
        if (clusterProperties.data_source) {
            return clusterProperties.data_source;
        }
        
        const fallback = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
        return fallback;
    }


    cleanup() {
        this.collapseAllClusters();
    }
}

export default ClusterExpander;