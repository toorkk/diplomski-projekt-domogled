// components/ClusterExpander.jsx
import { 
    CLUSTER_CONFIG, 
    API_CONFIG,
    LAYER_IDS,
    SOURCE_IDS 
} from './MapConstants.jsx';
import {
    buildClusterDetailsUrl,
    calculateClusterCenter,
    calculateExpansionRadius,
    getDataSourceType,
    logClusterDebug,
    logPropertyArrangement,
    handleApiError
} from './MapUtils.jsx';
import LayerManager from './LayerManager.jsx';

class ClusterExpander {
    constructor(map) {
        this.map = map;
        this.layerManager = new LayerManager(map);
        this.expandedClusters = new Set();
        this.currentDataSourceType = 'prodaja';
    }

    updateDataSourceType(newType) {
        this.collapseAllClusters();
        this.currentDataSourceType = newType;
        console.log(`ClusterExpander: Data source changed to: ${newType}`);
    }

    async handleClusterClick(lngLat, clusterProperties) {
        const clusterId = clusterProperties.cluster_id;

        this._logClusterClickDebug(clusterProperties);

        // Toggle expansion
        if (this.expandedClusters.has(clusterId)) {
            this.collapseCluster(clusterId);
            return true;
        }

        // Collapse other clusters
        this.collapseAllClusters();

        // Check if cluster is expandable
        if (!this._isExpandableCluster(clusterId)) {
            console.log('Non-expandable cluster type detected');
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

        console.log(`=== EXPANDING CLUSTER ${clusterId} ===`);
        console.log('Data source:', dataSource);
        console.log('Zoom:', currentZoom);

        try {
            const url = buildClusterDetailsUrl(clusterId, dataSource, currentZoom);
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
            
            console.log(`✓ Successfully expanded cluster ${clusterId} with ${data.features.length} properties`);
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

        console.log(`Created expanded visualization for ${clusterId}`);
    }

    _arrangePropertiesInCircles(properties, centerCoords) {
        const totalProperties = properties.length;

        console.log(`Arranging ${totalProperties} properties in circle(s)`);

        if (totalProperties <= CLUSTER_CONFIG.EXPANSION.SINGLE_CIRCLE_MAX) {
            console.log('Using single circle layout');
            return this._arrangeInSingleCircle(properties, centerCoords);
        } else {
            console.log('Using dual circle layout');
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

            logPropertyArrangement(index, [offsetLng, offsetLat], 'single');

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

        console.log(`Dual circles: ${innerCircleCount} inner, ${outerCircleCount} outer`);

        const modifiedProperties = [];

        // Inner circle
        for (let i = 0; i < innerCircleCount; i++) {
            const angle = (2 * Math.PI * i) / innerCircleCount;
            const offsetLng = centerLng + (innerRadius * Math.cos(angle));
            const offsetLat = centerLat + (innerRadius * Math.sin(angle));

            logPropertyArrangement(i, [offsetLng, offsetLat], 'inner');

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

            logPropertyArrangement(propertyIndex, [offsetLng, offsetLat], 'outer');

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
        console.log(`Collapsing cluster ${clusterId}...`);

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

        console.log(`Collapsed cluster ${clusterId}`);
    }

    collapseAllClusters() {
        console.log('Collapsing all expanded clusters...');
        const clustersToCollapse = Array.from(this.expandedClusters);
        clustersToCollapse.forEach(clusterId => {
            this.collapseCluster(clusterId);
        });
        console.log(`Collapsed ${clustersToCollapse.length} clusters`);
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
            console.log(`Using data_source from cluster properties: ${clusterProperties.data_source}`);
            return clusterProperties.data_source;
        }
        
        const fallback = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
        console.log(`Using fallback data_source: ${fallback}`);
        return fallback;
    }

    _logClusterClickDebug(clusterProperties) {
        console.log('=== CLUSTER CLICK DEBUG ===');
        console.log('Cluster properties:', clusterProperties);
        console.log('Cluster data_source property:', clusterProperties.data_source);
        console.log('ClusterExpander currentDataSourceType:', this.currentDataSourceType);
    }

    cleanup() {
        this.collapseAllClusters();
        console.log('ClusterExpander cleaned up');
    }
}

export default ClusterExpander;