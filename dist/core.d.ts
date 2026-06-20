export interface InitOpts {
    /** Slug/nombre de la app, p.ej. 'MANDO', 'DXB'. Si se omite, se lee de NEXT_PUBLIC_GLZ_APP. */
    app?: string;
    /** Base del motor. Si se omite, NEXT_PUBLIC_GLZ_MAINT_URL o el default horneado. */
    endpoint?: string;
    /** Nivel por defecto de los errores no clasificados. */
    nivelPorDefecto?: 'error' | 'warning';
    /**
     * Identificador del release/versión desplegada (p.ej. el SHA del commit o 'v1.2.3').
     * Si se define, viaja en el payload del error para que el motor pueda des-minificar
     * el stack con los source maps subidos para ese (app, release).
     */
    release?: string;
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
