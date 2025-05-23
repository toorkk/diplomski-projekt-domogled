import maplibregl from "maplibre-gl";
import IndividualPopup from "./IndividualPopup";
import ClusterPopup from "./ClusterPopup";

// Razred za upravljanje popupov
class PopupManager {
    constructor(map) {
        this.map = map;
        this.currentPopup = null;
        this.currentDataSourceType = 'prodaja'; // default
    }

    // Dodajte metodo za posodobitev data source type
    updateDataSourceType(newType) {
        this.currentDataSourceType = newType;
    }

    // Setup dogodkov za klike na različne sloje
    setupEventHandlers(onPropertySelect) {
        // Počistimo stare handlere
        if (this.map._propertiesClickHandler) {
            this.map.off('click', 'properties-layer', this.map._propertiesClickHandler);
            this.map.off('click', 'clusters-layer', this.map._clustersClickHandler);
        }

        // Definiramo handler za individualne nepremičnine
        this.map._propertiesClickHandler = (e) => {
            const features = e.features[0];
            const properties = features.properties;

            if (properties.type === 'individual') {
                this.showPropertyPopup(e.lngLat, properties, onPropertySelect);
            }
        };

        // Definiramo handler za clustre
        this.map._clustersClickHandler = (e) => {
            const features = e.features[0];
            const properties = features.properties;

            if (properties.type === 'cluster') {
                this.showClusterPopup(e.lngLat, properties);
            }
        };

        // Dodamo click handlere za oba sloja
        this.map.on('click', 'properties-layer', this.map._propertiesClickHandler);
        this.map.on('click', 'clusters-layer', this.map._clustersClickHandler);

        // Dodamo hover efekte
        this.setupHoverHandlers();
    }

    // Prikaz popupa za posamezno nepremičnino
    showPropertyPopup(lngLat, properties, onPropertySelect) {
        const popupContent = IndividualPopup({ 
            properties, 
            dataSourceType: this.currentDataSourceType // posredujemo dataSourceType
        });

        // Zapremo prejšnji popup, če obstaja
        if (this.currentPopup) {
            this.currentPopup.remove();
        }

        // Ustvarimo nov popup
        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '320px',
            className: 'custom-popup'
        })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);

        // Počakamo, da se DOM naloži
        setTimeout(() => {
            const detailsButton = document.getElementById(`btnShowDetails_${properties.id}`);
            if (detailsButton) {
                detailsButton.addEventListener('click', () => {
                    // Klic callback funkcije za prikaz podrobnosti
                    onPropertySelect(properties);
                    
                    // Zapremo popup
                    if (this.currentPopup) {
                        this.currentPopup.remove();
                        this.currentPopup = null;
                    }
                });
            }
        }, 100);
    }

    // Prikaz popupa za cluster
    showClusterPopup(lngLat, properties) {
        const popupContent = ClusterPopup({ properties });

        // Zapremo prejšnji popup, če obstaja
        if (this.currentPopup) {
            this.currentPopup.remove();
        }

        // Ustvarimo nov popup
        this.currentPopup = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '320px',
            className: 'custom-popup'
        })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(this.map);
        
        // Počakamo, da se DOM naloži, podobno kot pri showPropertyPopup
        setTimeout(() => {
            // Tukaj lahko dodamo event listenerje za gumbe v cluster popupu,
            // če jih potrebujemo, npr. za zoom na cluster
            const zoomButton = document.getElementById(`btnZoomCluster_${properties.cluster_id}`);
            if (zoomButton) {
                zoomButton.addEventListener('click', () => {
                    // Zoom na cluster
                    this.map.flyTo({
                        center: lngLat,
                        zoom: this.map.getZoom() + 2
                    });
                    
                    // Zapremo popup
                    if (this.currentPopup) {
                        this.currentPopup.remove();
                        this.currentPopup = null;
                    }
                });
            }
        }, 100);
    }

    // Hover efekti za sloje
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

    // Počistimo vse handlere
    cleanup() {
        if (this.map) {
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