import { MMU } from '../models/mmu.js';
import { Process } from '../models/process.js';
import { Puntero } from '../models/puntero.js'; // O donde tengas tu clase Puntero
import { op_new, op_use, op_delete, op_kill } from './operations.js';

export function ejecutarSimulacion(instruccionesParsed, tipoAlgoritmo) {
    let mmu = new MMU(tipoAlgoritmo);
    let listaProcesos = [];

    for (let i = 0; i < instruccionesParsed.length; i++) {
        let inst = instruccionesParsed.get ? instruccionesParsed[i] : instruccionesParsed[i];
        
        if (inst.pid !== undefined && inst.type !== 'KILL') {
            let proc = listaProcesos.find(p => p.pid === inst.pid);
            if (!proc) {
                proc = new Process(inst.pid);
                listaProcesos.push(proc);
            }
        }

        switch (inst.type) {
            case 'NEW': {
                let proc = listaProcesos.find(p => p.pid === inst.pid);
                let nuevoPuntero = new Puntero(inst.ptr_id, inst.size);
                op_new(mmu, proc, nuevoPuntero, instruccionesParsed, i, listaProcesos);
                break;
            }
            case 'USE':
                op_use(mmu, listaProcesos, inst.ptr_id, instruccionesParsed, i);
                break;

            case 'DELETE':
                mmu.tiempo_reloj++; // Avanza el reloj global de la simulación
                op_delete(mmu, listaProcesos, inst.ptr_id);
                break;

            case 'KILL':
                mmu.tiempo_reloj++; // Avanza el reloj global de la simulación
                op_kill(mmu, listaProcesos, inst.pid);
                break;
        }
    }

    return { mmu, listaProcesos };
}