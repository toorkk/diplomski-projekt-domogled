import maplibregl from "maplibre-gl";
import IndividualPopup from "./IndividualPopup";
import ClusterPopup from "./ClusterPopup";

// Razred za upravljanje popupov
class PopupManager {
    constructor(map) {
        this.map = map;
        this.currentPopup = null;
        this.currentDataSourceType = 'prodaja';
        this.expandedClusters = new Set(); // Track kateri clustri so expandirani
        this.onPropertySelectCallback = null; // Shrani callback za poznejšo uporabo
    }

    updateDataSourceType(newType) {
        // Zapri vse expanded clustre ko se spremeni data source
        this.collapseAllClusters();
        this.currentDataSourceType = newType;
        console.log(`Data source changed to: ${newType}, collapsed all clusters`);
    }

    setupEventHandlers(onPropertySelect) {
        // Shrani callback
        this.onPropertySelectCallback = onPropertySelect;

        // Počistimo stare handlere
        if (this.map._propertiesClickHandler) {
            this.map.off('click', 'properties-layer', this.map._propertiesClickHandler);
            this.map.off('click', 'clusters-layer', this.map._clustersClickHandler);
        }

        // Handler za individualne nepremičnine
        this.map._propertiesClickHandler = (e) => {
            const features = e.features[0];
            const properties = features.properties;

            if (properties.type === 'individual') {
                this.showPropertyPopup(e.lngLat, properties, onPropertySelect);
            }
        };

        // POSODOBLJEN handler za clustre - zdaj z expansion funkcionalnostjo
        this.map._clustersClickHandler = (e) => {
            const features = e.features[0];
            const properties = features.properties;

            if (properties.type === 'cluster') {
                this.handleClusterClick(e.lngLat, properties);
            }
        };

        // Dodamo click handlere za oba sloja
        this.map.on('click', 'properties-layer', this.map._propertiesClickHandler);
        this.map.on('click', 'clusters-layer', this.map._clustersClickHandler);

        this.setupHoverHandlers();
    }

    // NOVA funkcija: Handle cluster click z možnostjo expansion
    async handleClusterClick(lngLat, clusterProperties) {
        const clusterId = clusterProperties.cluster_id;
        
        // Če je cluster že expandiran, ga collapse
        if (this.expandedClusters.has(clusterId)) {
            this.collapseCluster(clusterId);
            return;
        }

        // NOVO: Zapri vse druge expanded clustre
        this.collapseAllClusters();

        // Če ni building cluster, prikaži normalni popup
        if (!clusterId.startsWith('b_')) {
            this.showClusterPopup(lngLat, clusterProperties);
            return;
        }

        // Poskusi expandirati building cluster
        await this.expandCluster(clusterId, clusterProperties);
    }

    // NOVA funkcija: Zapri vse expanded clustre
    collapseAllClusters() {
        console.log('Collapsing all expanded clusters...');
        const clustersToCollapse = Array.from(this.expandedClusters);
        clustersToCollapse.forEach(clusterId => {
            this.collapseCluster(clusterId);
        });
        console.log(`Collapsed ${clustersToCollapse.length} clusters`);
    }

