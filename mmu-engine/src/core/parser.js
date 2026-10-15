export function parsearInstrucciones(contenidoTexto) {
    let lineas = contenidoTexto.split('\n');
    let instrucciones = [];
    let contadorPunterosGlobal = 1; 

    for (let i = 0; i < lineas.length; i++) {
        let linea = lineas[i].trim();

        // Ignorar líneas vacías o comentarios
        if (!linea || linea.startsWith('#') || linea.startsWith('//')) {
            continue;
        }

        try {
            
            let partes = linea.split('(');
            let tipo = partes[0].trim().toUpperCase();

            let interior = partes[1].replace(')', '').trim();

            let args = interior ? interior.split(',').map(n => parseInt(n.trim())) : [];

            let instruccion = { type: tipo, raw: linea };

            switch (tipo) {
                case 'NEW':
                    // args[0] es el PID, args[1] es el tamaño en bytes
                    instruccion.pid = args[0];
                    instruccion.size = args[1];
                    instruccion.ptr_id = contadorPunterosGlobal++; 
                    break;
                case 'USE':
                case 'DELETE':
                    instruccion.ptr_id = args[0];
                    break;
                case 'KILL':
                    instruccion.pid = args[0];
                    break;

                default:
                    console.warn(`Operación desconocida: ${tipo}`);
                    continue;
            }

            instrucciones.push(instruccion);
        } catch (error) {
            console.warn(`Error al parsear la línea: "${linea}"`, error);
        }
    }

    return instrucciones;
}