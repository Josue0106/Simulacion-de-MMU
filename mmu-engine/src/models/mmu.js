export const TOTAL_PAGINAS_RAM = 100;
export const PAGE_SIZE_BYTES = 4096;

export class Page {
    constructor(id_pag = -1, pid = -1) {
        this.id_pag = id_pag;
        this.pid = pid;
        this.ptr_id = -1;            // L-ADDR (Puntero lógico asociado)
        this.direccion_fisica = -1;  // M-ADDR (Marco en RAM 0..99, o -1 si está en disco)
        this.d_addr = -1;            // D-ADDR (Dirección en disco cuando está en memoria virtual)
        this.memoria_real = 0;       // 1 si está en RAM, 0 si está en memoria virtual
        this.desperdicio_bytes = 0;  // Fragmentación interna en bytes de esta página
        // Para algoritmos y tabla MMU
        this.tiempo_llegada = 0;
        this.loaded_t = 0;           // LOADED-T en segundos del reloj de simulación
        this.timestamp_last_use = 0; // LRU
        this.reference_bit = 0;      // Second Chance (SC)
        this.contador_frecuencia = 0;// LFU
    }
}

export class MMU {
    constructor(tipoAlgoritmo) {
        this.ram = Array.from({ length: TOTAL_PAGINAS_RAM }, () => new Page());
        this.disco = [];
        this.mapa_memoria = new Map(); // ptr_id -> array de Page
        this.marcos_ocupados = 0;
        this.tiempo_reloj = 0;
        this.tiempo_trashing = 0;
        this.tipo_algoritmo = tipoAlgoritmo;
        this.contadorLlegadaGlobal = 1;
        this.contadorPagGlobal = 1;
        this.contadorDiscoGlobal = 1;
    }
}