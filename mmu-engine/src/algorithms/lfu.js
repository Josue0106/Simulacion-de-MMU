export function to_removelfu(mmu){
    let index_to_be_removed = 0;
    let menor_uso = Infinity;
    
    for(let i = 0; i<mmu.ram.length; i++){
        let page_in_ram = mmu.ram[i];
        if(page_in_ram.memoria_real == 0) {
            return i;
        }
        
        //El menor uso se va
        if(page_in_ram.contador_frecuencia < menor_uso){
            menor_uso = page_in_ram.contador_frecuencia;
            index_to_be_removed = i;
        }
    }
    

    return index_to_be_removed;
}