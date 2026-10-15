export function to_removelru(mmu){
    let index_to_be_removed = 0;
    let menor_time = Infinity;
    
    for(let i = 0; i<mmu.ram.length; i++){
        let page_in_ram = mmu.ram[i];
        if(page_in_ram.memoria_real == 0) {
            return i;
        }
        
        //El menor timestampt se va
        if(page_in_ram.timestamp_last_use < menor_time){
            menor_time = page_in_ram.timestamp_last_use;
            index_to_be_removed = i;
        }
    }
    

    return index_to_be_removed;
}