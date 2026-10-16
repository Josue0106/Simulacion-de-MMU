import { MMU, TOTAL_PAGINAS_RAM, PAGE_SIZE_BYTES } from './models/mmu.js';
import { Process, Puntero } from './models/process.js';
import { op_new, op_use, op_delete, op_kill } from './core/operations.js';

/**
 * Clase para ejecutar una instancia de simulación paso a paso o completa.
 */
export class SimuladorInstancia {
    constructor(instruccionesParsed, tipoAlgoritmo) {
        this.instrucciones = instruccionesParsed;
        this.tipoAlgoritmo = tipoAlgoritmo;
        this.mmu = new MMU(tipoAlgoritmo);
        this.listaProcesos = [];
        this.indiceActual = 0;
        this.ultimaInstruccion = null;
    }

    step() {
        if (this.indiceActual >= this.instrucciones.length) {
            return false;
        }

        const i = this.indiceActual;
        const inst = this.instrucciones[i];
        this.ultimaInstruccion = inst;

        if (inst.pid !== undefined && inst.type !== 'KILL') {
            let proc = this.listaProcesos.find(p => p.pid === inst.pid);
            if (!proc) {
                proc = new Process(inst.pid);
                this.listaProcesos.push(proc);
            }
        }

        switch (inst.type) {
            case 'NEW': {
                let proc = this.listaProcesos.find(p => p.pid === inst.pid);
                if (proc && proc.active === 1) {
                    let nuevoPuntero = new Puntero(inst.ptr_id, inst.size);
                    op_new(this.mmu, proc, nuevoPuntero, this.instrucciones, i, this.listaProcesos);
                }
                break;
            }
            case 'USE':
                op_use(this.mmu, this.listaProcesos, inst.ptr_id, this.instrucciones, i);
                break;

            case 'DELETE':
                this.mmu.tiempo_reloj += 1;
                op_delete(this.mmu, this.listaProcesos, inst.ptr_id);
                break;

            case 'KILL':
                this.mmu.tiempo_reloj += 1;
                op_kill(this.mmu, this.listaProcesos, inst.pid);
                break;
        }

        this.indiceActual++;
        return true;
    }

    getMetrics() {
        const activeProcesses = this.listaProcesos.filter(p => p.active === 1).length;
        const loadedPages = this.mmu.ram.filter(p => p.memoria_real === 1).length;
        const unloadedPages = this.mmu.disco.length;

        const ramKb = (loadedPages * PAGE_SIZE_BYTES) / 1024; // 4KB por pagina
        const ramPercent = Math.round((loadedPages / TOTAL_PAGINAS_RAM) * 100);

        const vramKb = (unloadedPages * PAGE_SIZE_BYTES) / 1024;
        // % de V-RAM respecto a los 400KB de RAM (ej. 500KB de V-RAM = 125%)
        const vramPercent = Math.round((vramKb / 400) * 100);

        const simTime = this.mmu.tiempo_reloj;
        const thrashingTime = this.mmu.tiempo_trashing;
        const thrashingPercent = simTime > 0 ? Math.round((thrashingTime / simTime) * 100) : 0;

        // Calcular fragmentación interna de todas las páginas actualmente en el sistema
        let fragmentacionBytes = 0;
        for (const pages of this.mmu.mapa_memoria.values()) {
            for (const page of pages) {
                fragmentacionBytes += page.desperdicio_bytes || 0;
            }
        }
        const fragmentacionKb = Number((fragmentacionBytes / 1024).toFixed(2));

        // Construir lista ordenada de todas las páginas activas en el sistema para la tabla MMU
        const allPages = [];
        for (const pages of this.mmu.mapa_memoria.values()) {
            for (const p of pages) {
                let mark = '';
                if (this.tipoAlgoritmo === 'SC' && p.memoria_real === 1) {
                    mark = String(p.reference_bit);
                } else if (this.tipoAlgoritmo === 'LFU' && p.memoria_real === 1) {
                    mark = String(p.contador_frecuencia);
                } else if (this.tipoAlgoritmo === 'LRU' && p.memoria_real === 1) {
                    mark = `${p.timestamp_last_use}s`;
                }

                allPages.push({
                    pageId: p.id_pag,
                    pid: p.pid,
                    loaded: p.memoria_real === 1,
                    lAddr: p.ptr_id,
                    mAddr: p.memoria_real === 1 ? p.direccion_fisica : '',
                    dAddr: p.memoria_real === 0 ? p.d_addr : '',
                    loadedT: p.memoria_real === 1 ? `${p.loaded_t}s` : '',
                    mark,
                });
            }
        }
        allPages.sort((a, b) => a.pageId - b.pageId);

        return {
            ram: this.mmu.ram.map((p, idx) => ({
                frameIndex: idx,
                occupied: p.memoria_real === 1,
                pageId: p.id_pag,
                pid: p.pid,
                ptrId: p.ptr_id,
            })),
            pages: allPages,
            processesCount: activeProcesses,
            totalProcessesSeen: this.listaProcesos.length,
            simTime,
            ramKb,
            ramPercent,
            vramKb,
            vramPercent,
            loadedPages,
            unloadedPages,
            thrashingTime,
            thrashingPercent,
            fragmentacionKb,
            fragmentacionBytes,
        };
    }
}

export function ejecutarSimulacion(instruccionesParsed, tipoAlgoritmo) {
    const sim = new SimuladorInstancia(instruccionesParsed, tipoAlgoritmo);
    while (sim.step()) {
        // Ejecuta todas las instrucciones
    }
    return { mmu: sim.mmu, listaProcesos: sim.listaProcesos, metrics: sim.getMetrics() };
}