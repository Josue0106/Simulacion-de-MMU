export function parsearInstrucciones(contenidoTexto) {
    let lineas = contenidoTexto.split(/\r?\n/);
    let instrucciones = [];
    let contadorPunterosGlobal = 1;

    for (let i = 0; i < lineas.length; i++) {
        let linea = lineas[i].trim();

        // Quitar comentarios inline si existen (ej: new(1, 250) // comentario)
        const commentIdx = linea.indexOf('//');
        if (commentIdx !== -1) {
            linea = linea.slice(0, commentIdx).trim();
        }

        // Ignorar líneas vacías o comentarios
        if (!linea || linea.startsWith('#') || linea.startsWith('//')) {
            continue;
        }

        try {
            let partes = linea.split('(');
            if (partes.length < 2) continue;

            let tipo = partes[0].trim().toUpperCase();
            let interior = partes[1].split(')')[0].trim();

            let args = interior ? interior.split(',').map(n => parseInt(n.trim(), 10)) : [];

            let instruccion = { type: tipo, raw: linea };

            switch (tipo) {
                case 'NEW':
                    // args[0] es el PID, args[1] es el tamaño en bytes
                    if (isNaN(args[0]) || isNaN(args[1])) continue;
                    instruccion.pid = args[0];
                    instruccion.size = args[1];
                    instruccion.ptr_id = contadorPunterosGlobal++;
                    break;
                case 'USE':
                case 'DELETE':
                    if (isNaN(args[0])) continue;
                    instruccion.ptr_id = args[0];
                    break;
                case 'KILL':
                    if (isNaN(args[0])) continue;
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