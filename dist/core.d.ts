import { type ConfigOpts } from './config.js';
export interface InitOpts extends ConfigOpts {
    /** Nivel por defecto de los errores no clasificados. */
    nivelPorDefecto?: 'error' | 'warning';
}
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
