export declare const ENDPOINT_POR_DEFECTO = "https://maintenance.glzstudio.dev";
export interface ConfigResuelta {
    /** Nombre/slug de la app que identifica el origen en GLZ Maintenance. */
    app: string;
    /** Base del motor (sin barra final), p.ej. 'https://maintenance.glzstudio.dev'. */
    endpoint: string;
    /** Release/SHA del deploy, para des-minificar stacks con los source maps. */
    release?: string;
    /** Entorno del que sale el reporte (p.ej. 'production', 'preview', 'dev'). */
    entorno: string;
    /** ¿Este entorno debe reportar? (false en local salvo override). */
    activo: boolean;
}
/** Opciones que cualquier punto de entrada (cliente o servidor) puede sobreescribir. */
export interface ConfigOpts {
    app?: string;
    endpoint?: string;
    release?: string;
    /** Etiqueta del entorno. En cliente conviene pasarla explícita (Next no inyecta accesos dinámicos). */
    entorno?: string;
    /** Allowlist: si se define, SOLO reportan los entornos de la lista (ignora el default). */
    soloEntornos?: string[];
    /** Por defecto NO se reporta desde 'development' (local). Ponlo a true para reportar también ahí. */
    reportarEnDesarrollo?: boolean;
}
/** Resuelve la config final aplicando la cascada opciones > env > default. */
export declare function resolverConfig(opts?: ConfigOpts): ConfigResuelta;
