/** Una comprobación: devuelve true si esa dependencia está sana. */
export type Comprobacion = () => Promise<boolean> | boolean;
export interface OpcionesSalud {
    /** Comprobaciones por nombre. Ej: { supabase: ..., env: ... }. Vacío = solo "vivo". */
    checks?: Record<string, Comprobacion>;
    /** SHA/versión del despliegue (ej. process.env.VERCEL_GIT_COMMIT_SHA). */
    release?: string;
    /** Timeout por comprobación (ms). Una que cuelga cuenta como fallo, no cuelga el endpoint. */
    timeoutMs?: number;
}
export interface ResultadoSalud {
    ok: boolean;
    release: string | null;
    checks: Record<string, boolean>;
    ts: number;
}
/** Ejecuta las comprobaciones (en paralelo, con timeout) y resume la salud. Nunca lanza. */
export declare function evaluarSalud(opts?: OpcionesSalud): Promise<ResultadoSalud>;
/**
 * Devuelve una Response lista para un route handler: 200 si sana, 503 si alguna comprobación
 * falla (la sonda de uptime de GLZ Maintenance trata el 503 como caído). Sin caché.
 */
export declare function respuestaSalud(opts?: OpcionesSalud): Promise<Response>;
