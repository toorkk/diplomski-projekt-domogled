// ClusterExpander.jsx
class ClusterExpander {
    constructor(map) {
        this.map = map;
        this.expandedClusters = new Set(); // Track kateri clustri so expandirani
        this.currentDataSourceType = 'prodaja';
    }

    updateDataSourceType(newType) {
        this.collapseAllClusters();
        this.currentDataSourceType = newType;
        console.log(`ClusterExpander: Data source changed to: ${newType}`);
    }

    // Glavna funkcija za handling cluster click
    async handleClusterClick(lngLat, clusterProperties) {
        const clusterId = clusterProperties.cluster_id;
        
        // Če je cluster že expandiran, ga collapse
        if (this.expandedClusters.has(clusterId)) {
            this.collapseCluster(clusterId);
            return;
        }

        // Zapri vse druge expanded clustre
        this.collapseAllClusters();

        // Preverimo tip clusterja
        if (clusterId.startsWith('b_')) {
            console.log('Building cluster detected, attempting expansion...');
            await this.expandCluster(clusterId, clusterProperties);
        } else {
            console.log('Non-expandable cluster type detected');
            return false; // Povej popup managerju da prikaže običajen popup
        }
        
        return true; // Cluster je bil uspešno expanded
    }

    // Expandiraj cluster z API klicem
    async expandCluster(clusterId, clusterProperties) {
        const dataSource = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
        const currentZoom = this.map.getZoom();
        
        console.log(`=== EXPANDING CLUSTER ${clusterId} ===`);
        console.log('Data source:', dataSource);
        
        try {
            const url = `http://localhost:8000/cluster/${clusterId}/properties?data_source=${dataSource}&zoom=${currentZoom}`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error('Error fetching cluster properties:', response.status);
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API Response data:', data);
            console.log('Features received:', data.features?.length || 0);
            
            if (data.features && data.features.length > 0) {
                this.createExpandedLayer(clusterId, data.features, clusterProperties);
                this.expandedClusters.add(clusterId);
                console.log(`✓ Successfully expanded cluster ${clusterId} with ${data.features.length} properties`);
                return true;
            } else {
                console.log('No valid properties found in cluster response');
                throw new Error('No properties found');
            }
            
        } catch (error) {
            console.error('Error expanding cluster:', error);
            throw error; // Re-throw da lahko popup manager pokaže fallback
        }
    }

    // Expandiraj cluster z že znanimi IDs (alternativna metoda)
    async expandClusterWithIds(clusterId, clusterProperties) {
        const dataSource = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
        
        console.log('Expanding cluster with deduplicated IDs:', clusterProperties.deduplicated_ids);
        
        try {
            const features = [];
            
            for (const deduplicatedId of clusterProperties.deduplicated_ids) {
                const feature = {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0] // Bodo popravljene v createExpandedLayer
                    },
                    properties: {
                        id: deduplicatedId,
                        type: "individual",
                        data_source: dataSource,
                        cluster_expanded: true
                    }
                };
                features.push(feature);
            }
            
