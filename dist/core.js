// Núcleo del reporter: engancha errores globales y los manda a GLZ Maintenance.
// Sin dependencias. Fire-and-forget: nunca lanza ni bloquea la app que lo usa.
let opciones = null;
const ultimoEnvio = new Map();
const DEDUP_MS = 10_000; // no repetir el mismo mensaje en esta ventana (anti-tormenta)
/** Arranca el reporter: engancha window.error y unhandledrejection. */
export function initMaintenance(opts) {
    opciones = opts;
    if (typeof window === 'undefined')
        return;
    window.addEventListener('error', (e) => {
        reportarError(e.error ?? e.message, { url: urlActual() });
    });
    window.addEventListener('unhandledrejection', (e) => {
        reportarError(e.reason, { url: urlActual() });
    });
    // Registro al conectar: la app aparece en el tablero (estado ok) aunque no falle.
    try {
        void fetch(`${opts.endpoint}/api/registro`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ app: opts.app }),
            keepalive: true,
        }).catch(() => {
            /* best-effort */
        });
    }
    catch {
        /* nunca romper la app que nos usa */
    }
}
/** Reporta un error manualmente. Fire-and-forget: nunca lanza ni bloquea la app. */
export function reportarError(err, ctx) {
    if (!opciones)
        return;
    const mensaje = mensajeDe(err);
    if (mensaje === '')
        return;
    const ahora = Date.now();
    if (ahora - (ultimoEnvio.get(mensaje) ?? 0) < DEDUP_MS)
        return;
    ultimoEnvio.set(mensaje, ahora);
    const payload = {
        app: opciones.app,
        mensaje,
        nivel: ctx?.nivel ?? opciones.nivelPorDefecto ?? 'error',
        stack: stackDe(err),
        url: ctx?.url ?? urlActual(),
    };
    try {
        void fetch(`${opciones.endpoint}/api/error`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(() => {
            /* entrega best-effort: ignorar fallos de red */
        });
    }
    catch {
        /* jamás romper la app que nos usa por culpa del reporte */
    }
}
function urlActual() {
    return typeof location !== 'undefined' ? location.href : undefined;
}
function mensajeDe(err) {
    if (err instanceof Error)
        return err.message;
    if (typeof err === 'string')
        return err;
    try {
        return JSON.stringify(err);
    }
    catch {
        return String(err);
    }
}
function stackDe(err) {
    return err instanceof Error && err.stack ? err.stack : undefined;
}
