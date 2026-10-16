export function to_removeSC(mmu){
    while(true){
        let index_to_be_removed = 0;
        let menorLlegada = Infinity;
        
        for(let i = 0; i<mmu.ram.length; i++){
            let page_in_ram = mmu.ram[i];
            if(page_in_ram.memoria_real == 0) {
                return i;
            }
            
            //El menor tiempo de llegada es el candidato
            if(page_in_ram.tiempo_llegada < menorLlegada){
                menorLlegada = page_in_ram.tiempo_llegada;
                index_to_be_removed = i;
            }
        }

        let candidate = mmu.ram[index_to_be_removed];

        if(candidate.reference_bit === 0){
            return index_to_be_removed;
        }else{
            //Le damos una oportunidad y le damos el ultimo lugar en la cola
            candidate.reference_bit = 0;
            candidate.tiempo_llegada = mmu.contadorLlegadaGlobal++;
        }
    }
}