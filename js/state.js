const State = {
    data: {
        simulation: { 
            running: false, speed: 1, 
            currentTime: new Date('2026-08-10T08:00:00').getTime(), 
            lastRealTime: null, darkTheme: true,
            weather: 'clear', weatherTimer: 60 * 60000,
            bankTimer: 24 * 60 * 60000 // Timer de 24h para cobrar os Juros do Banco!
        },
        company: { cash: 150000, loan: 0, hq: null, branches: [] },
        
        financeHistory: [], // Alimenta o Gráfico de Linha: { dayLabel: 'Dia X', balance: 150000 }
        heatmapData: [],    // Alimenta o Mapa de Calor: [[lat, lng, intensidade]]

        contracts: [], vehicles: [], archivedVehicles: [], selectedVehicle: null,
        drivers: [], fleet: [], eventLog: []
    },

    vehicleModels: {
        'motocicleta': { name: 'Motocicleta Cargo', vel: 65, cap: '20 kg', price: 15000, costPerKm: 0.8 },
        'fiorino': { name: 'Fiat Fiorino (VUC)', vel: 60, cap: '600 kg', price: 65000, costPerKm: 1.5 },
        'sprinter': { name: 'MB Sprinter (Van)', vel: 55, cap: '1.500 kg', price: 120000, costPerKm: 2.2 },
        'accelo': { name: 'MB Accelo (3/4)', vel: 45, cap: '3.500 kg', price: 210000, costPerKm: 3.5 },
        'atego': { name: 'MB Atego (Toco)', vel: 40, cap: '6.000 kg', price: 340000, costPerKm: 5.0 }
    },

    init: () => {
        const saved = localStorage.getItem('ccl_tycoon_v3');
        if (saved) {
            State.data = Object.assign(State.data, JSON.parse(saved));
            State.data.simulation.running = false; 
            State.data.selectedVehicle = null;
        } else {
            State.data.drivers.push({ id: 'D1', name: 'João Silva', age: 35, gender: 'M', tripsCount: 0, totalKm: 0, totalTimeMs: 0, totalProfit: 0 });
            // Cria o primeiro ponto histórico do Gráfico
            State.data.financeHistory.push({ dayLabel: new Date(State.data.simulation.currentTime).toLocaleDateString('pt-BR'), balance: 150000 });
        }
    },
    save: () => { localStorage.setItem('ccl_tycoon_v3', JSON.stringify(State.data)); },
    reset: () => { localStorage.removeItem('ccl_tycoon_v3'); location.reload(); }
};
