export function to_removefifo(mmu){
    let index_to_be_removed = 0;
    let menorLlegada = Infinity;
    
    for(let i = 0; i<mmu.ram.length; i++){
        let page_in_ram = mmu.ram[i];
        if(page_in_ram.memoria_real == 0) {
            return i;
        }
        
        //El menor tiempo de llegada, osea el mas antiguo se va.
        if(page_in_ram.tiempo_llegada < menorLlegada){
            menorLlegada = page_in_ram.tiempo_llegada;
            index_to_be_removed = i;
        }
    }


    return index_to_be_removed;
}