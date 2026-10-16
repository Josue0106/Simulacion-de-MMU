export function to_removeOpt(mmu, instr, indiceAct, processList) {
    let index_to_be_removed = 0;
    let greater_d = -1;

    for (let i = 0; i < mmu.ram.length; i++) {
        let page_in_ram = mmu.ram[i];
        if (page_in_ram.memoria_real === 0) return i;
        let distance = distanceNext(page_in_ram, instr, indiceAct, processList);

        if (distance === -1) {
            return i;
        }

        if (distance > greater_d) {
            greater_d = distance;
            index_to_be_removed = i;
        }
    }

    return index_to_be_removed;
}

function distanceNext(page, instr, indiceAct, processList) {
    for (let k = indiceAct + 1; k < instr.length; k++) {
        let instruction = instr[k];

        if (instruction.type === 'KILL' && instruction.pid === page.pid) {
            // Si el proceso va a morir sin usar la pagina antes, ya no se volvera a usar en use()
            return -1;
        }

        if (instruction.type === 'DELETE' && instruction.ptr_id === page.ptr_id) {
            // Si el puntero se borra antes de usarse, tampoco requiere traerse a RAM
            return -1;
        }

        if (instruction.type === 'USE') {
            if (instruction.ptr_id === page.ptr_id) {
                return k - indiceAct;
            }
            if (processList) {
                let proc = processList.find(p => p.pid === page.pid);
                if (proc) {
                    let ptr_look = proc.ptr_table.find(ptr => ptr.ptr_id === instruction.ptr_id);
                    if (ptr_look && ptr_look.pag_asoc.includes(page.id_pag)) {
                        return k - indiceAct;
                    }
                }
            }
        }
    }
    return -1;
}