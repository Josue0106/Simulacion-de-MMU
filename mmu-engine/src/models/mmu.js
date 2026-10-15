export const TOTAL_PAGINAS_RAM = 100;
export const PAGE_SIZE_BYTES = 4096;

export class Page {
    constructor(id_pag = -1, pid = -1){
        this.id_pag = id_pag;
        this.pid = pid;
        this.direccion_fisica = -1; //Flag 0 si esta en disco/VRAM
        this.memoria_real = 0; //Saber si esta en memoria real o no
        //Para algoritmos
        this.tiempo_llegada = 0;
        this.timestamp_last_use = 0; //LRU
        this.reference_bit = 0; //Second Chance
        this.contador_frecuencia = 0; //LFU
    }
}

export class MMU{
    constructor(tipoAlgoritmo){
        this.ram = Array.from({length: TOTAL_PAGINAS_RAM}, () => new Page());
        this.disco = [];
        this.marcos_ocupados = 0;
        this.tiempo_reloj = 0;
        this.tiempo_trashing = 0;
        this.tipo_algoritmo = tipo_algoritmo;
        this.contadorLlegadaGlobal = 1;
    }
}