            if (features.length > 0) {
                this.createExpandedLayer(clusterId, features, clusterProperties);
                this.expandedClusters.add(clusterId);
                return true;
            } else {
                throw new Error('No valid features created from deduplicated_ids');
            }
            
        } catch (error) {
            console.error('Error expanding cluster with IDs:', error);
            throw error;
        }
    }

    // Ustvari vizualni layer za expanded properties
    createExpandedLayer(clusterId, properties, originalClusterProperties = null) {
        const sourceId = `expanded-${clusterId}`;
        const layerId = `expanded-layer-${clusterId}`;
        
        console.log(`Creating expanded layer for ${clusterId}...`);
        console.log('Properties to display:', properties.length);
        
        // Izračunaj center pozicijo
        const centerCoords = this.calculateClusterCenter(properties, originalClusterProperties);
        if (!centerCoords) {
            console.error('Could not determine cluster center position');
            return;
        }

        // Razporedi nepremičnine v krog(e) okoli cluster centra
        const modifiedProperties = this.arrangePropertiesInCircles(
            properties, 
            centerCoords
        );
        
        // Pripravi GeoJSON podatke
        const geojsonData = {
            type: 'FeatureCollection',
            features: modifiedProperties
        };
                
        // Odstrani obstoječe layers/sources
        this.removeExpandedLayer(clusterId);
        
        // Dodaj source in layer
        this.addExpandedSourceAndLayer(sourceId, layerId, geojsonData);
        
        // Dodaj event handlers
        this.setupExpandedLayerHandlers(layerId);
    }

    // Izračunaj center pozicijo clusterja
    calculateClusterCenter(properties, originalClusterProperties) {
        let centerLng = 0, centerLat = 0;
        
        // Poskusi dobiti center iz originalnih cluster properties
        if (originalClusterProperties && originalClusterProperties.geometry) {
            centerLng = originalClusterProperties.geometry.coordinates[0];
            centerLat = originalClusterProperties.geometry.coordinates[1];
            console.log(`Using cluster geometry center: [${centerLng}, ${centerLat}]`);
            return [centerLng, centerLat];
        }
        
        // Izračunaj povprečje iz vseh properties
        let validCoords = 0;
        properties.forEach(prop => {
            if (prop.geometry && prop.geometry.coordinates && 
                prop.geometry.coordinates[0] !== 0 && prop.geometry.coordinates[1] !== 0) {
                centerLng += prop.geometry.coordinates[0];
                centerLat += prop.geometry.coordinates[1];
                validCoords++;
            }
        });
        
        if (validCoords > 0) {
            centerLng /= validCoords;
            centerLat /= validCoords;
            console.log(`Calculated center from ${validCoords} valid coordinates: [${centerLng}, ${centerLat}]`);
            return [centerLng, centerLat];
        }
        
        return null;
    }

    // Izračunaj polmer za razporeditev properties
    calculateRadius() {
        const zoom = this.map.getZoom();
        const baseRadius = 0.005; 
        return baseRadius / Math.pow(2, Math.max(0, zoom - 13));
    }

    // NOVA METODA: Razporedi properties v enega ali dva kroga
    arrangePropertiesInCircles(properties, centerCoords) {
        const [centerLng, centerLat] = centerCoords;
        const totalProperties = properties.length;
        
        console.log(`Arranging ${totalProperties} properties in circle(s)`);
        
        if (totalProperties <= 10) {
            // Enojen krog za <= 15 nepremičnin
            console.log('Using single circle layout');
            return this.arrangeInSingleCircle(properties, centerCoords);
        } else {
            // Dvojen krog za > 15 nepremičnin
            console.log('Using dual circle layout');
            return this.arrangeInDualCircles(properties, centerCoords);
        }
    }

    // Razporedi properties v enojen krog
    arrangeInSingleCircle(properties, centerCoords) {
        const [centerLng, centerLat] = centerCoords;
        const radius = this.calculateRadius();
        
        return properties.map((prop, index) => {
            const angle = (2 * Math.PI * index) / properties.length;
            const offsetLng = centerLng + (radius * Math.cos(angle));
            const offsetLat = centerLat + (radius * Math.sin(angle));
            
            console.log(`Single circle - Property ${index}: angle=${angle.toFixed(2)}, coords=[${offsetLng.toFixed(6)}, ${offsetLat.toFixed(6)}]`);
            
            return {
                ...prop,
                geometry: {
                    ...prop.geometry,
                    coordinates: [offsetLng, offsetLat]
                }
            };
        });
    }

    // Razporedi properties v dva kroga
    arrangeInDualCircles(properties, centerCoords) {
        const [centerLng, centerLat] = centerCoords;
        const baseRadius = this.calculateRadius();
        
        // Večji polmeri za boljšo preglednost
        const innerRadius = baseRadius * 1.2;  // Notranji krog je 120% osnovnega polmera (večji)
        const outerRadius = baseRadius * 2.0;  // Zunanji krog je 200% osnovnega polmera (še večji)
        
        // Določimo koliko nepremičnin gre v vsak krog
        const totalProperties = properties.length;
        const innerCircleCount = Math.min(10, Math.floor(totalProperties * 0.35)); // Maksimalno 10 v notranjem krogu, običajno 35%
        const outerCircleCount = totalProperties - innerCircleCount;
        
        console.log(`Dual circles: ${innerCircleCount} inner, ${outerCircleCount} outer`);
        console.log(`Radii: inner=${innerRadius.toFixed(6)}, outer=${outerRadius.toFixed(6)}`);
        
        const modifiedProperties = [];
        
        // Razporedi nepremičnine v notranji krog
        for (let i = 0; i < innerCircleCount; i++) {
            const angle = (2 * Math.PI * i) / innerCircleCount;
            const offsetLng = centerLng + (innerRadius * Math.cos(angle));
            const offsetLat = centerLat + (innerRadius * Math.sin(angle));
            
            console.log(`Inner circle - Property ${i}: angle=${angle.toFixed(2)}, coords=[${offsetLng.toFixed(6)}, ${offsetLat.toFixed(6)}]`);
            
            modifiedProperties.push({
                ...properties[i],
                geometry: {
                    ...properties[i].geometry,
                    coordinates: [offsetLng, offsetLat]
                }
            });
        }
        
        // Razporedi preostale nepremičnine v zunanji krog
        for (let i = 0; i < outerCircleCount; i++) {
            const propertyIndex = innerCircleCount + i;
            const angle = (2 * Math.PI * i) / outerCircleCount;
            
            // Dodamo offset da se zunanji krog ne prekriva z notranjim
            const angleOffset = Math.PI / outerCircleCount; // Zamakni za pol koraka
            const adjustedAngle = angle + angleOffset;
            
            const offsetLng = centerLng + (outerRadius * Math.cos(adjustedAngle));
            const offsetLat = centerLat + (outerRadius * Math.sin(adjustedAngle));
            
            console.log(`Outer circle - Property ${propertyIndex}: angle=${adjustedAngle.toFixed(2)}, coords=[${offsetLng.toFixed(6)}, ${offsetLat.toFixed(6)}]`);
            
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

    // Dodaj source in layer na mapo
    addExpandedSourceAndLayer(sourceId, layerId, geojsonData) {
        try {
            // Dodaj source
            this.map.addSource(sourceId, {
                type: 'geojson',
                data: geojsonData
            });
            console.log(`Added source: ${sourceId}`);
            
            // Določi barve glede na data source
            const circleColor = this.currentDataSourceType === 'prodaja' ? '#3B82F6' : '#10B981';
            const strokeColor = this.currentDataSourceType === 'prodaja' ? '#1D4ED8' : '#059669';
            
            // Dodaj circle layer
            this.map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        9, 9,
                        13, 12,
                        17, 16
                    ],
                    'circle-color': circleColor,
                    'circle-opacity': 0.9,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': strokeColor
                }
            });
            
            console.log(`Added circle layer: ${layerId}`);
            
            // Dodaj text layer za cene
            const textLayerId = `${layerId}-text`;
            this.map.addLayer({
                id: textLayerId,
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-field': this.formatPriceExpression(),
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        9, 8,
                        13, 10,
                        17, 11
                    ],
                    'text-allow-overlap': false,
                    'text-ignore-placement': false,
                    'text-anchor': 'center',
                    'text-justify': 'center'
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': strokeColor,
                    'text-halo-width': 1
                }
            });
            
            console.log(`Added text layer: ${textLayerId}`);
            
        } catch (error) {
            console.error(`Error adding source/layer ${sourceId}/${layerId}:`, error);
            throw error;
        }
    }

    formatPriceExpression() {
        if (this.currentDataSourceType === 'prodaja') {
            // Za prodajo prikaži zadnja_cena (enako kot v IndividualPopup)
            return [
                'case',
                ['has', 'zadnja_cena'],
                [
                    'concat',
                    '€',
                    [
                        'number-format',
                        ['/', ['get', 'zadnja_cena'], 1000],
                        { 'max-fraction-digits': 0 }
                    ],
                    'k'
                ],
                'N/A'
            ];
        } else {
            // Za najem prikaži zadnja_najemnina (enako kot v IndividualPopup)
            return [
                'case',
                ['has', 'zadnja_najemnina'],
                [
                    'concat',
                    '€',
                    [
                        'number-format',
                        ['get', 'zadnja_najemnina'],
                        { 'max-fraction-digits': 0 }
                    ],
                    '/m'
                ],
                'N/A'
            ];
        }
    }// ClusterExpander.jsx

    // Nastavi event handlers za expanded layer
    setupExpandedLayerHandlers(layerId) {
        const textLayerId = `${layerId}-text`;
        
        // Click handler za circle layer
        const expandedClickHandler = (e) => {
            console.log('Expanded property clicked:', e.features[0]);
            const feature = e.features[0];
            if (feature.properties.type === 'individual') {
                // Trigger custom event namesto direktnega klica callback-a
                const clickEvent = new CustomEvent('expandedPropertyClick', {
                    detail: {
                        lngLat: e.lngLat,
                        properties: feature.properties
                    }
                });
                this.map.getContainer().dispatchEvent(clickEvent);
            }
        };
        
        // Click handler za text layer (isti kot za circle)
        const textClickHandler = (e) => {
            console.log('Expanded property text clicked:', e.features[0]);
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
        
        // Dodaj click handlers
        this.map.on('click', layerId, expandedClickHandler);
        this.map.on('click', textLayerId, textClickHandler);
        
        // Hover effects za circle layer
        this.map.on('mouseenter', layerId, () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        
        this.map.on('mouseleave', layerId, () => {
            this.map.getCanvas().style.cursor = '';
        });
        
        // Hover effects za text layer
        this.map.on('mouseenter', textLayerId, () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        
        this.map.on('mouseleave', textLayerId, () => {
            this.map.getCanvas().style.cursor = '';
        });
        
        // Shrani handler reference za cleanup
        this.map[`_${layerId}_clickHandler`] = expandedClickHandler;
        this.map[`_${textLayerId}_clickHandler`] = textClickHandler;
    }

    // Odstrani expanded layer
    removeExpandedLayer(clusterId) {
        const sourceId = `expanded-${clusterId}`;
        const layerId = `expanded-layer-${clusterId}`;
        const textLayerId = `${layerId}-text`;
        
        if (this.map.getSource(sourceId)) {
            console.log(`Removing existing source/layers ${sourceId}/${layerId}`);
            
            // Odstrani text layer
            if (this.map.getLayer(textLayerId)) {
                this.map.removeLayer(textLayerId);
            }
            
            // Odstrani circle layer
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
            
            // Odstrani source
            this.map.removeSource(sourceId);
        }
    }

    // Collapse posamezen cluster
    collapseCluster(clusterId) {
        const sourceId = `expanded-${clusterId}`;
        const layerId = `expanded-layer-${clusterId}`;
        const textLayerId = `${layerId}-text`;
        
        console.log(`Collapsing cluster ${clusterId}...`);
        
        // Odstrani event handlerje za circle layer
        if (this.map[`_${layerId}_clickHandler`]) {
            this.map.off('click', layerId, this.map[`_${layerId}_clickHandler`]);
            this.map.off('mouseenter', layerId);
            this.map.off('mouseleave', layerId);
            delete this.map[`_${layerId}_clickHandler`];
        }
        
        // Odstrani event handlerje za text layer
        if (this.map[`_${textLayerId}_clickHandler`]) {
            this.map.off('click', textLayerId, this.map[`_${textLayerId}_clickHandler`]);
            this.map.off('mouseenter', textLayerId);
            this.map.off('mouseleave', textLayerId);
            delete this.map[`_${textLayerId}_clickHandler`];
        }
        
        // Odstrani layers in source
        this.removeExpandedLayer(clusterId);
        
        // Označi cluster kot collapsed
        this.expandedClusters.delete(clusterId);
        
        console.log(`Collapsed cluster ${clusterId}`);
    }

    // Collapse vse expanded clustre
    collapseAllClusters() {
        console.log('Collapsing all expanded clusters...');
        const clustersToCollapse = Array.from(this.expandedClusters);
        clustersToCollapse.forEach(clusterId => {
            this.collapseCluster(clusterId);
        });
        console.log(`Collapsed ${clustersToCollapse.length} clusters`);
    }

    // Preverimo ali je cluster expandiran
    isClusterExpanded(clusterId) {
        return this.expandedClusters.has(clusterId);
    }

    // Cleanup funkcija
    cleanup() {
        // Collapse vse expanded clustre
        this.collapseAllClusters();
        console.log('ClusterExpander cleaned up');
    }
}

export default ClusterExpander;