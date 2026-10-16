/**
 * Generador de números pseudoaleatorios determinista (Mulberry32)
 * Permite repetir un escenario exactamente igual con la misma semilla.
 */
export function createPRNG(seedInput) {
    let seed = 0;
    const str = String(seedInput ?? '12345').trim() || '12345';
    for (let i = 0; i < str.length; i++) {
        seed = (Math.imul(31, seed) + str.charCodeAt(i)) | 0;
    }
    let state = seed >>> 0;
    if (state === 0) state = 0xdeadbeef;

    return function random() {
        let t = (state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Genera una lista de N operaciones para P procesos respetando las reglas:
 * - Cada proceso puede tener una cantidad cualquiera de operaciones, suma total <= N (exactamente N)
 * - new(pid, size) en cualquier momento antes de kill(pid)
 * - use(ptr) solo si existe al menos un ptr activo en la tabla de símbolos
 * - delete(ptr) solo si existe al menos un ptr activo en la tabla de símbolos
 * - kill(pid) se usa únicamente una vez y debe ser la última operación del proceso
 * - Las operaciones de distintos procesos pueden intercalarse libremente
 */
export function generarOperaciones(seed, P = 10, N = 500) {
    const rand = createPRNG(seed);
    const numProcesses = Number(P) || 10;
    const totalOps = Number(N) || 500;

    // Estado por proceso
    const processes = [];
    for (let pid = 1; pid <= numProcesses; pid++) {
        processes.push({
            pid,
            active: true,
            hasStarted: false,
            ptrs: [], // IDs de punteros activos
        });
    }

    let nextPtrId = 1;
    const operations = [];

    // Reservamos los últimos `aliveCount` pasos para los kill(pid) obligatorios si quedan pocos pasos
    for (let step = 0; step < totalOps; step++) {
        const remainingSteps = totalOps - step;
        const aliveProcesses = processes.filter(p => p.active);

        if (aliveProcesses.length === 0) {
            break;
        }

        // Si quedan exactamente tantos pasos como procesos vivos, debemos hacer kill a los restantes
        if (remainingSteps <= aliveProcesses.length) {
            // Elegir un proceso vivo al azar para matarlo (si nunca hizo nada y solo queda este paso, igual recibe kill)
            const idx = Math.floor(rand() * aliveProcesses.length);
            const proc = aliveProcesses[idx];
            operations.push(`kill(${proc.pid})`);
            proc.active = false;
            proc.ptrs = [];
            continue;
        }

        // Asegurar que todos los procesos tengan al menos un new antes de terminar
        const unstartedProcesses = aliveProcesses.filter(p => !p.hasStarted);
        if (remainingSteps <= aliveProcesses.length + unstartedProcesses.length && unstartedProcesses.length > 0) {
            const proc = unstartedProcesses[Math.floor(rand() * unstartedProcesses.length)];
            const size = generarTamanoMemoria(rand);
            operations.push(`new(${proc.pid},${size})`);
            proc.ptrs.push(nextPtrId++);
            proc.hasStarted = true;
            continue;
        }

        // Seleccionar un proceso vivo al azar
        const proc = aliveProcesses[Math.floor(rand() * aliveProcesses.length)];

        // Si el proceso aún no tiene punteros activos, la única operación constructiva es new
        if (proc.ptrs.length === 0) {
            const size = generarTamanoMemoria(rand);
            operations.push(`new(${proc.pid},${size})`);
            proc.ptrs.push(nextPtrId++);
            proc.hasStarted = true;
            continue;
        }

        // Decidir tipo de operación con pesos realistas:
        // use (~55%), new (~30%), delete (~12%), kill (~3% solo si ya avanzó la simulación y hay más de 1 vivo)
        const r = rand();
        const progress = step / totalOps;
        const canKill = aliveProcesses.length > 1 && progress > 0.35 && rand() < 0.04;

        if (canKill) {
            operations.push(`kill(${proc.pid})`);
            proc.active = false;
            proc.ptrs = [];
        } else if (r < 0.30) {
            const size = generarTamanoMemoria(rand);
            operations.push(`new(${proc.pid},${size})`);
            proc.ptrs.push(nextPtrId++);
            proc.hasStarted = true;
        } else if (r < 0.86) {
            // use(ptr): elegir un puntero activo (del proceso o globalmente válido)
            const ptrId = proc.ptrs[Math.floor(rand() * proc.ptrs.length)];
            operations.push(`use(${ptrId})`);
        } else {
            // delete(ptr)
            const ptrIdx = Math.floor(rand() * proc.ptrs.length);
            const ptrId = proc.ptrs[ptrIdx];
            operations.push(`delete(${ptrId})`);
            proc.ptrs.splice(ptrIdx, 1);
        }
    }

    return operations.join('\n');
}

function generarTamanoMemoria(rand) {
    // Genera tamaños variados desde 100B hasta ~24KB (1 a 6 páginas de 4096B)
    // para provocar tanto fragmentación interna como paginación múltiple
    const bucket = rand();
    if (bucket < 0.45) {
        // 1 página (100B a 4096B)
        return Math.floor(rand() * 3996) + 100;
    } else if (bucket < 0.80) {
        // 2 a 3 páginas (4097B a 12288B)
        return Math.floor(rand() * 8192) + 4097;
    } else {
        // 4 a 6 páginas (12289B a 24576B)
        return Math.floor(rand() * 12288) + 12289;
    }
}

