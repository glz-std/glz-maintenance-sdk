import { type ConfigOpts } from './config.js';
type Nivel = 'error' | 'warning';
/**
 * Opcional pero recomendado en `instrumentation.ts` (register): fija la config y
 * registra la app en el tablero (aparece en estado OK aunque nunca falle).
 */
export declare function initServidor(opts?: ConfigOpts): Promise<void>;
/** Reporta una excepción de servidor. `contexto` se anexa al mensaje. Nunca lanza. */
export declare function reportarErrorServidor(err: unknown, ctx?: {
    nivel?: Nivel;
    contexto?: string;
}): Promise<void>;
/** Reporta un mensaje (no-excepción) de servidor. Nunca lanza. */
export declare function reportarMensajeServidor(mensaje: string, ctx?: {
    nivel?: Nivel;
}): Promise<void>;
/**
 * Hook nativo de Next para `instrumentation.ts`:
 *   export { onRequestError } from '@glz/maintenance/server'
 * Next lo invoca ante errores de petición en servidor (nodejs y edge).
 */
export declare function onRequestError(err: unknown, request?: {
    path?: string;
}): Promise<void>;
export {};
