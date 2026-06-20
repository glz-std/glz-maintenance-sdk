// Resolución de configuración del reporter: opciones explícitas > variables de
// entorno > default horneado. Así un proyecto nuevo reporta sin configurar nada
// (la URL del motor viene de fábrica; el nombre de la app, de una env).
//
// En el bundle de CLIENTE, Next solo inyecta en el navegador los **literales**
// `process.env.NEXT_PUBLIC_*`, no los accesos dinámicos. Por eso en el cliente se
// pasan `app` y `entorno` explícitos a initMaintenance; en SERVIDOR (Node/edge)
// todo se resuelve de entorno sin tocar nada.
export const ENDPOINT_POR_DEFECTO = 'https://maintenance.glzstudio.dev';
// Entornos que NO reportan por defecto: local y los TESTS (vitest/CI ponen NODE_ENV='test').
// Evita que el test suite ensucie el motor de producción con errores sintéticos.
const NO_REPORTAN = new Set(['development', 'test']);
function env(clave) {
    return typeof process !== 'undefined' && process.env ? process.env[clave] : undefined;
}
/**
 * Deriva el entorno sin configuración, sea cual sea el host. La forma fiable y
 * AGNÓSTICA es que el proyecto fije `GLZ_ENV` (servidor) / pase `entorno` (cliente);
 * esto es solo el autodetect de cortesía cuando no se ha fijado nada:
 *  1. Vercel (zero-config allí): production directo; si no, la RAMA de git distingue
 *     dev/preview (Vercel comparte VERCEL_ENV='preview' para ambos).
 *  2. Genérico (Docker, VPS, Railway, Render, Fly, local…): NODE_ENV.
 *  3. Sin pistas → 'development'.
 */
function derivarEntorno() {
    const vercelEnv = env('NEXT_PUBLIC_VERCEL_ENV') || env('VERCEL_ENV');
    if (vercelEnv === 'production')
        return 'production';
    if (vercelEnv) {
        const rama = env('NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF') || env('VERCEL_GIT_COMMIT_REF');
        return rama || vercelEnv;
    }
    const nodeEnv = env('NODE_ENV');
    if (nodeEnv === 'production')
        return 'production';
    if (nodeEnv)
        return nodeEnv;
    return 'development';
}
/** Resuelve la config final aplicando la cascada opciones > env > default. */
export function resolverConfig(opts) {
    const app = opts?.app || env('NEXT_PUBLIC_GLZ_APP') || env('GLZ_APP') || 'desconocida';
    const endpoint = opts?.endpoint ||
        env('NEXT_PUBLIC_GLZ_MAINT_URL') ||
        env('GLZ_MAINT_URL') ||
        ENDPOINT_POR_DEFECTO;
    const release = opts?.release || env('NEXT_PUBLIC_RELEASE') || env('GLZ_RELEASE') || undefined;
    const entorno = opts?.entorno || env('NEXT_PUBLIC_GLZ_ENV') || env('GLZ_ENV') || derivarEntorno();
    // Por defecto NO se reporta desde entornos no productivos (local y, sobre todo, TESTS:
    // un reporter jamás debe disparar POSTs reales al motor cuando corre el test suite/CI).
    const activo = opts?.soloEntornos
        ? opts.soloEntornos.includes(entorno)
        : !NO_REPORTAN.has(entorno) || opts?.reportarEnDesarrollo === true;
    return { app, endpoint, release, entorno, activo };
}
