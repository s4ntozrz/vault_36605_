const Simulation = {
    animationFrameId: null, lastContractGenTime: 0,
    
    start() {
        if(State.data.simulation.running) return;
        State.data.simulation.running = true; State.data.simulation.lastRealTime = performance.now();
        State.save(); this.loop();
    },
    
    pause() {
        State.data.simulation.running = false; State.save();
        if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    },
    
    setSpeed(speed) { State.data.simulation.speed = speed; State.save(); },
    
    loop() {
        if (!State.data.simulation.running) return;
        const now = performance.now(); const deltaRealMs = now - State.data.simulation.lastRealTime;
        State.data.simulation.lastRealTime = now;
        const simDeltaMs = deltaRealMs * State.data.simulation.speed;
        State.data.simulation.currentTime += simDeltaMs;
        
        this.updateVehicles(simDeltaMs);
        this.marketManager(simDeltaMs); 
        this.weatherManager(simDeltaMs); 
        this.bankAndFinanceManager(simDeltaMs); // O Banco Operando
        
        MapService.updateMarkers();
        UI.updateVehicleDetails();
        if(UI.isFullscreen) UI.updateFullscreenOverlay(); 
        
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    weatherManager(simDeltaMs) {
        State.data.simulation.weatherTimer -= simDeltaMs;
        if (State.data.simulation.weatherTimer <= 0) {
            State.data.simulation.weatherTimer = Utils.getRandomInt(2, 4) * 60 * 60000;
            const roll = Math.random(); let newWeather = 'clear';
            if (roll < 0.20) newWeather = 'rain'; else if (roll < 0.30) newWeather = 'fog';

            if (State.data.simulation.weather !== newWeather) {
                State.data.simulation.weather = newWeather;
                if(newWeather === 'rain') UI.logEvent("🌧️ Chuva intensa. Velocidade reduzida e maior risco de acidentes.", "warning");
                else if(newWeather === 'fog') UI.logEvent("🌫️ Neblina densa na região. Cuidado redobrado nas estradas.", "warning");
                else UI.logEvent("☀️ O tempo abriu. Condições normais de tráfego.", "info");
                UI.updateWeatherUI(); State.save();
            }
        }
    },

    // BANCO E INTELIGÊNCIA FINANCEIRA DO DASHBOARD
    bankAndFinanceManager(simDeltaMs) {
        State.data.simulation.bankTimer -= simDeltaMs;
        if (State.data.simulation.bankTimer <= 0) {
            State.data.simulation.bankTimer = 24 * 60 * 60000; // Recarrega para mais 24h
            
            // Cobra juros de 1% do empréstimo do saldo de caixa!
            if (State.data.company.loan > 0) {
                const interest = State.data.company.loan * 0.01;
                State.data.company.cash -= interest;
                UI.logEvent(`🏦 Banco: Cobrança diária de juros de -${Utils.formatCurrency(interest)}`, 'danger');
            }

            // Grava ponto histórico para o Gráfico de Linha do Dashboard
            State.data.financeHistory.push({
                dayLabel: new Date(State.data.simulation.currentTime).toLocaleDateString('pt-BR'),
                balance: State.data.company.cash
            });
            if(State.data.financeHistory.length > 30) State.data.financeHistory.shift();

            UI.updateCashUI();
            State.save();
        }
    },
    
    marketManager(simDeltaMs) {
        this.lastContractGenTime += simDeltaMs;
        if (this.lastContractGenTime > 15 * 60000) { 
            this.lastContractGenTime = 0;
            if (State.data.contracts.length < 5) {
                let oIdx = Utils.getRandomInt(0, Utils.POIs.length - 1); let dIdx = Utils.getRandomInt(0, Utils.POIs.length - 1);
                while(dIdx === oIdx) dIdx = Utils.getRandomInt(0, Utils.POIs.length - 1);
                const orig = Utils.POIs[oIdx]; const dest = Utils.POIs[dIdx];
                const distEst = Utils.getDistance(orig.lat, orig.lng, dest.lat, dest.lng);
                const reward = Math.floor(50 + (distEst * 15)); 
                State.data.contracts.push({
                    id: Utils.generateId('C'), title: `Frete Urgente: ${orig.name.split(' ')[0]} ➔ ${dest.name.split(' ')[0]}`,
                    origName: orig.name, origCoords: {lat: orig.lat, lng: orig.lng}, destName: dest.name, destCoords: {lat: dest.lat, lng: dest.lng},
                    cargoDesc: `Lote de Suprimentos (${Utils.getRandomInt(2, 20)} ton)`, reward: reward
                });
                if(!document.getElementById('modal-contracts').classList.contains('hidden')) UI.openContractsModal();
            }
        }
    },

    updateVehicles(simDeltaMs) {
        const hours = simDeltaMs / (1000 * 60 * 60); let needUiUpdate = false;
        let weatherMod = 1.0;
        if (State.data.simulation.weather === 'rain') weatherMod = 0.85;
        if (State.data.simulation.weather === 'fog') weatherMod = 0.70;

        State.data.vehicles.forEach(v => {
            if (v.status !== 'em_rota' || !v.path) return;
            this.handleRandomEvents(v, simDeltaMs);
            
            let currentSpeed = v.velocidade * weatherMod;
            if (v.activeEvent) currentSpeed *= v.activeEvent.speedMultiplier;
            let distanceToMove = currentSpeed * hours;
            
            while (distanceToMove > 0 && v.currentPathIndex < v.path.length - 1) {
                const p2 = v.path[v.currentPathIndex + 1];
                const distToP2 = Utils.getDistance(v.posicao.lat, v.posicao.lng, p2[0], p2[1]);
                
                if (distToP2 === 0) { v.currentPathIndex++; continue; }
                v.bearing = Utils.getBearing(v.posicao.lat, v.posicao.lng, p2[0], p2[1]);

                if (distanceToMove >= distToP2) {
                    distanceToMove -= distToP2; v.currentPathIndex++; v.posicao.lat = p2[0]; v.posicao.lng = p2[1];
                    
                    if (v.currentPathIndex >= v.path.length - 1) {
                        v.status = 'concluído'; v.activeEvent = null; needUiUpdate = true;
                        this.processTripStatsAndFinances(v); 
                        break;
                    }
                } else {
                    const ratio = distanceToMove / distToP2; v.posicao.lat += (p2[0] - v.posicao.lat) * ratio; v.posicao.lng += (p2[1] - v.posicao.lng) * ratio; distanceToMove = 0; 
                }
            }
        });
        if (needUiUpdate) { UI.renderVehiclesList(); UI.updateCashUI(); State.save(); }
    },

    handleRandomEvents(v, simDeltaMs) {
        if (v.activeEvent) {
            v.activeEvent.timeLeft -= simDeltaMs;
            if (v.activeEvent.timeLeft <= 0) { UI.logEvent(`✅ Via liberada para placa ${v.placa}.`, 'info', v.id); v.activeEvent = null; UI.renderVehiclesList(); }
        } else {
            let riskMod = 1.0;
            if (State.data.simulation.weather === 'rain') riskMod = 2.0;
            if (State.data.simulation.weather === 'fog') riskMod = 3.0;

            const chance = Math.random(); const threshold = 0.000005 * simDeltaMs * riskMod;
            if (chance < threshold) {
                const roll = Math.random();
                if (roll < 0.6) { 
                    v.activeEvent = { type: 'semaforo', label: 'Semáforo', timeLeft: 60000, speedMultiplier: 0 }; 
                } else if (roll < 0.9) { 
                    v.activeEvent = { type: 'transito', label: 'Trânsito Intenso', timeLeft: 15 * 60000, speedMultiplier: 0.2 }; 
                    UI.logEvent(`🚧 Trânsito intenso parou o veículo ${v.placa}.`, 'warning', v.id);
                    State.data.heatmapData.push([v.posicao.lat, v.posicao.lng, 0.5]); // Adiciona Risco Médio no Mapa Térmico
                } else { 
                    v.activeEvent = { type: 'acidente', label: 'Acidente na Via', timeLeft: 30 * 60000, speedMultiplier: 0 }; 
                    UI.logEvent(`💥 Acidente paralisou via do caminhão ${v.placa}!`, 'danger', v.id);
                    State.data.heatmapData.push([v.posicao.lat, v.posicao.lng, 1.0]); // Adiciona Risco Alto no Mapa Térmico
                }
                
                // Evita estourar a memória com milhares de pontos de calor (Cap 300)
                if(State.data.heatmapData.length > 300) State.data.heatmapData.shift();
                MapService.updateHeatmap();
                UI.renderVehiclesList(); 
            }
        }
    },

    processTripStatsAndFinances(v) {
        const timeSpent = State.data.simulation.currentTime - v.startTime;
        const revenue = v.expectedReward || 0;
        const driverCost = 150; 
        const vehicleCost = v.distanceKm * v.costPerKm; 
        const totalProfit = revenue - driverCost - vehicleCost;

        const driver = State.data.drivers.find(d => d.id === v.driverId);
        if(driver) { driver.tripsCount++; driver.totalKm += v.distanceKm; driver.totalTimeMs += timeSpent; driver.totalProfit = (driver.totalProfit || 0) + totalProfit; }
        
        const fleetCar = State.data.fleet.find(f => f.id === v.fleetId);
        if(fleetCar) { fleetCar.tripsCount++; fleetCar.totalKm += v.distanceKm; fleetCar.totalTimeMs += timeSpent; fleetCar.totalProfit = (fleetCar.totalProfit || 0) + totalProfit; }

        State.data.company.cash += totalProfit;
        UI.logEvent(`🏁 Viagem concluída! Lucro Líquido: ${Utils.formatCurrency(totalProfit)}`, totalProfit >= 0 ? 'info' : 'danger', v.id);
    }
};
