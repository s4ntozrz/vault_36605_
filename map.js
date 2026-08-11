const MapService = {
    map: null, currentTileLayer: null, markers: {}, eventMarkers: {}, polylines: [],
    tempMarkers: { origin: null, dest: null }, pickingMode: null, pickCallback: null, isTracking: false,
    companyMarkers: [], 
    heatLayer: null, isHeatmapActive: false, // Nova Camada de Risco
    
    init() {
        this.map = L.map('map', { zoomControl: false }).setView([-8.06, -34.89], 13);
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
        this.applyTheme();
        
        // Inicializa o Mapa de Calor (Invisível no início)
        this.heatLayer = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 15, gradient: {0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red'} });

        this.map.on('click', (e) => {
            if (this.pickingMode) {
                this.setTempMarker(this.pickingMode, e.latlng);
                if (this.pickCallback) this.pickCallback(e.latlng);
                this.pickingMode = null;
            }
        });
        this.map.on('dragstart', () => { this.isTracking = false; });
        this.drawAllRoutes();
        this.drawCompanyInfrastructure();
    },

    toggleHeatmap() {
        this.isHeatmapActive = !this.isHeatmapActive;
        if(this.isHeatmapActive) {
            this.heatLayer.setLatLngs(State.data.heatmapData);
            this.heatLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.heatLayer);
        }
    },

    updateHeatmap() {
        if(this.isHeatmapActive) this.heatLayer.setLatLngs(State.data.heatmapData);
    },

    applyTheme() {
        if(this.currentTileLayer) this.map.removeLayer(this.currentTileLayer);
        const url = State.data.simulation.darkTheme ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        this.currentTileLayer = L.tileLayer(url, { maxZoom: 19, attribution: '© CartoDB / OSM' }).addTo(this.map);
    },
    toggleTheme() { State.data.simulation.darkTheme = !State.data.simulation.darkTheme; State.save(); this.applyTheme(); },

    enablePicking(type, callback) { this.pickingMode = type; this.pickCallback = callback; },
    setTempMarker(type, latlng) {
        if (this.tempMarkers[type]) this.map.removeLayer(this.tempMarkers[type]);
        const emoji = type === 'hq' ? '🏢' : (type === 'branch' ? '🏪' : (type === 'origin' ? '📍' : '🏁'));
        const iconHtml = `<div style="font-size: 24px; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.5));">${emoji}</div>`;
        this.tempMarkers[type] = L.marker(latlng, { icon: L.divIcon({ html: iconHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 24] }) }).addTo(this.map);
        this.map.setView(latlng, 14); 
    },
    clearTempMarkers() { ['origin', 'dest', 'hq', 'branch'].forEach(t => { if(this.tempMarkers[t]) { this.map.removeLayer(this.tempMarkers[t]); this.tempMarkers[t] = null; } }); },
    
    drawCompanyInfrastructure() {
        this.companyMarkers.forEach(m => this.map.removeLayer(m)); this.companyMarkers = [];
        if (State.data.company.hq) {
            const hqIcon = L.divIcon({ html: `<div style="font-size: 32px; filter: drop-shadow(0px 2px 5px rgba(76,175,80,0.8));">🏢</div>`, className: '', iconSize: [32, 32], iconAnchor: [16, 32] });
            this.companyMarkers.push(L.marker([State.data.company.hq.lat, State.data.company.hq.lng], {icon: hqIcon}).addTo(this.map).bindPopup("Matriz da Empresa"));
        }
        State.data.company.branches.forEach((b, i) => {
            const bIcon = L.divIcon({ html: `<div style="font-size: 24px; filter: drop-shadow(0px 2px 2px rgba(255,255,255,0.5));">🏪</div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24] });
            this.companyMarkers.push(L.marker([b.lat, b.lng], {icon: bIcon}).addTo(this.map).bindPopup(`Filial ${i+1}`));
        });
    },

    drawAllRoutes() {
        this.polylines.forEach(p => this.map.removeLayer(p)); this.polylines = [];
        State.data.vehicles.forEach(v => {
            if (v.path && v.path.length > 0) { const poly = L.polyline(v.path, {color: '#4caf50', weight: 3, opacity: 0.6}).addTo(this.map); this.polylines.push(poly); }
        });
    },
    
    updateMarkers() {
        const activeIds = State.data.vehicles.map(v => v.id);
        for (let id in this.markers) {
            if (!activeIds.includes(id)) {
                this.map.removeLayer(this.markers[id]); delete this.markers[id];
                if (this.eventMarkers[id]) { this.map.removeLayer(this.eventMarkers[id]); delete this.eventMarkers[id]; }
            }
        }
        State.data.vehicles.forEach(v => {
            const isEventActive = v.activeEvent && v.activeEvent.timeLeft > 0;
            const cabColor = isEventActive ? (v.activeEvent.type === 'acidente' ? '#f44336' : '#ffeb3b') : '#ffb300';
            
            const rotation = v.bearing || 0;
            const svgIcon = `<div style="transform: rotate(${rotation}deg); transform-origin: center; width: 24px; height: 24px; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.5)); transition: transform 0.2s linear;"><svg width="24" height="24" viewBox="0 0 24 24"><rect x="6" y="1" width="12" height="7" fill="${cabColor}" rx="2" /><rect x="5" y="7" width="14" height="16" fill="#ffffff" rx="1" stroke="#333" stroke-width="1" /></svg></div>`;
            const truckIcon = L.divIcon({ html: svgIcon, className: 'truck-icon', iconSize: [24, 24], iconAnchor: [12, 12] });

            if (!this.markers[v.id]) {
                const marker = L.marker([v.posicao.lat, v.posicao.lng], {icon: truckIcon}).addTo(this.map);
                marker.on('click', () => { State.data.selectedVehicle = v.id; MapService.centerOnVehicle(v.id); UI.renderVehiclesList(); UI.showVehicleDetails(); UI.updateFullscreenOverlay(); });
                this.markers[v.id] = marker;
            } else { this.markers[v.id].setLatLng([v.posicao.lat, v.posicao.lng]); this.markers[v.id].setIcon(truckIcon); }

            if (isEventActive) {
                let emoji = v.activeEvent.type === 'semaforo' ? '🚦' : (v.activeEvent.type === 'transito' ? '🚧' : '💥');
                const eventIcon = L.divIcon({ html: `<div style="font-size: 20px; animation: blink 1s infinite;">${emoji}</div>`, className: '', iconSize: [20, 20], iconAnchor: [10, 40] });
                if(!this.eventMarkers[v.id]) this.eventMarkers[v.id] = L.marker([v.posicao.lat, v.posicao.lng], {icon: eventIcon}).addTo(this.map);
                else { this.eventMarkers[v.id].setLatLng([v.posicao.lat, v.posicao.lng]); this.eventMarkers[v.id].setIcon(eventIcon); }
            } else if (this.eventMarkers[v.id]) { this.map.removeLayer(this.eventMarkers[v.id]); delete this.eventMarkers[v.id]; }

            if (this.isTracking && State.data.selectedVehicle === v.id) this.map.setView([v.posicao.lat, v.posicao.lng], this.map.getZoom(), { animate: false });
        });
    },
    centerOnVehicle(id) { const v = State.data.vehicles.find(v => v.id === id); if(v) { this.isTracking = true; this.map.setView([v.posicao.lat, v.posicao.lng]); } },
    invalidate() { if(this.map) setTimeout(() => this.map.invalidateSize(), 200); }
};