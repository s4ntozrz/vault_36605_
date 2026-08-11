const Utils = {
    getDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    },
    getBearing: (lat1, lon1, lat2, lon2) => {
        const toRad = Math.PI / 180; const toDeg = 180 / Math.PI;
        const dLon = (lon2 - lon1) * toRad;
        const y = Math.sin(dLon) * Math.cos(lat2 * toRad);
        const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) - Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
        return ((Math.atan2(y, x) * toDeg) + 360) % 360;
    },
    calculatePathDistance: (path) => {
        let dist = 0; for(let i=0; i < path.length - 1; i++) dist += Utils.getDistance(path[i][0], path[i][1], path[i+1][0], path[i+1][1]);
        return dist;
    },
    formatCurrency: (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
    formatDuration: (ms) => {
        let totalMins = Math.floor(ms / 60000); if (totalMins < 60) return `${totalMins} min`;
        return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
    },
    formatTimeOnly: (timestamp) => new Date(timestamp).toLocaleTimeString('pt-BR'),

    getRoadPath: async (waypoints) => {
        try {
            const coordsStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
            const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
            const res = await fetch(url); const data = await res.json();
            if (data && data.routes && data.routes.length > 0) return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        } catch (error) { console.error(error); }
        return waypoints.map(w => [w.lat, w.lng]); 
    },
    getCoordsFromAddress: async (address) => {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
            const res = await fetch(url); const data = await res.json();
            if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch (e) { console.error(e); } return null;
    },
    generateId: (prefix) => prefix + Math.floor(Math.random() * 90000 + 10000),
    getRandomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    POIs: [
        { name: 'Porto de Suape', lat: -8.3965, lng: -34.9602 }, { name: 'Aeroporto Internacional', lat: -8.1264, lng: -34.9229 },
        { name: 'CD Mercado Livre', lat: -8.1402, lng: -34.9451 }, { name: 'Shopping Center Recife', lat: -8.1189, lng: -34.9045 },
        { name: 'Polo Industrial (Cabo)', lat: -8.2842, lng: -35.0163 }, { name: 'Centro Histórico', lat: -8.0631, lng: -34.8711 },
        { name: 'Ceasa (Abastecimento)', lat: -8.0716, lng: -34.9482 }, { name: 'Hospital das Clínicas', lat: -8.0494, lng: -34.9515 }
    ]
};