    // NOVA funkcija: Expandiraj cluster
    async expandCluster(clusterId, clusterProperties) {
        const dataSource = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
        
        console.log(`=== EXPANDING CLUSTER ${clusterId} ===`);
        console.log('Data source:', dataSource);
        console.log('Cluster properties:', clusterProperties);
        
        try {
            const url = `http://localhost:8000/cluster/${clusterId}/properties?data_source=${dataSource}`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                console.error('Error fetching cluster properties:', response.status);
                const errorText = await response.text();
                console.error('Error details:', errorText);
                // Fallback na normalni cluster popup
                this.showClusterPopup(null, clusterProperties);
                return;
            }
            
            const data = await response.json();
            console.log('API Response data:', data);
            console.log('Features received:', data.features?.length || 0);
            
            if (data.features && data.features.length > 0) {
                console.log('Sample feature:', data.features[0]);
                
                // Preveri geometrijo
                data.features.forEach((feature, index) => {
                    console.log(`Feature ${index}: geometry =`, feature.geometry);
                    console.log(`Feature ${index}: coordinates =`, feature.geometry?.coordinates);
                });
                
                this.createExpandedLayer(clusterId, data.features);
                this.expandedClusters.add(clusterId);
                console.log(`✓ Successfully expanded cluster ${clusterId} with ${data.features.length} properties`);
            } else {
                console.log('❌ No valid properties found in cluster response');
                this.showClusterPopup(null, clusterProperties);
            }
            
        } catch (error) {
            console.error('❌ Error expanding cluster:', error);
            this.showClusterPopup(null, clusterProperties);
        }
        
