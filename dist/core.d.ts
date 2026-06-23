import { type ConfigOpts } from './config.js';
export interface InitOpts extends ConfigOpts {
    /** Nivel por defecto de los errores no clasificados. */
    nivelPorDefecto?: 'error' | 'warning';
    /**
     * Patrones extra para clasificar un rechazo no manejado como RUIDO (no se reporta).
     * Se prueban contra el mensaje y el stack del `reason`. ADITIVOS al filtro base
     * de SW/extensiones: amplían, no sustituyen. Solo aplican en `unhandledrejection`.
     * Ej: `patronesRuido: [/ResizeObserver loop/, /Non-Error promise rejection/]`.
     */
    patronesRuido?: RegExp[];
    /**
     * Gancho para clasificar un rechazo no manejado como RUIDO (no se reporta).
     * Devuelve `true` para descartar. ADITIVO al filtro base de SW/extensiones (si
     * cualquiera marca ruido, se descarta). Fail-soft: si lanza, se ignora y se sigue
     * con el filtro base. Solo aplica en `unhandledrejection`.
     * Ej: `filtroRuido: (r) => r instanceof Error && /Load failed/.test(r.message)`.
     */
    filtroRuido?: (reason: unknown) => boolean;
}
/** Opciones del clasificador de ruido, extensibles por proyecto sin tocar el SDK. */
export interface OpcionesRuido {
    patronesRuido?: RegExp[];
    filtroRuido?: (reason: unknown) => boolean;
}
/**
 * ¿Es este rechazo RUIDO de registro de SW o de una extensión del navegador?
 * Decide por el ORIGEN DEL STACK, nunca por palabras sueltas. Función PURA y a
 * prueba de fallos: ante cualquier excepción devuelve `false` (fail-soft: preferimos
 * reportar de más antes que tragarnos un error real).
 *
 * REGLA DE ORO del filtro base: si el stack contiene AL MENOS UN frame del bundle
 * propio (`/_next/`, `/assets/`, `/chunks/`, o el origin de la app), NO se filtra.
 *
 * Los ganchos `patronesRuido`/`filtroRuido` son ADITIVOS y NO respetan la regla de
 * oro (el proyecto sabe lo que descarta): si cualquiera marca ruido, devuelve `true`.
 */
export declare function esRuidoSW(reason: unknown, opts?: OpcionesRuido): boolean;
/**
 * Migaja de pan: un evento previo a un error (estilo Sentry). Forma CONGELADA,
 * idéntica a la del motor y la del tablero. No cambiar.
 */
export interface Breadcrumb {
    tipo: 'click' | 'nav' | 'console' | 'fetch';
    mensaje: string;
    ts: number;
    nivel?: 'info' | 'warning' | 'error';
}
/** Arranca el reporter: engancha window.error y unhandledrejection.
 *  Sin argumentos toma la config del entorno (NEXT_PUBLIC_GLZ_APP + endpoint horneado). */
export declare function initMaintenance(opts?: InitOpts): void;
/** Reporta un error manualmente. Fire-and-forget: nunca lanza ni bloquea la app. */
export declare function reportarError(err: unknown, ctx?: {
    url?: string;
    nivel?: 'error' | 'warning';
}): void;
