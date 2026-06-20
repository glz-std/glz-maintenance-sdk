export declare const ENDPOINT_POR_DEFECTO = "https://maintenance.glzstudio.dev";
export interface ConfigResuelta {
    /** Nombre/slug de la app que identifica el origen en GLZ Maintenance. */
    app: string;
    /** Base del motor (sin barra final), p.ej. 'https://maintenance.glzstudio.dev'. */
    endpoint: string;
    /** Release/SHA del deploy, para des-minificar stacks con los source maps. */
    release?: string;
}
/** Opciones que cualquier punto de entrada (cliente o servidor) puede sobreescribir. */
export interface ConfigOpts {
    app?: string;
    endpoint?: string;
    release?: string;
}
/** Resuelve la config final aplicando la cascada opciones > env > default. */
export declare function resolverConfig(opts?: ConfigOpts): ConfigResuelta;
