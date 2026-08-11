document.addEventListener("DOMContentLoaded", () => {
    // 1. Carrega dados salvos localmente (Gestão, Frota, Histórico)
    State.init();

    // 2. Inicia o mapa baseando-se nos dados do State
    MapService.init();
    MapService.updateMarkers();
    
    // 3. Inicia a Interface
    UI.init();
});
