import { TOTAL_PAGINAS_RAM, PAGE_SIZE_BYTES, Page } from '../models/mmu.js';
import { to_removeOpt } from '../algorithms/opt.js';
import { to_removefifo } from '../algorithms/fifo.js';
import { to_removelru } from '../algorithms/lru.js';
import { to_removelfu } from '../algorithms/lfu.js';
import { to_removeSC } from '../algorithms/sc.js';

function genUniqueId(mmu) {
    return mmu.contadorPagGlobal++;
}

export function op_new(mmu, process, ptr, instr, indiceAct, processList) {
    let pags_to_assign = ptr.num_pag; // Paginas por asignar por puntero
    let asoc_pags = [];
    let pages_created = [];

    for (let i = 0; i < pags_to_assign; i++) {
        // Siempre considere páginas nuevas como un fallo (+5s al reloj y +5s a Thrashing)
        const loadTime = mmu.tiempo_reloj;
        mmu.tiempo_reloj += 5;
        mmu.tiempo_trashing += 5;

        // Buscar si hay marcos libres
        let marco_libre = mmu.ram.findIndex(page => page.memoria_real === 0);
        let index_to_be_removed = -1;

        if (marco_libre !== -1) {
            // Si hay espacio en RAM
            index_to_be_removed = marco_libre;
        } else {
            index_to_be_removed = select_to_remove(mmu, instr, indiceAct, processList);

            let pag_remove = mmu.ram[index_to_be_removed];
            if (pag_remove && pag_remove.id_pag !== -1) {
                pag_remove.memoria_real = 0;
                pag_remove.direccion_fisica = -1;
                if (pag_remove.d_addr === -1) {
                    pag_remove.d_addr = mmu.contadorDiscoGlobal++;
                }
                mmu.disco.push(pag_remove);
            }
        }

        let pagNew = new Page(genUniqueId(mmu), process.pid);
        pagNew.ptr_id = ptr.ptr_id;
        pagNew.direccion_fisica = index_to_be_removed; // Número de segmento/marco en memoria real
        pagNew.d_addr = -1;
        pagNew.memoria_real = 1;
        pagNew.tiempo_llegada = mmu.contadorLlegadaGlobal++;
        pagNew.loaded_t = loadTime;
        pagNew.timestamp_last_use = mmu.tiempo_reloj;
        pagNew.reference_bit = 1;
        pagNew.contador_frecuencia = 1;

        // La fragmentacion interna ocurre en la última página del puntero
        if (i === pags_to_assign - 1) {
            const remainder = ptr.size_bytes % PAGE_SIZE_BYTES;
            pagNew.desperdicio_bytes = remainder === 0 ? 0 : PAGE_SIZE_BYTES - remainder;
        } else {
            pagNew.desperdicio_bytes = 0;
        }

        if (mmu.ram[index_to_be_removed].memoria_real === 0 && mmu.marcos_ocupados < TOTAL_PAGINAS_RAM) {
            mmu.marcos_ocupados++;
        }

        mmu.ram[index_to_be_removed] = pagNew;
        asoc_pags.push(pagNew.id_pag);
        pages_created.push(pagNew);
    }

    ptr.pag_asoc = asoc_pags;
    process.ptr_table.push(ptr);
    mmu.mapa_memoria.set(ptr.ptr_id, pages_created);
}

function select_to_remove(mmu, instr, indiceAct, processList) {
    switch (mmu.tipo_algoritmo) {
        case 'OPT':
            return to_removeOpt(mmu, instr, indiceAct, processList);
        case 'LRU':
            return to_removelru(mmu);
        case 'FIFO':
            return to_removefifo(mmu);
        case 'LFU':
            return to_removelfu(mmu);
        case 'SC':
            return to_removeSC(mmu);
        default:
            return 0;
    }
}

