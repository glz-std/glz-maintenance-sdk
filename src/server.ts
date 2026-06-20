// Reporter de errores de SERVIDOR (Node/edge) → GLZ Maintenance.
// No toca window/document: es el complemento del core de navegador. Pensado para
// `instrumentation.ts` (onRequestError) y para avisos manuales en server actions,
// rutas y librerías de servidor.
//
// AWAITABLE con timeout corto: en funciones serverless conviene `await` para que
// el POST salga antes de que la función se congele; el timeout evita que un motor
// LENTO (no caído) alargue la respuesta al usuario. Nunca lanza (best-effort).

import { resolverConfig, type ConfigOpts, type ConfigResuelta } from './config.js'

type Nivel = 'error' | 'warning'
const TIMEOUT_MS = 3000

let cfg: ConfigResuelta | null = null

/** Config perezosa: si nadie llamó a initServidor, se resuelve de env la 1ª vez. */
function conf(): ConfigResuelta {
  return (cfg ??= resolverConfig())
}

async function postar(ruta: string, cuerpo: Record<string, unknown>): Promise<void> {
  const controlador = new AbortController()
  const id = setTimeout(() => controlador.abort(), TIMEOUT_MS)
  try {
    await fetch(`${conf().endpoint}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: controlador.signal,
    })
  } catch {
    /* best-effort: timeout, red caída o motor lento no rompen el flujo de negocio */
  } finally {
    clearTimeout(id)
  }
}

/**
 * Opcional pero recomendado en `instrumentation.ts` (register): fija la config y
 * registra la app en el tablero (aparece en estado OK aunque nunca falle).
 */
export async function initServidor(opts?: ConfigOpts): Promise<void> {
  cfg = resolverConfig(opts)
  await postar('/api/registro', { app: cfg.app, release: cfg.release })
}

/** Reporta una excepción de servidor. `contexto` se anexa al mensaje. Nunca lanza. */
export async function reportarErrorServidor(
  err: unknown,
  ctx?: { nivel?: Nivel; contexto?: string },
): Promise<void> {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : seguro(err))
  const mensaje = ctx?.contexto ? `${e.message} · ${ctx.contexto}` : e.message
  if (!mensaje) return
  const c = conf()
  await postar('/api/error', {
    app: c.app,
    mensaje,
    nivel: ctx?.nivel ?? 'error',
    ...(e.stack ? { stack: e.stack } : {}),
    ...(c.release ? { release: c.release } : {}),
  })
}

/** Reporta un mensaje (no-excepción) de servidor. Nunca lanza. */
export async function reportarMensajeServidor(
  mensaje: string,
  ctx?: { nivel?: Nivel },
): Promise<void> {
  if (!mensaje) return
  const c = conf()
  await postar('/api/error', {
    app: c.app,
    mensaje,
    nivel: ctx?.nivel ?? 'error',
    ...(c.release ? { release: c.release } : {}),
  })
}

/**
 * Hook nativo de Next para `instrumentation.ts`:
 *   export { onRequestError } from '@glz/maintenance/server'
 * Next lo invoca ante errores de petición en servidor (nodejs y edge).
 */
export async function onRequestError(err: unknown, request?: { path?: string }): Promise<void> {
  await reportarErrorServidor(err, request?.path ? { contexto: request.path } : undefined)
}

function seguro(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
