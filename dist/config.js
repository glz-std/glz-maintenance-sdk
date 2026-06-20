// Resolución de configuración del reporter: opciones explícitas > variables de
// entorno > default horneado. Así un proyecto nuevo reporta sin configurar nada
// (la URL del motor viene de fábrica; el nombre de la app, de una env).
//
// En el bundle de CLIENTE, Next solo inyecta las variables NEXT_PUBLIC_*; en
// SERVIDOR (Node/edge) están todas. Por eso miramos ambas, NEXT_PUBLIC_* primero.
export const ENDPOINT_POR_DEFECTO = 'https://maintenance.glzstudio.dev';
function env(clave) {
    return typeof process !== 'undefined' && process.env ? process.env[clave] : undefined;
}
/** Resuelve la config final aplicando la cascada opciones > env > default. */
export function resolverConfig(opts) {
    const app = opts?.app || env('NEXT_PUBLIC_GLZ_APP') || env('GLZ_APP') || 'desconocida';
    const endpoint = opts?.endpoint ||
        env('NEXT_PUBLIC_GLZ_MAINT_URL') ||
        env('GLZ_MAINT_URL') ||
        ENDPOINT_POR_DEFECTO;
    const release = opts?.release || env('NEXT_PUBLIC_RELEASE') || env('GLZ_RELEASE') || undefined;
    return { app, endpoint, release };
}
