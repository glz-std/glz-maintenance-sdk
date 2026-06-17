export interface InitOpts {
    /** Slug/nombre de la app, p.ej. 'MANDO', 'DXB'. Identifica el origen en GLZ Maintenance. */
    app: string;
    /** Base del motor, p.ej. 'https://maintenance.glzstudio.dev'. */
    endpoint: string;
    /** Nivel por defecto de los errores no clasificados. */
    nivelPorDefecto?: 'error' | 'warning';
}
/** Arranca el reporter: engancha window.error y unhandledrejection. */
export declare function initMaintenance(opts: InitOpts): void;
/** Reporta un error manualmente. Fire-and-forget: nunca lanza ni bloquea la app. */
export declare function reportarError(err: unknown, ctx?: {
    url?: string;
    nivel?: 'error' | 'warning';
}): void;
