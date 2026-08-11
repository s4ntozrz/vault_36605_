const Simulation = {
    animationFrameId: null, lastContractGenTime: 0,
    realWeatherTimer: 0, // Controla o tempo real para checar a API
    
    start() {
        if(State.data.simulation.running) return;
        State.data.simulation.running = true; 
        State.data.simulation.lastRealTime = performance.now();
        State.save(); this.loop();
    },
    
    pause() {
        State.data.simulation.running = false; State.save();
        if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    },
    
    setSpeed(speed) { State.data.simulation.speed = speed; State.save(); },
    
    loop() {
        if (!State.data.simulation.running) return;
        
        const now = performance.now(); 
        
        // 🔴 CORREÇÃO DO BUG CRÍTICO DO VEÍCULO ENGANCHAR:
        // Quando o usuário muda de aba, o tempo(now) salta absurdamente.
        // O "Math.min" trava esse salto num máximo de 100ms, impedindo o jogo de explodir a física!
        const deltaRealMs = Math.min(now - State.data.simulation.lastRealTime, 100);
        
        State.data.simulation.lastRealTime = now;
        const simDeltaMs = deltaRealMs * State.data.simulation.speed;
        State.data.simulation.currentTime += simDeltaMs;
        
        this.updateVehicles(simDeltaMs);
        this.marketManager(simDeltaMs); 
        this.bankAndFinanceManager(simDeltaMs); 
        
        // Timer de Clima Baseado no tempo REAL, não na velocidade da simulação
        this.realWeatherTimer -= deltaRealMs;
        if (this.realWeatherTimer <= 0) {
            this.realWeatherTimer = 5 * 60 * 1000; // Consulta a API a cada 5 minutos reais
            this.updateRealWorldWeather();
        }
        
        MapService.updateMarkers();
        UI.updateVehicleDetails();
        if(UI.isFullscreen) UI.updateFullscreenOverlay(); 
        
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    // 📡 MOTOR CLIMÁTICO REAL
    async updateRealWorldWeather() {
        // Pega a coordenada da base, ou do primeiro caminhão, ou usa Recife como fallback
        let refLat = -8.06, refLng = -34.89; 
        if (State.data.company.hq) { refLat = State.data.company.hq.lat; refLng = State.data.company.hq.lng; }
        else if (State.data.vehicles.length > 0) { refLat = State.data.vehicles[0].posicao.lat; refLng = State.data.vehicles[0].posicao.lng; }

        const newWeather = await Utils.getRealWeather(refLat, refLng);

        if (State.data.simulation.weather !== newWeather) {
            State.data.simulation.weather = newWeather;
            if(newWeather === 'rain') UI.logEvent("🌧️ Satélite: Detectada chuva forte operando na área da frota.", "warning");
            else if(newWeather === 'fog') UI.logEvent("🌫️ Satélite: Neblina densa detectada nas rotas. Velocidade reduzida.", "warning");
            else UI.logEvent("☀️ Satélite: Tempo limpo e visibilidade perfeita.", "info");
            
            UI.updateWeatherUI(); 
            State.save();
        }
    },

    bankAndFinanceManager(simDeltaMs) {
        State.data.simulation.bankTimer -= simDeltaMs;
        if (State.data.simulation.bankTimer <= 0) {
            State.data.simulation.bankTimer = 24 * 60 * 60000; 
            
            if (State.data.company.loan > 0) {
                const interest = State.data.company.loan * 0.01;
                State.data.company.cash -= interest;
                UI.logEvent(`🏦 Banco: Cobrança diária de juros de -${Utils.formatCurrency(interest)}`, 'danger');
            }

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
                    State.data.heatmapData.push([v.posicao.lat, v.posicao.lng, 0.5]); 
                } else { 
                    v.activeEvent = { type: 'acidente', label: 'Acidente na Via', timeLeft: 30 * 60000, speedMultiplier: 0 }; 
                    UI.logEvent(`💥 Acidente paralisou via do caminhão ${v.placa}!`, 'danger', v.id);
                    State.data.heatmapData.push([v.posicao.lat, v.posicao.lng, 1.0]); 
                }
                
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