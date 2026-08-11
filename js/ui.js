const UI = {
    tempRouteData: { origin: null, dest: null, contractId: null, reward: 0 }, 
    tempCargo: [], isFullscreen: false, manageMode: null, editingId: null, chartLine: null, chartBar: null,

    init() {
        document.getElementById('btn-play').addEventListener('click', () => Simulation.start());
        document.getElementById('btn-pause').addEventListener('click', () => Simulation.pause());
        document.getElementById('btn-reset').addEventListener('click', () => { if(confirm('Sua empresa será zerada. Confirma?')) State.reset(); });
        document.getElementById('btn-theme').addEventListener('click', () => MapService.toggleTheme());
        document.getElementById('btn-heatmap').addEventListener('click', (e) => { MapService.toggleHeatmap(); e.target.classList.toggle('active'); });

        setInterval(() => {
            const now = new Date(); const isMobile = window.innerWidth <= 1024;
            const options = isMobile ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }; 
            document.getElementById('real-time').innerText = now.toLocaleString('pt-BR', options).toUpperCase();
        }, 1000);

        // Tablet e Mobile começam com os painéis laterais retraídos de forma inteligente
        if (window.innerWidth <= 1024) document.getElementById('panel-left').classList.add('collapsed');

        document.getElementById('btn-toggle-panel').addEventListener('click', () => { document.getElementById('panel-left').classList.toggle('collapsed'); MapService.invalidate(); });
        document.getElementById('btn-toggle-feed').addEventListener('click', () => { document.getElementById('event-feed').classList.toggle('collapsed'); });
        document.getElementById('btn-close-details').addEventListener('click', () => { document.getElementById('panel-right').classList.remove('open'); });

        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen(true));
        document.getElementById('btn-exit-fs').addEventListener('click', () => this.toggleFullscreen(false));
        document.querySelectorAll('.speed-btn').forEach(btn => { btn.addEventListener('click', (e) => { Simulation.setSpeed(Number(e.target.dataset.speed)); document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); }); });
        
        document.getElementById('btn-manage-drivers').addEventListener('click', () => this.openManageModal('drivers'));
        document.getElementById('btn-manage-fleet').addEventListener('click', () => this.openManageModal('fleet'));
        document.getElementById('btn-close-manage').addEventListener('click', () => document.getElementById('modal-manage').classList.add('hidden'));
        document.getElementById('btn-cancel-edit').addEventListener('click', () => this.cancelEdit());
        document.getElementById('btn-save-manage').addEventListener('click', () => this.saveManageForm());

        document.getElementById('btn-history').addEventListener('click', () => this.openHistoryModal());
        document.getElementById('btn-close-history').addEventListener('click', () => document.getElementById('modal-history').classList.add('hidden'));

        document.getElementById('btn-contracts').addEventListener('click', () => this.openContractsModal());
        document.getElementById('btn-close-contracts').addEventListener('click', () => document.getElementById('modal-contracts').classList.add('hidden'));

        document.getElementById('btn-company').addEventListener('click', () => this.openCompanyModal());
        document.getElementById('btn-close-company').addEventListener('click', () => { document.getElementById('modal-company').classList.add('hidden'); MapService.clearTempMarkers(); });

        document.getElementById('btn-bank').addEventListener('click', () => this.openBankModal());
        document.getElementById('btn-close-bank').addEventListener('click', () => document.getElementById('modal-bank').classList.add('hidden'));
        document.getElementById('btn-pay-loan').addEventListener('click', () => this.payLoan());

        document.getElementById('btn-dashboard').addEventListener('click', () => this.openDashboardModal());
        document.getElementById('btn-close-dashboard').addEventListener('click', () => document.getElementById('modal-dashboard').classList.add('hidden'));

        this.initRouteModal();
        this.initCompanySetup();
        this.updateCashUI();
        this.updateWeatherUI();
        this.renderVehiclesList();
        this.renderEventFeed();
    },

    updateWeatherUI() {
        const ind = document.getElementById('weather-indicator');
        const overlay = document.getElementById('weather-overlay');
        overlay.className = 'weather-overlay'; 
        ind.className = 'weather-indicator';

        if(State.data.simulation.weather === 'rain') {
            ind.innerText = '🌧️ Chuva'; ind.classList.add('rain'); overlay.classList.add('rain');
        } else if(State.data.simulation.weather === 'fog') {
            ind.innerText = '🌫️ Neblina'; ind.classList.add('fog'); overlay.classList.add('fog');
        } else {
            ind.innerText = '☀️ Claro'; overlay.classList.add('clear');
        }
    },

    updateCashUI() {
        const cashDiv = document.getElementById('company-cash');
        cashDiv.innerText = `Caixa: ${Utils.formatCurrency(State.data.company.cash)}`;
        if (State.data.company.cash < 0) cashDiv.classList.add('negative'); else cashDiv.classList.remove('negative');
    },

    toggleFullscreen(act) {
        this.isFullscreen = act; const layout = document.getElementById('app-layout'); const footer = document.getElementById('fullscreen-footer'); const btnExit = document.getElementById('btn-exit-fs'); const feed = document.getElementById('event-feed');
        if (act) { layout.classList.add('fs-mode'); footer.classList.remove('hidden'); btnExit.classList.remove('hidden'); feed.classList.add('hidden'); this.updateFullscreenOverlay(); } 
        else { layout.classList.remove('fs-mode'); footer.classList.add('hidden'); btnExit.classList.add('hidden'); feed.classList.remove('hidden'); }
        MapService.invalidate();
    },

    logEvent(message, type = 'info', vehicleId = null) {
        State.data.eventLog.push({ time: new Date().getTime(), message, type, vehicleId });
        if(State.data.eventLog.length > 50) State.data.eventLog.shift(); State.save(); this.renderEventFeed(); this.showVehicleDetails(); 
    },
    renderEventFeed() {
        const list = document.getElementById('event-feed-list'); list.innerHTML = '';
        [...State.data.eventLog].reverse().forEach(l => { list.innerHTML += `<div class="event-log-item ${l.type==='danger'?'red':''}"><span>${Utils.formatTimeOnly(l.time)}</span>${l.message}</div>`; });
    },

    // BANCO 🏦
    openBankModal() {
        document.getElementById('modal-bank').classList.remove('hidden');
        document.getElementById('bank-debt').innerText = Utils.formatCurrency(State.data.company.loan);
        const payBtn = document.getElementById('btn-pay-loan');
        if(State.data.company.loan > 0) { payBtn.style.display = 'block'; payBtn.disabled = State.data.company.cash < State.data.company.loan; } 
        else { payBtn.style.display = 'none'; }
    },
    takeLoan(amount) {
        State.data.company.cash += amount;
        State.data.company.loan += amount;
        this.logEvent(`🏦 Empréstimo de ${Utils.formatCurrency(amount)} liberado pelo Banco.`, 'info');
        State.save(); this.updateCashUI(); this.openBankModal();
    },
    payLoan() {
        if(State.data.company.cash < State.data.company.loan) return alert("Você não tem saldo suficiente para quitar essa dívida inteira.");
        State.data.company.cash -= State.data.company.loan;
        State.data.company.loan = 0;
        this.logEvent(`🏦 Dívida bancária quitada com sucesso.`, 'info');
        State.save(); this.updateCashUI(); this.openBankModal();
    },

    // DASHBOARD 📊
    openDashboardModal() {
        document.getElementById('modal-dashboard').classList.remove('hidden');
        
        const labelsLinha = State.data.financeHistory.map(h => h.dayLabel);
        const dataLinha = State.data.financeHistory.map(h => h.balance);

        const activeFleet = State.data.fleet.filter(f => f.tripsCount > 0);
        const labelsBarra = activeFleet.map(f => f.plate);
        const dataBarra = activeFleet.map(f => f.totalProfit || 0);

        Chart.defaults.color = '#aaa';

        if(this.chartLine) this.chartLine.destroy();
        this.chartLine = new Chart(document.getElementById('chart-finance').getContext('2d'), {
            type: 'line',
            data: { labels: labelsLinha, datasets: [{ label: 'Saldo em Caixa (R$)', data: dataLinha, borderColor: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.2)', fill: true, tension: 0.4 }] }
        });

        if(this.chartBar) this.chartBar.destroy();
        this.chartBar = new Chart(document.getElementById('chart-fleet').getContext('2d'), {
            type: 'bar',
            data: { labels: labelsBarra, datasets: [{ label: 'Lucro Líquido Gerado (R$)', data: dataBarra, backgroundColor: '#ff9800' }] }
        });
    },

    openCompanyModal() {
        document.getElementById('modal-company').classList.remove('hidden');
        document.getElementById('hq-status').innerText = State.data.company.hq ? "✓ Sede Construída e Operacional" : "Não definida.";
        document.getElementById('btn-set-hq').disabled = State.data.company.hq !== null;
        document.getElementById('branches-status').innerText = `${State.data.company.branches.length} filiais construídas.`;
    },
    initCompanySetup() {
        document.getElementById('btn-set-hq').addEventListener('click', () => {
            if(State.data.company.cash < 50000) return alert("Caixa insuficiente! Custa R$ 50.000.");
            document.getElementById('modal-company').classList.add('hidden');
            MapService.enablePicking('hq', (latlng) => {
                State.data.company.cash -= 50000; State.data.company.hq = latlng;
                State.save(); this.updateCashUI(); MapService.drawCompanyInfrastructure();
                alert("Sede construída com sucesso!"); this.openCompanyModal();
            });
        });
        document.getElementById('btn-add-branch').addEventListener('click', () => {
            if(State.data.company.cash < 25000) return alert("Caixa insuficiente! Custa R$ 25.000.");
            document.getElementById('modal-company').classList.add('hidden');
            MapService.enablePicking('branch', (latlng) => {
                State.data.company.cash -= 25000; State.data.company.branches.push(latlng);
                State.save(); this.updateCashUI(); MapService.drawCompanyInfrastructure();
                alert("Nova filial inaugurada!"); this.openCompanyModal();
            });
        });
    },

    openManageModal(mode) {
        this.manageMode = mode; this.cancelEdit(); document.getElementById('modal-manage').classList.remove('hidden');
        document.getElementById('manage-title').innerText = mode === 'drivers' ? 'Gestão de Motoristas (RH)' : 'Concessionária e Frota';
        this.buildManageForm(); this.renderManageList();
    },
    buildManageForm() {
        const container = document.getElementById('manage-form-inputs'); container.innerHTML = '';
        if (this.manageMode === 'drivers') {
            document.getElementById('manage-form-title').innerText = "Contratar Novo Motorista (Custo Fixo p/ Viagem: R$ 150)";
            container.innerHTML = `<div class="form-group"><label>Nome</label><input type="text" id="m-name" placeholder="Nome Completo"></div><div class="form-group" style="flex:0.5;"><label>Idade</label><input type="number" id="m-age" placeholder="Ex: 35"></div><div class="form-group" style="flex:0.5;"><label>Sexo</label><select id="m-gender"><option value="M">Masc</option><option value="F">Fem</option><option value="O">Outro</option></select></div>`;
        } else {
            document.getElementById('manage-form-title').innerText = "Comprar Novo Caminhão (Desconta do Caixa)";
            let modelOpts = ''; for (const [k, v] of Object.entries(State.vehicleModels)) modelOpts += `<option value="${k}">${v.name} - ${Utils.formatCurrency(v.price)} (Custo: R$${v.costPerKm}/km)</option>`;
            container.innerHTML = `<div class="form-group"><label>Defina uma Placa</label><input type="text" id="m-plate" placeholder="ABC-1234"></div><div class="form-group"><label>Modelo na Loja</label><select id="m-model">${modelOpts}</select></div>`;
        }
    },
    renderManageList() {
        const list = document.getElementById('manage-list'); list.innerHTML = '';
        const dataArr = this.manageMode === 'drivers' ? State.data.drivers : State.data.fleet;
        if (dataArr.length === 0) return list.innerHTML = '<p>Nenhum registro encontrado.</p>';
        dataArr.forEach(item => {
            const title = this.manageMode === 'drivers' ? item.name : `${item.plate} (${item.modelName})`;
            const sub = this.manageMode === 'drivers' ? `RH: ${item.age} anos | ${item.gender}` : `Manutenção: R$ ${State.vehicleModels[item.modelKey].costPerKm}/km`;
            list.innerHTML += `<div class="stat-card"><h4>${title}</h4><p style="color:#fff;">${sub}</p><p>Viagens: ${item.tripsCount} | Distância: ${item.totalKm.toFixed(1)} km</p><div class="crud-actions"><button class="btn-delete" onclick="UI.deleteRecord('${item.id}')">Demitir/Vender</button></div></div>`;
        });
    },
    saveManageForm() {
        if (this.manageMode === 'drivers') {
            const name = document.getElementById('m-name').value.trim(); const age = document.getElementById('m-age').value;
            if(!name || !age) return alert("Preencha todos os campos.");
            State.data.drivers.push({ id: Utils.generateId('D'), name, age, gender: document.getElementById('m-gender').value, tripsCount: 0, totalKm: 0, totalTimeMs: 0, totalProfit: 0 });
            this.logEvent(`RH: Motorista ${name} contratado.`, 'info');
        } else {
            const plate = document.getElementById('m-plate').value.trim(); const mk = document.getElementById('m-model').value;
            if(!plate) return alert("Preencha a placa.");
            const vData = State.vehicleModels[mk];
            if (State.data.company.cash < vData.price) return alert(`Caixa insuficiente! Custa ${Utils.formatCurrency(vData.price)}.`);
            
            State.data.company.cash -= vData.price;
            State.data.fleet.push({ id: Utils.generateId('F'), plate, modelKey: mk, modelName: vData.name, vel: vData.vel, tripsCount: 0, totalKm: 0, totalTimeMs: 0, totalProfit: 0 });
            this.logEvent(`Frota: Comprado ${vData.name} por ${Utils.formatCurrency(vData.price)}.`, 'info'); this.updateCashUI();
        }
        State.save(); this.cancelEdit(); this.renderManageList();
    },
    deleteRecord(id) {
        if (State.data.vehicles.some(v => (v.driverId === id || v.fleetId === id) && v.status === 'em_rota')) return alert("Ocupado em rota ativa!");
        if(!confirm("Atenção: A demissão não tem rescisão e a venda de caminhão NÃO DEVOLVE o dinheiro investido. Confirma?")) return;
        if (this.manageMode === 'drivers') State.data.drivers = State.data.drivers.filter(x => x.id !== id); else State.data.fleet = State.data.fleet.filter(x => x.id !== id);
        State.save(); this.renderManageList();
    },
    cancelEdit() { if(document.getElementById('m-name')) { document.getElementById('m-name').value = ''; document.getElementById('m-age').value = ''; } if(document.getElementById('m-plate')) document.getElementById('m-plate').value = ''; },

    openContractsModal() {
        if(!State.data.company.hq) return alert("Atenção! Construa a Matriz Principal (Sede) para aceitar Contratos. A carga precisa passar por triagem lá.");
        document.getElementById('modal-contracts').classList.remove('hidden');
        const list = document.getElementById('contracts-list'); list.innerHTML = '';
        if(State.data.contracts.length === 0) return list.innerHTML = '<p>Nenhum contrato disponível. Aguarde o mercado aquecer...</p>';
        State.data.contracts.forEach(c => { list.innerHTML += `<div class="stat-card"><h4>${c.title} <span class="contract-reward">+ ${Utils.formatCurrency(c.reward)}</span></h4><p><strong>Origem:</strong> ${c.origName} ➔ <strong>Destino:</strong> ${c.destName}</p><p style="color:#fff; font-size:0.8em; margin-top:5px;">Carga: ${c.cargoDesc}</p><button class="btn-primary" style="margin-top:10px; padding:5px 15px;" onclick="UI.acceptContract('${c.id}')">Tratar & Entregar Frete</button></div>`; });
    },

    acceptContract(id) {
        const c = State.data.contracts.find(x => x.id === id); if(!c) return;
        if(State.data.drivers.length === 0 || State.data.fleet.length === 0) return alert("Você precisa de Frota e Motoristas.");
        document.getElementById('modal-contracts').classList.add('hidden'); document.getElementById('modal-new').classList.remove('hidden'); document.getElementById('route-modal-title').innerText = `Contrato: ${c.title} (${Utils.formatCurrency(c.reward)})`;
        document.getElementById('hub-selection-group').classList.remove('hidden');
        const hubSelect = document.getElementById('sel-hub'); hubSelect.innerHTML = `<option value="hq">Matriz Principal</option>`; State.data.company.branches.forEach((b, i) => { hubSelect.innerHTML += `<option value="branch_${i}">Filial ${i+1}</option>`; });
        document.getElementById('inp-origin-addr').value = c.origName; document.getElementById('inp-origin-addr').disabled = true; document.getElementById('btn-pick-origin').disabled = true; document.getElementById('btn-search-origin').disabled = true; document.getElementById('inp-dest-addr').value = c.destName; document.getElementById('inp-dest-addr').disabled = true; document.getElementById('btn-pick-dest').disabled = true; document.getElementById('btn-search-dest').disabled = true;
        document.getElementById('btn-add-item').classList.add('hidden');
        this.tempRouteData = { origin: c.origCoords, dest: c.destCoords, contractId: c.id, reward: c.reward }; this.tempCargo = [{ name: c.cargoDesc, qty: 1, unit: 'CX', value: c.reward * 0.5 }]; this.renderCargoList(); 
        document.querySelectorAll('.btn-remove-item').forEach(b => b.classList.add('hidden')); document.querySelectorAll('.cargo-row input').forEach(i => i.disabled = true);
        this.populateCreationDropdowns(); MapService.clearTempMarkers(); MapService.setTempMarker('origin', c.origCoords); MapService.setTempMarker('dest', c.destCoords); this.validateForm();
    },

    initRouteModal() {
        const modal = document.getElementById('modal-new');
        document.getElementById('btn-new-op').addEventListener('click', () => {
            if(State.data.drivers.length === 0 || State.data.fleet.length === 0) return alert("Cadastre Veículos e Motoristas.");
            modal.classList.remove('hidden'); document.getElementById('route-modal-title').innerText = "Viagem Livre (Apenas Custos)"; document.getElementById('hub-selection-group').classList.add('hidden');
            this.tempRouteData = { origin: null, dest: null, contractId: null, reward: 0 }; this.tempCargo = [];
            document.getElementById('btn-add-item').classList.remove('hidden'); ['inp-origin-addr', 'btn-pick-origin', 'btn-search-origin', 'inp-dest-addr', 'btn-pick-dest', 'btn-search-dest'].forEach(id => document.getElementById(id).disabled = false);
            this.renderCargoList(); this.populateCreationDropdowns(); MapService.clearTempMarkers(); this.validateForm();
        });
        document.getElementById('btn-cancel-new').addEventListener('click', () => { modal.classList.add('hidden'); MapService.clearTempMarkers(); });
        document.getElementById('btn-add-item').addEventListener('click', () => { this.tempCargo.push({ name: '', qty: 1, unit: 'UN', value: 0 }); this.renderCargoList(); });
        const setupEndpoint = (type, btnPickId, inputAddrId, btnSearchId, label) => {
            const btnPick = document.getElementById(btnPickId); const inputAddr = document.getElementById(inputAddrId); const btnSearch = document.getElementById(btnSearchId);
            btnPick.addEventListener('click', () => { btnPick.classList.add('picking'); btnPick.textContent = '...'; modal.classList.add('hidden'); MapService.enablePicking(type, (latlng) => { this.tempRouteData[type] = latlng; btnPick.classList.remove('picking'); btnPick.classList.add('picked'); btnPick.textContent = `✓ ${label}`; inputAddr.value = 'Coordenada'; modal.classList.remove('hidden'); this.validateForm(); }); });
            btnSearch.addEventListener('click', async () => { if(!inputAddr.value) return; btnSearch.textContent = '...'; const coords = await Utils.getCoordsFromAddress(inputAddr.value); btnSearch.textContent = '🔍'; if(coords) { this.tempRouteData[type] = coords; MapService.setTempMarker(type, coords); btnPick.classList.add('picked'); btnPick.textContent = `✓ ${label}`; this.validateForm(); } });
        };
        setupEndpoint('origin', 'btn-pick-origin', 'inp-origin-addr', 'btn-search-origin', 'Origem'); setupEndpoint('dest', 'btn-pick-dest', 'inp-dest-addr', 'btn-search-dest', 'Destino');

        document.getElementById('btn-save-new').addEventListener('click', async () => {
            const btnSave = document.getElementById('btn-save-new'); btnSave.disabled = true; btnSave.textContent = 'Roteirizando...';
            const fleetCar = State.data.fleet.find(f => f.id === document.getElementById('sel-vehicle').value); const driver = State.data.drivers.find(d => d.id === document.getElementById('sel-driver').value);
            let waypoints = [];
            if (this.tempRouteData.contractId) {
                const hubVal = document.getElementById('sel-hub').value; let hubCoords = State.data.company.hq;
                if(hubVal.startsWith('branch_')) hubCoords = State.data.company.branches[parseInt(hubVal.split('_')[1])];
                waypoints = [this.tempRouteData.origin, hubCoords, this.tempRouteData.dest];
            } else { waypoints = [this.tempRouteData.origin, this.tempRouteData.dest]; }

            const pathCoords = await Utils.getRoadPath(waypoints);
            const newVehicle = {
                id: Utils.generateId('V'), fleetId: fleetCar.id, placa: fleetCar.plate, modelo: fleetCar.modelName, velocidade: fleetCar.vel, costPerKm: State.vehicleModels[fleetCar.modelKey].costPerKm,
                driverId: driver.id, motorista: driver.name, carga: this.tempCargo.filter(c => c.name.trim() !== ''), status: 'em_rota', path: pathCoords,
                distanceKm: Utils.calculatePathDistance(pathCoords), startTime: State.data.simulation.currentTime, currentPathIndex: 0, posicao: { lat: pathCoords[0][0], lng: pathCoords[0][1] }, activeEvent: null, contractId: this.tempRouteData.contractId, expectedReward: this.tempRouteData.reward
            };
            if(newVehicle.contractId) State.data.contracts = State.data.contracts.filter(c => c.id !== newVehicle.contractId);
            State.data.vehicles.push(newVehicle); State.save(); this.logEvent(`Viagem iniciada: ${fleetCar.plate} (${driver.name}). Prev: ${newVehicle.distanceKm.toFixed(0)}km.`, 'info');
            MapService.clearTempMarkers(); MapService.drawAllRoutes(); MapService.updateMarkers(); this.renderVehiclesList();
            document.getElementById('inp-origin-addr').value = ''; document.getElementById('inp-dest-addr').value = '';
            if (window.innerWidth <= 1024) document.getElementById('panel-left').classList.add('collapsed');
            btnSave.textContent = 'Iniciar Viagem'; modal.classList.add('hidden');
        });
    },

    populateCreationDropdowns() {
        const selD = document.getElementById('sel-driver'); const selF = document.getElementById('sel-vehicle'); selD.innerHTML = ''; selF.innerHTML = '';
        const busyD = State.data.vehicles.filter(v => v.status === 'em_rota').map(v => v.driverId); const busyF = State.data.vehicles.filter(v => v.status === 'em_rota').map(v => v.fleetId);
        let dC = 0, fC = 0;
        State.data.drivers.forEach(d => { if(!busyD.includes(d.id)) { selD.innerHTML += `<option value="${d.id}">${d.name} (Custo: R$ 150/viagem)</option>`; dC++; } });
        State.data.fleet.forEach(f => { if(!busyF.includes(f.id)) { selF.innerHTML += `<option value="${f.id}">${f.plate} (${f.modelName}) - R$ ${State.vehicleModels[f.modelKey].costPerKm}/km</option>`; fC++; } });
        if (dC === 0) selD.innerHTML = '<option value="" disabled selected>Todos em viagem!</option>'; if (fC === 0) selF.innerHTML = '<option value="" disabled selected>Nenhum carro livre!</option>';
    },
    renderCargoList() {
        const list = document.getElementById('cargo-list'); list.innerHTML = '';
        this.tempCargo.forEach((item, index) => {
            const row = document.createElement('div'); row.className = 'cargo-row';
            row.innerHTML = `<input type="text" class="c-name" placeholder="Item" value="${item.name}"><input type="number" class="c-qty" placeholder="Qtd" value="${item.qty}"><select class="c-unit"><option value="UN" ${item.unit==='UN'?'selected':''}>UN</option><option value="KG" ${item.unit==='KG'?'selected':''}>KG</option><option value="CX" ${item.unit==='CX'?'selected':''}>CX</option></select><input type="number" step="0.01" min="0" class="c-value" placeholder="R$" value="${item.value}"><button class="btn-remove-item">X</button>`;
            row.querySelector('.c-name').addEventListener('input', (e) => this.tempCargo[index].name = e.target.value); row.querySelector('.c-qty').addEventListener('input', (e) => { this.tempCargo[index].qty = e.target.value; this.updateCargoTotals(); }); row.querySelector('.c-unit').addEventListener('change', (e) => this.tempCargo[index].unit = e.target.value); row.querySelector('.c-value').addEventListener('input', (e) => { this.tempCargo[index].value = e.target.value; this.updateCargoTotals(); }); row.querySelector('.btn-remove-item').addEventListener('click', () => { this.tempCargo.splice(index, 1); this.renderCargoList(); }); list.appendChild(row);
        }); this.updateCargoTotals();
    },
    updateCargoTotals() { let totalVal = 0; let totalQty = 0; this.tempCargo.forEach(i => { totalVal += Number(i.value || 0); totalQty += Number(i.qty || 0); }); document.getElementById('cargo-total-display').innerText = `Total: ${totalQty} unid | ${Utils.formatCurrency(totalVal)}`; },
    validateForm() { document.getElementById('btn-save-new').disabled = !(this.tempRouteData.origin && this.tempRouteData.dest && document.getElementById('sel-driver').value && document.getElementById('sel-vehicle').value); },
    
    archiveVehicle(id, e) {
        e.stopPropagation(); const idx = State.data.vehicles.findIndex(v => v.id === id);
        if(idx > -1) {
            const v = State.data.vehicles.splice(idx, 1)[0]; v.tripLogs = State.data.eventLog.filter(l => l.vehicleId === v.id); State.data.archivedVehicles.push(v);
            if(State.data.selectedVehicle === id) { State.data.selectedVehicle = null; MapService.isTracking = false; document.getElementById('panel-right').classList.remove('open'); }
            State.save(); this.renderVehiclesList(); this.showVehicleDetails(); MapService.drawAllRoutes(); MapService.updateMarkers();
        }
    },
    openHistoryModal() {
        document.getElementById('modal-history').classList.remove('hidden'); const list = document.getElementById('history-list'); list.innerHTML = '';
        if(State.data.archivedVehicles.length === 0) return list.innerHTML = '<p>Nenhuma rota arquivada.</p>';
        [...State.data.archivedVehicles].reverse().forEach(v => {
            const l = (v.expectedReward || 0) - 150 - (v.distanceKm * v.costPerKm); 
            list.innerHTML += `<div class="stat-card"><h4>${v.placa} <span style="color:${l>=0?'#4caf50':'#f44336'}">${l>=0?'+':''}${Utils.formatCurrency(l)}</span></h4><p>Mot: ${v.motorista} | Dist: ${v.distanceKm.toFixed(1)} km</p><div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;"><span style="color:#4caf50;">✓ Finalizada</span><button class="btn-primary" style="padding: 4px 8px; font-size:0.8em;" onclick="UI.generateReceipt('${v.id}')">📄 Baixar PDF</button></div></div>`;
        });
    },

    generateReceipt(vId) {
        const v = State.data.archivedVehicles.find(x => x.id === vId); if(!v) return;
        document.getElementById('rec-id').innerText = v.id; document.getElementById('rec-plate').innerText = v.placa; document.getElementById('rec-model').innerText = v.modelo; document.getElementById('rec-driver').innerText = v.motorista; document.getElementById('rec-dist').innerText = `${v.distanceKm.toFixed(2)} km`; document.getElementById('rec-date').innerText = new Date().toLocaleDateString('pt-BR');
        const revenue = v.expectedReward || 0; const maintCost = v.distanceKm * v.costPerKm; const profit = revenue - 150 - maintCost;
        document.getElementById('rec-rev').innerText = Utils.formatCurrency(revenue); document.getElementById('rec-cost').innerText = `- ${Utils.formatCurrency(maintCost)}`; document.getElementById('rec-profit').innerText = Utils.formatCurrency(profit); document.getElementById('rec-profit').style.color = profit >= 0 ? '#2e7d32' : '#d32f2f';
        const logTable = document.getElementById('rec-logs'); logTable.innerHTML = '';
        if(v.tripLogs && v.tripLogs.length > 0) { v.tripLogs.forEach(l => { logTable.innerHTML += `<tr><td>${new Date(l.time).toLocaleString('pt-BR')}</td><td>${l.message}</td></tr>`; }); } else { logTable.innerHTML = '<tr><td colspan="2" style="text-align:center;">Viagem transcorrida sem ocorrências.</td></tr>'; }
        const element = document.getElementById('receipt-template'); const opt = { margin: 10, filename: `Comprovante_${v.id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        element.style.left = '0'; element.style.position = 'relative';
        html2pdf().set(opt).from(element).save().then(() => { element.style.position = 'absolute'; element.style.left = '-9999px'; });
    },

    renderVehiclesList() {
        const list = document.getElementById('vehicles-list'); list.innerHTML = ''; if (State.data.vehicles.length === 0) return list.innerHTML = '<p style="padding: 10px; color: #888;">Nenhuma rota ativa.</p>';
        State.data.vehicles.forEach(v => {
            const div = document.createElement('div'); div.className = `vehicle-item ${State.data.selectedVehicle === v.id ? 'active' : ''}`;
            const archiveBtn = v.status === 'concluído' ? `<button class="btn-archive" onclick="UI.archiveVehicle('${v.id}', event)">📦 Arquivar</button>` : '';
            let alertIcon = v.activeEvent ? (v.activeEvent.type === 'acidente' ? '💥' : '🚧') : (v.status === 'concluído' ? '✅' : '');
            div.innerHTML = `<span style="font-size: 1.5rem;">🚚</span> <div style="flex:1;"><strong>${v.id} ${alertIcon}</strong> - ${v.placa}<br><small style="color:#aaa">${v.status.replace('_', ' ').toUpperCase()}</small></div> ${archiveBtn}`;
            div.onclick = () => { State.data.selectedVehicle = v.id; MapService.centerOnVehicle(v.id); this.renderVehiclesList(); this.showVehicleDetails(); this.updateFullscreenOverlay(); }; list.appendChild(div);
        });
    },
    
    showVehicleDetails() {
        if (!State.data.selectedVehicle) { document.getElementById('panel-details').innerHTML = '<p>Selecione um veículo.</p>'; return; }
        const v = State.data.vehicles.find(v => v.id === State.data.selectedVehicle); if (!v) return;
        document.getElementById('panel-right').classList.add('open');
        let cargoHtml = ''; let totalCargo = 0;
        if(v.carga && v.carga.length > 0) { v.carga.forEach(c => { totalCargo += Number(c.value); cargoHtml += `<div class="cargo-item-line"><span>${c.qty}x ${c.name} (${c.unit})</span> <span>${Utils.formatCurrency(c.value)}</span></div>`; }); cargoHtml += `<div style="text-align:right; font-weight:bold; margin-top:5px; color:#4caf50;">Total NF: ${Utils.formatCurrency(totalCargo)}</div>`; } else cargoHtml = '<p>Sem itens.</p>';
        const vLogs = State.data.eventLog.filter(l => l.vehicleId === v.id); let logHtml = vLogs.length === 0 ? '<p style="color:#aaa; font-size: 0.9em;">Nenhum evento registrado.</p>' : [...vLogs].reverse().map(l => `<div style="font-size:0.85em; margin-bottom:6px; border-left:3px solid #555; padding-left:5px;"><span style="color:#888; font-size:0.9em; display:block;">${Utils.formatTimeOnly(l.time)}</span>${l.message}</div>`).join('');
        const currentCost = (v.distanceKm * v.costPerKm) + 150; const finStatus = v.expectedReward > 0 ? `Receita: ${Utils.formatCurrency(v.expectedReward)}<br>Custo: -${Utils.formatCurrency(currentCost)}` : `Custo (Gasto): -${Utils.formatCurrency(currentCost)}`;
        document.getElementById('panel-details').innerHTML = `<h3 id="det-id">${v.id} — ${v.placa}</h3><p style="margin-top:10px">Condutor: <span>${v.motorista}</span></p><div class="details-section"><p>Status: <span id="det-status" style="text-transform: uppercase; color: #4caf50; font-weight:bold;">${v.status.replace('_', ' ')}</span></p><p>Progresso: <span id="det-prog">0%</span></p></div><div class="details-section" style="border-color:#ff9800;"><p style="color: #ff9800; font-weight:bold; margin-bottom: 5px;">FINANCEIRO DA VIAGEM</p><p style="font-size:0.9em;">${finStatus}</p></div><div class="details-section" style="max-height:120px; overflow-y:auto;"><p style="color:#aaa; margin-bottom:5px;">OCORRÊNCIAS:</p>${logHtml}</div><div class="details-section"><p style="color:#aaa; margin-bottom: 5px;">NOTA FISCAL:</p>${cargoHtml}</div>`;
    },
    updateVehicleDetails() {
        if (!State.data.selectedVehicle || !document.getElementById('det-id')) return; const v = State.data.vehicles.find(v => v.id === State.data.selectedVehicle); if(!v) return;
        let s = v.status.replace('_', ' '); if(v.activeEvent) s = `PARADO: ${v.activeEvent.label.toUpperCase()}`;
        document.getElementById('det-status').innerText = s; document.getElementById('det-status').style.color = v.activeEvent ? (v.activeEvent.type==='acidente'?'#f44336':'#ffeb3b') : '#4caf50';
        document.getElementById('det-prog').innerText = `${(v.path && v.path.length > 0 ? Math.min(100, Math.round((v.currentPathIndex / v.path.length) * 100)) : 0)}%`;
    },
    updateFullscreenOverlay() {
        if (!this.isFullscreen || !State.data.selectedVehicle) return; const v = State.data.vehicles.find(v => v.id === State.data.selectedVehicle); if(!v) return;
        document.getElementById('fs-vehicle-info').innerText = `${v.id} | Cond: ${v.motorista} | Placa: ${v.placa} | ${(v.activeEvent?`PARADO: ${v.activeEvent.label}`:v.status).toUpperCase()}`;
        const perc = v.path && v.path.length > 0 ? Math.min(100, Math.round((v.currentPathIndex / v.path.length) * 100)) : 0;
        document.getElementById('fs-progress-text').innerText = `Progresso: ${perc}%`; document.getElementById('fs-progress-fill').style.width = `${perc}%`;
    }
};