        console.log('=== END CLUSTER EXPANSION ===');
    }

    // NOVA funkcija: Ustvari vizualni layer za expanded properties
    createExpandedLayer(clusterId, properties) {
        const sourceId = `expanded-${clusterId}`;
        const layerId = `expanded-layer-${clusterId}`;
        
        console.log(`Creating expanded layer for ${clusterId}...`);
        console.log('Properties to display:', properties.length);
        
        // Izračunaj center pozicijo (povprečje koordinat)
        let centerLng = 0, centerLat = 0;
        properties.forEach(prop => {
            if (prop.geometry && prop.geometry.coordinates) {
                centerLng += prop.geometry.coordinates[0];
                centerLat += prop.geometry.coordinates[1];
            }
        });
        centerLng /= properties.length;
        centerLat /= properties.length;
        
        console.log(`Center position: [${centerLng}, ${centerLat}]`);
        
        // Izračunaj polmer glede na zoom level
        const zoom = this.map.getZoom();
        const baseRadius = 0.001; // Povečan polmer (prej 0.0001)
        const radius = baseRadius / Math.pow(2, Math.max(0, zoom - 15));
        
        console.log(`Calculated radius: ${radius} (zoom: ${zoom})`);
        
        // Razporedi nepremičnine v krog okoli centra
        const modifiedProperties = properties.map((prop, index) => {
            const angle = (2 * Math.PI * index) / properties.length;
            const offsetLng = centerLng + (radius * Math.cos(angle));
            const offsetLat = centerLat + (radius * Math.sin(angle));
            
            console.log(`Property ${index}: angle=${angle.toFixed(2)}, new coords=[${offsetLng.toFixed(6)}, ${offsetLat.toFixed(6)}]`);
            
            return {
                ...prop,
                geometry: {
                    ...prop.geometry,
                    coordinates: [offsetLng, offsetLat]
                }
            };
        });
        
        // Pripravi GeoJSON podatke z novimi koordinatami
        const geojsonData = {
            type: 'FeatureCollection',
            features: modifiedProperties
        };
        
        // Preverimo če layer/source že obstaja
        if (this.map.getSource(sourceId)) {
            console.log(`Source ${sourceId} already exists, removing...`);
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
            this.map.removeSource(sourceId);
        }
        
        // Dodaj source
        try {
            this.map.addSource(sourceId, {
                type: 'geojson',
                data: geojsonData
            });
            console.log(`Added source: ${sourceId}`);
        } catch (error) {
            console.error(`Error adding source ${sourceId}:`, error);
            return;
        }
        
        // Določi barve glede na data source
        const circleColor = this.currentDataSourceType === 'prodaja' ? '#3B82F6' : '#10B981';
        const strokeColor = this.currentDataSourceType === 'prodaja' ? '#1D4ED8' : '#059669';
        
        console.log(`Using colors: circle=${circleColor}, stroke=${strokeColor}`);
        
        // Dodaj layer za expanded properties
        try {
            this.map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        8, 6,
                        12, 10,
                        16, 15
                    ],
                    'circle-color': circleColor,
                    'circle-opacity': 0.85,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': strokeColor
                }
            });
            console.log(`Added layer: ${layerId}`);
            
            // Preverimo ali je layer res dodan
            const addedLayer = this.map.getLayer(layerId);
            console.log('Layer added successfully:', !!addedLayer);
            
        } catch (error) {
            console.error(`Error adding layer ${layerId}:`, error);
            return;
        }
        
        // Dodaj click handler za expanded properties
        const expandedClickHandler = (e) => {
            console.log('Expanded property clicked:', e.features[0]);
            const feature = e.features[0];
            if (feature.properties.type === 'individual') {
                this.showPropertyPopup(e.lngLat, feature.properties, this.onPropertySelectCallback);
            }
        };
        
        this.map.on('click', layerId, expandedClickHandler);
        
        // Hover effects za expanded layer
        this.map.on('mouseenter', layerId, () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        
        this.map.on('mouseleave', layerId, () => {
            this.map.getCanvas().style.cursor = '';
        });
        
        // Shrani handler reference za cleanup
        this.map[`_${layerId}_clickHandler`] = expandedClickHandler;
        
        console.log(`✓ Successfully created expanded layer ${layerId} with ${properties.length} properties arranged in circle`);
    }

    // NOVA funkcija: Collapse cluster
    collapseCluster(clusterId) {
        const sourceId = `expanded-${clusterId}`;
        const layerId = `expanded-layer-${clusterId}`;
        
        console.log(`Collapsing cluster ${clusterId}...`);
        
        // Odstrani event handlerje
        if (this.map[`_${layerId}_clickHandler`]) {
            this.map.off('click', layerId, this.map[`_${layerId}_clickHandler`]);
            this.map.off('mouseenter', layerId);
            this.map.off('mouseleave', layerId);
            delete this.map[`_${layerId}_clickHandler`];
        }
        
        // Odstrani layer in source
        if (this.map.getLayer(layerId)) {
            this.map.removeLayer(layerId);
        }
        if (this.map.getSource(sourceId)) {
            this.map.removeSource(sourceId);
        }
        
        // Označi cluster kot collapsed
        this.expandedClusters.delete(clusterId);
        
        console.log(`Collapsed cluster ${clusterId}`);
    }

    // Prikaz popupa za posamezno nepremičnino (ostane enako)
    showPropertyPopup(lngLat, properties, onPropertySelect) {
        const popupContent = IndividualPopup({ 
            properties, 
            dataSourceType: this.currentDataSourceType
        });

        if (this.currentPopup) {
            this.currentPopup.remove();
        }

        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '320px',
            className: 'custom-popup'
        })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);

        setTimeout(() => {
            const detailsButton = document.getElementById(`btnShowDetails_${properties.id}`);
            if (detailsButton) {
                detailsButton.addEventListener('click', () => {
                    onPropertySelect(properties);
                    
                    if (this.currentPopup) {
                        this.currentPopup.remove();
                        this.currentPopup = null;
                    }
                });
            }
        }, 100);
    }

    // Fallback cluster popup + debug (ostane enako)
    showClusterPopup(lngLat, properties) {
        const popupContent = ClusterPopup({ properties });

        if (this.currentPopup) {
            this.currentPopup.remove();
        }

        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '320px',
            className: 'custom-popup'
        })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);

        // Ohrani debug funkcionalnost
        this.debugClusterProperties(properties);
        
        setTimeout(() => {
            const zoomButton = document.getElementById(`btnZoomCluster_${properties.cluster_id}`);
            if (zoomButton) {
                zoomButton.addEventListener('click', () => {
                    this.map.flyTo({
                        center: lngLat,
                        zoom: this.map.getZoom() + 2
                    });
                    
                    if (this.currentPopup) {
                        this.currentPopup.remove();
                        this.currentPopup = null;
                    }
                });
            }
        }, 100);
    }

    // Debug funkcija (ostane enaka)
    async debugClusterProperties(clusterProperties) {
        const clusterId = clusterProperties.cluster_id;
        const dataSource = this.currentDataSourceType === 'prodaja' ? 'kpp' : 'np';
        
        console.log('=== CLUSTER DEBUG ===');
        console.log('Cluster ID:', clusterId);
        console.log('Cluster type:', clusterProperties.cluster_type);
        console.log('Point count:', clusterProperties.point_count);
        console.log('Data source:', dataSource);
        
        if (!clusterId.startsWith('b_')) {
            console.log('Distance cluster - ni podrobnih podatkov');
            return;
        }
        
        try {
            const url = `http://localhost:8000/cluster/${clusterId}/properties?data_source=${dataSource}`;
            console.log('Fetching cluster details from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.log('Error response:', response.status);
                return;
            }
            
            const data = await response.json();
            console.log('=== CLUSTER PROPERTIES ===');
            console.log(`Found ${data.features.length} properties in building:`);
            
            data.features.forEach((feature, index) => {
                const props = feature.properties;
                const address = `${props.ulica || ''} ${props.hisna_stevilka || ''}`.trim() || 'Brez naslova';
                const cena = dataSource === 'kpp' 
                    ? (props.cena || props.pogodbena_cena) 
                    : props.najemnina;
                
                console.log(`${index + 1}. ${address}`);
                console.log(`   - ID: ${props.id}`);
                console.log(`   - Površina: ${props.povrsina || 'N/A'} m²`);
                console.log(`   - ${dataSource === 'kpp' ? 'Cena' : 'Najemnina'}: ${cena ? Math.round(cena).toLocaleString('sl-SI') + ' €' : 'N/A'}`);
                console.log(`   - Koordinate: [${feature.geometry.coordinates[0].toFixed(6)}, ${feature.geometry.coordinates[1].toFixed(6)}]`);
                console.log('   ---');
            });
            
            console.log('=== END CLUSTER DEBUG ===');
            
        } catch (error) {
            console.error('Error fetching cluster properties:', error);
        }
    }

    // Hover efekti (ostanejo enaki)
    setupHoverHandlers() {
        if (!this.map._propertiesHoverHandler) {
            this.map._propertiesHoverHandler = () => {
                this.map.getCanvas().style.cursor = 'pointer';
            };

            this.map._propertiesLeaveHandler = () => {
                this.map.getCanvas().style.cursor = '';
            };

            this.map.on('mouseenter', 'properties-layer', this.map._propertiesHoverHandler);
            this.map.on('mouseleave', 'properties-layer', this.map._propertiesLeaveHandler);
            
            this.map.on('mouseenter', 'clusters-layer', this.map._propertiesHoverHandler);
            this.map.on('mouseleave', 'clusters-layer', this.map._propertiesLeaveHandler);
        }
    }

    // POSODOBLJEN cleanup z expanded clustri
    cleanup() {
        if (this.map) {
            // Collapse vse expanded clustre
            Array.from(this.expandedClusters).forEach(clusterId => {
                this.collapseCluster(clusterId);
            });
            
            // Cleanup osnovni handlerji
            if (this.map._propertiesClickHandler) {
                this.map.off('click', 'properties-layer', this.map._propertiesClickHandler);
            }
            
            if (this.map._clustersClickHandler) {
                this.map.off('click', 'clusters-layer', this.map._clustersClickHandler);
            }
            
            if (this.map._propertiesHoverHandler) {
                this.map.off('mouseenter', 'properties-layer', this.map._propertiesHoverHandler);
                this.map.off('mouseleave', 'properties-layer', this.map._propertiesLeaveHandler);
                this.map.off('mouseenter', 'clusters-layer', this.map._propertiesHoverHandler);
                this.map.off('mouseleave', 'clusters-layer', this.map._propertiesLeaveHandler);
            }
            
            if (this.currentPopup) {
                this.currentPopup.remove();
                this.currentPopup = null;
            }
        }
    }
}

export default PopupManager;