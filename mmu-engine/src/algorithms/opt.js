export function to_removeOpt(mmu, instr, indiceAct){
    let index_to_be_removed = 0;
    let greater_d = -1;

    for (let i = 0; i < mmu.ram.length; i++) {
        let page_in_ram = mmu.ram[i];
        if(page_in_ram.memoria_real === 0) return i;
        let distance = distanceNext(page_in_ram, instr, indiceAct);

        if( distance === -1){
            return i;
        }

        if(distance > greater_d){
            greater_d = distance;
            index_to_be_removed = i;
        }
    }

    return index_to_be_removed;
}

function distanceNext(page, instr, indiceAct, processList){
    for (let k = indiceAct + 1; k < instr.length; k++){
        let instruction = instr[k];

        if(instruction.type === 'KILL' && inst.pid === page.pid){
            return k - indiceAct;
        }

        if(instruction.type === 'USE' || instruction.type === 'DELETE'){
            let ptrOwnerId = inst.pid;
            
            let proc = processList.find(p => p.id === page.pid);
            if (!proc) continue;

            let ptr_look = proc.ptr_table.find(ptr=>ptr.ptr_id == ptrOwnedId);

            if(ptr_look) {
                if(ptr_look.pag_asoc.includes(page.id_pag)){
                    return k - indiceAct;
                }
            }
        }

    }
    return -1;
}