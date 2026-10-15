export class Puntero {
    constructor(ptrId, sizeBytes) {
        this.ptr_id = ptrId;
        this.size_bytes = sizeBytes;
        // Calculamos cuantas paginas de 4 KB necesita 
        this.num_pag = Math.ceil(sizeBytes / 4096);
        this.pag_asoc = []; //IDs de las paginas asignadas
    }
}

export class Process {
    constructor(pid) {
        this.pid = pid;
        this.ptr_table = []; // Lista de punteros creados por el proceso
        this.active = 1;        // Flag para saber si esta activo
    }
}