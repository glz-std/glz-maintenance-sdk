// Resolución de configuración del reporter: opciones explícitas > variables de
// entorno > default horneado. Así un proyecto nuevo reporta sin configurar nada
// (la URL del motor viene de fábrica; el nombre de la app, de una env).
//
// En el bundle de CLIENTE, Next solo inyecta las variables NEXT_PUBLIC_*; en
// SERVIDOR (Node/edge) están todas. Por eso miramos ambas, NEXT_PUBLIC_* primero.

export const ENDPOINT_POR_DEFECTO = 'https://maintenance.glzstudio.dev'

function env(clave: string): string | undefined {
  return typeof process !== 'undefined' && process.env ? process.env[clave] : undefined
}

export interface ConfigResuelta {
  /** Nombre/slug de la app que identifica el origen en GLZ Maintenance. */
  app: string
  /** Base del motor (sin barra final), p.ej. 'https://maintenance.glzstudio.dev'. */
  endpoint: string
  /** Release/SHA del deploy, para des-minificar stacks con los source maps. */
  release?: string
}

/** Opciones que cualquier punto de entrada (cliente o servidor) puede sobreescribir. */
export interface ConfigOpts {
  app?: string
  endpoint?: string
  release?: string
}

/** Resuelve la config final aplicando la cascada opciones > env > default. */
export function resolverConfig(opts?: ConfigOpts): ConfigResuelta {
  const app = opts?.app || env('NEXT_PUBLIC_GLZ_APP') || env('GLZ_APP') || 'desconocida'
  const endpoint =
    opts?.endpoint ||
    env('NEXT_PUBLIC_GLZ_MAINT_URL') ||
    env('GLZ_MAINT_URL') ||
    ENDPOINT_POR_DEFECTO
  const release = opts?.release || env('NEXT_PUBLIC_RELEASE') || env('GLZ_RELEASE') || undefined
  return { app, endpoint, release }
}