// USE: Simula el uso de un puntero
export function op_use(mmu, processList, ptrId, instr, indiceAct) {
    for (let proc of processList) {
        if (proc.active === 0) continue;
        let ptr = proc.ptr_table.find(p => p.ptr_id === ptrId);
        if (ptr) {
            // Garantizar que las páginas que corresponden al ptr estén en memoria real
            for (let idPag of ptr.pag_asoc) {
                let page_in_ram = mmu.ram.find(pag => pag.id_pag === idPag && pag.memoria_real === 1);
                if (page_in_ram) {
                    // HIT (+1s al reloj)
                    mmu.tiempo_reloj += 1;
                    page_in_ram.timestamp_last_use = mmu.tiempo_reloj; // LRU
                    page_in_ram.reference_bit = 1; // SC
                    page_in_ram.contador_frecuencia++; // LFU
                } else {
                    // MISS / FALLO DE PAGINA (+5s al reloj y +5s a Thrashing)
                    const loadTime = mmu.tiempo_reloj;
                    mmu.tiempo_reloj += 5;
                    mmu.tiempo_trashing += 5;

                    let marco_libre = mmu.ram.findIndex(page => page.memoria_real === 0);
                    let index_to_be_removed = -1;

                    if (marco_libre !== -1) {
                        index_to_be_removed = marco_libre;
                        if (mmu.marcos_ocupados < TOTAL_PAGINAS_RAM) {
                            mmu.marcos_ocupados++;
                        }
                    } else {
                        index_to_be_removed = select_to_remove(mmu, instr, indiceAct, processList);

                        let pag_remove = mmu.ram[index_to_be_removed];
                        if (pag_remove && pag_remove.id_pag !== -1) {
                            pag_remove.memoria_real = 0;
                            pag_remove.direccion_fisica = -1;
                            if (pag_remove.d_addr === -1) {
                                pag_remove.d_addr = mmu.contadorDiscoGlobal++;
                            }
                            mmu.disco.push(pag_remove);
                        }
                    }

                    let pagVirtual = mmu.disco.find(pag => pag.id_pag === idPag);
                    if (pagVirtual) {
                        pagVirtual.direccion_fisica = index_to_be_removed;
                        pagVirtual.memoria_real = 1;
                        pagVirtual.tiempo_llegada = mmu.contadorLlegadaGlobal++;
                        pagVirtual.loaded_t = loadTime;
                        pagVirtual.timestamp_last_use = mmu.tiempo_reloj;
                        pagVirtual.reference_bit = 1;
                        pagVirtual.contador_frecuencia++;

                        mmu.ram[index_to_be_removed] = pagVirtual;

                        // Quitar del disco
                        mmu.disco = mmu.disco.filter(pag => pag.id_pag !== idPag);
                    }
                }
            }
            return;
        }
    }
}

// DELETE: Libera memoria asociada con un puntero (tanto en RAM como en Disco)
export function op_delete(mmu, processList, ptrId) {
    for (let proc of processList) {
        let indexPtr = proc.ptr_table.findIndex(p => p.ptr_id === ptrId);
        if (indexPtr !== -1) {
            let ptr = proc.ptr_table[indexPtr];
            for (let idPag of ptr.pag_asoc) {
                let index_page = mmu.ram.findIndex(pag => pag.id_pag === idPag && pag.memoria_real === 1);
                if (index_page !== -1) {
                    mmu.ram[index_page] = new Page();
                    mmu.marcos_ocupados = Math.max(0, mmu.marcos_ocupados - 1);
                } else {
                    mmu.disco = mmu.disco.filter(pag => pag.id_pag !== idPag);
                }
            }
            proc.ptr_table.splice(indexPtr, 1);
            mmu.mapa_memoria.delete(ptrId);
            return;
        }
    }
}

// KILL: Finalizar un proceso y liberar toda su memoria
export function op_kill(mmu, processList, pidProcess) {
    let proc = processList.find(p => p.pid === pidProcess);
    if (!proc || proc.active === 0) return;

    let idsPtrs = proc.ptr_table.map(ptrTemp => ptrTemp.ptr_id);
    for (let ptrId of idsPtrs) {
        op_delete(mmu, processList, ptrId);
    }

    proc.active = 0;
}
