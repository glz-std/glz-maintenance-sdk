// Núcleo del reporter: engancha errores globales y los manda a GLZ Maintenance.
// Sin dependencias. Fire-and-forget: nunca lanza ni bloquea la app que lo usa.

import { resolverConfig, type ConfigOpts } from './config.js'

// Hereda app/endpoint/release/entorno/soloEntornos/reportarEnDesarrollo de ConfigOpts.
// En CLIENTE conviene pasar `app` y `entorno` explícitos (Next no inyecta accesos
// dinámicos a process.env en el bundle del navegador).
export interface InitOpts extends ConfigOpts {
  /** Nivel por defecto de los errores no clasificados. */
  nivelPorDefecto?: 'error' | 'warning'
  /**
   * Patrones extra para clasificar un rechazo no manejado como RUIDO (no se reporta).
   * Se prueban contra el mensaje y el stack del `reason`. ADITIVOS al filtro base
   * de SW/extensiones: amplían, no sustituyen. Solo aplican en `unhandledrejection`.
   * Ej: `patronesRuido: [/ResizeObserver loop/, /Non-Error promise rejection/]`.
   */
  patronesRuido?: RegExp[]
  /**
   * Gancho para clasificar un rechazo no manejado como RUIDO (no se reporta).
   * Devuelve `true` para descartar. ADITIVO al filtro base de SW/extensiones (si
   * cualquiera marca ruido, se descarta). Fail-soft: si lanza, se ignora y se sigue
   * con el filtro base. Solo aplica en `unhandledrejection`.
   * Ej: `filtroRuido: (r) => r instanceof Error && /Load failed/.test(r.message)`.
   */
  filtroRuido?: (reason: unknown) => boolean
}

/** Opciones del clasificador de ruido, extensibles por proyecto sin tocar el SDK. */
export interface OpcionesRuido {
  patronesRuido?: RegExp[]
  filtroRuido?: (reason: unknown) => boolean
}

// Frames cuyo ORIGEN es registro de service worker. Detectamos por el origen del
// frame, no por palabras sueltas del mensaje (un bug real puede decir "service worker").
const RE_FRAME_SW =
  /(?:registerSW\.js|serviceWorker\.register|navigator\.serviceWorker|ServiceWorkerRegistration)/i
// Frames cuyo ORIGEN es una extensión del navegador (esquemas propios de extensión).
const RE_FRAME_EXTENSION = /(?:chrome-extension|moz-extension|safari-web-extension):\/\//i
// Marcadores de que un frame pertenece al BUNDLE PROPIO de la app (regla de oro:
// si el stack toca esto, NO se filtra — no nos tragamos bugs reales, incl. los del SW de la app).
const RE_FRAME_PROPIO = /(?:\/_next\/|\/assets\/|\/chunks\/)/i

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
export function esRuidoSW(reason: unknown, opts?: OpcionesRuido): boolean {
  try {
    // 1) Ganchos custom del proyecto (aditivos). Cada uno fail-soft por separado.
    if (opts?.filtroRuido) {
      try {
        if (opts.filtroRuido(reason) === true) return true
      } catch {
        /* gancho roto: ignorar y seguir con el filtro base */
      }
    }
    if (opts?.patronesRuido && opts.patronesRuido.length > 0) {
      const texto = textoParaPatron(reason)
      for (const re of opts.patronesRuido) {
        try {
          if (re.test(texto)) return true
        } catch {
          /* regexp problemática: ignorar */
        }
      }
    }

    // 2) Filtro base por origen del stack.
    const stack = stackDe(reason)
    if (!stack) return false // sin stack no podemos demostrar que sea ruido

    const lineas = stack
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    let frameSenal = false // ¿hay algún frame de SW o extensión?
    for (const linea of lineas) {
      // Regla de oro: un frame del bundle propio anula el filtrado de inmediato.
      if (RE_FRAME_PROPIO.test(linea)) return false
      if (RE_FRAME_SW.test(linea) || RE_FRAME_EXTENSION.test(linea)) {
        frameSenal = true
      }
    }
    return frameSenal
  } catch {
    return false // fail-soft total: ante la duda, reportar (no tragar)
  }
}

/** Texto (mensaje + stack) sobre el que prueban los patronesRuido custom. */
function textoParaPatron(reason: unknown): string {
  try {
    const msg = mensajeDe(reason)
    const stack = stackDe(reason) ?? ''
    return stack ? msg + '\n' + stack : msg
  } catch {
    return ''
  }
}

/**
 * Migaja de pan: un evento previo a un error (estilo Sentry). Forma CONGELADA,
 * idéntica a la del motor y la del tablero. No cambiar.
 */
export interface Breadcrumb {
  tipo: 'click' | 'nav' | 'console' | 'fetch'
  mensaje: string
  ts: number
  nivel?: 'info' | 'warning' | 'error'
}

/** Config ya resuelta (opciones > env > default): app y endpoint son siempre strings. */
interface OpcionesResueltas {
  app: string
  endpoint: string
  nivelPorDefecto?: 'error' | 'warning'
  release?: string
  entorno: string
  activo: boolean
  /** Ganchos del clasificador de ruido (solo se usan en unhandledrejection). */
  patronesRuido?: RegExp[]
  filtroRuido?: (reason: unknown) => boolean
}
let opciones: OpcionesResueltas | null = null
const ultimoEnvio = new Map<string, number>()
const DEDUP_MS = 10_000 // no repetir el mismo mensaje en esta ventana (anti-tormenta)

// Ring-buffer de migajas: rastro de los últimos eventos antes de un error.
const BREADCRUMBS_MAX = 20 // cap defensivo: solo las últimas N
const BREADCRUMB_MSG_MAX = 200 // cap defensivo: mensaje recortado a ~200 chars
const migajas: Breadcrumb[] = []
let enganchesPuestos = false // evita doble parcheo si se llama initMaintenance dos veces

/** Recorta a ~200 chars de forma segura (nunca lanza). */
function recorta(texto: string): string {
  return texto.length > BREADCRUMB_MSG_MAX ? texto.slice(0, BREADCRUMB_MSG_MAX) : texto
}

/** Añade una migaja al ring-buffer: recorta el mensaje y tira la más vieja si rebosa. */
function anotarMigaja(m: Breadcrumb): void {
  try {
    m.mensaje = recorta(m.mensaje)
    migajas.push(m)
    while (migajas.length > BREADCRUMBS_MAX) migajas.shift()
  } catch {
    /* jamás romper la app que nos usa por culpa de una migaja */
  }
}

/** Arranca el reporter: engancha window.error y unhandledrejection.
 *  Sin argumentos toma la config del entorno (NEXT_PUBLIC_GLZ_APP + endpoint horneado). */
export function initMaintenance(opts: InitOpts = {}): void {
  const cfg = resolverConfig(opts)
  opciones = {
    app: cfg.app,
    endpoint: cfg.endpoint,
    release: cfg.release,
    nivelPorDefecto: opts.nivelPorDefecto,
    entorno: cfg.entorno,
    activo: cfg.activo,
    patronesRuido: opts.patronesRuido,
    filtroRuido: opts.filtroRuido,
  }
  if (typeof window === 'undefined') return
  if (!opciones.activo) return // entorno no reportable (p.ej. local) → ni enganches ni registro
  window.addEventListener('error', (e: ErrorEvent) => {
    reportarError(e.error ?? e.message, { url: urlActual() })
  })
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    // Filtra el RUIDO del registro del SW / extensiones del navegador ANTES de reportar.
    // (Una extensión que envuelve navigator.serviceWorker.register y rechaza con "Rejected"
    // NO es un bug de la app.) El handler 'error' síncrono se deja intacto.
    if (
      opciones &&
      esRuidoSW(e.reason, {
        patronesRuido: opciones.patronesRuido,
        filtroRuido: opciones.filtroRuido,
      })
    ) {
      // Migaja de auditoría (nivel info: NO se reporta), por si hay que depurar el filtro.
      anotarMigaja({
        tipo: 'console',
        mensaje: 'unhandledrejection-sw-ignorado: ' + mensajeDe(e.reason),
        ts: Date.now(),
        nivel: 'info',
      })
      return
    }
    reportarError(e.reason, { url: urlActual() })
  })
  // Captura del rastro de eventos previos al error (breadcrumbs estilo Sentry).
  engancharMigajas()
  // Registro al conectar: la app aparece en el tablero (estado ok) aunque no falle.
  try {
    void fetch(`${opciones.endpoint}/api/registro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app: opciones.app,
        release: opciones.release,
        entorno: opciones.entorno,
      }),
      keepalive: true,
    }).catch(() => {
      /* best-effort */
    })
  } catch {
    /* nunca romper la app que nos usa */
  }
}

/**
 * Engancha la captura de migajas: clicks, navegación, console.error/warn y fetch.
 * Solo en navegador, idempotente y a prueba de fallos (nunca lanza).
 */
function engancharMigajas(): void {
  if (typeof window === 'undefined' || enganchesPuestos) return
  enganchesPuestos = true

  // 1) Clicks (en captura, para no perderlos si la app los detiene).
  try {
    document.addEventListener(
      'click',
      (e) => {
        try {
          anotarMigaja({ tipo: 'click', mensaje: 'click ' + describeObjetivo(e.target), ts: Date.now() })
        } catch {
          /* best-effort */
        }
      },
      true,
    )
  } catch {
    /* best-effort */
  }

  // 2) Navegación: envolver history.pushState + escuchar popstate.
  try {
    const pushOriginal = history.pushState
    history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const r = pushOriginal.apply(this, args)
      anotarMigaja({ tipo: 'nav', mensaje: '→ ' + rutaActual(), ts: Date.now() })
      return r
    }
    window.addEventListener('popstate', () => {
      anotarMigaja({ tipo: 'nav', mensaje: '→ ' + rutaActual(), ts: Date.now() })
    })
  } catch {
    /* best-effort */
  }

  // 3) console.error / console.warn: registrar y SIEMPRE delegar en el original.
  try {
    parcheaConsola('error', 'error')
    parcheaConsola('warn', 'warning')
  } catch {
    /* best-effort */
  }

  // 4) fetch: registrar método + url + status; no romper ante error de red.
  try {
    if (typeof window.fetch === 'function') {
      const fetchOriginal = window.fetch.bind(window)
      window.fetch = function (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ): ReturnType<typeof fetch> {
        const metodo = (init?.method ?? metodoDe(input) ?? 'GET').toUpperCase()
        const url = urlDe(input)
        return fetchOriginal(input, init).then(
          (resp) => {
            try {
              anotarMigaja({
                tipo: 'fetch',
                mensaje: metodo + ' ' + url + ' → ' + resp.status,
                ts: Date.now(),
                nivel: resp.status >= 500 ? 'error' : resp.status >= 400 ? 'warning' : 'info',
              })
            } catch {
              /* best-effort */
            }
            return resp
          },
          (err) => {
            // Error de red: registrar y re-lanzar para no alterar el comportamiento.
            try {
              anotarMigaja({
                tipo: 'fetch',
                mensaje: metodo + ' ' + url + ' → error de red',
                ts: Date.now(),
                nivel: 'error',
              })
            } catch {
              /* best-effort */
            }
            throw err
          },
        )
      }
    }
  } catch {
    /* best-effort */
  }
}

/** Ruta corta para las migajas de navegación. */
function rutaActual(): string {
  return typeof location !== 'undefined' ? location.pathname : ''
}

/** Describe el objetivo de un click: tag + primer id/clase, o aria-label/texto recortado. */
function describeObjetivo(target: EventTarget | null): string {
  try {
    if (!(target instanceof Element)) return '(desconocido)'
    const tag = target.tagName.toLowerCase()
    if (target.id) return tag + '#' + target.id.split(/\s+/)[0]
    const clase = typeof target.className === 'string' ? target.className.trim().split(/\s+/)[0] : ''
    if (clase) return tag + '.' + clase
    const aria = target.getAttribute('aria-label')
    if (aria) return tag + ' "' + aria.trim() + '"'
    const texto = (target.textContent ?? '').trim().replace(/\s+/g, ' ')
    if (texto) return tag + ' "' + (texto.length > 40 ? texto.slice(0, 40) : texto) + '"'
    return tag
  } catch {
    return '(desconocido)'
  }
}

/** Parchea un método de consola: anota la migaja y delega SIEMPRE en el original. */
function parcheaConsola(metodo: 'error' | 'warn', nivel: 'error' | 'warning'): void {
  const original = console[metodo].bind(console)
  console[metodo] = (...args: unknown[]) => {
    try {
      anotarMigaja({ tipo: 'console', mensaje: args.map(textoDeArg).join(' '), ts: Date.now(), nivel })
    } catch {
      /* best-effort */
    }
    original(...args)
  }
}

/** Convierte un argumento de consola en texto legible sin lanzar. */
function textoDeArg(a: unknown): string {
  if (typeof a === 'string') return a
  if (a instanceof Error) return a.message
  try {
    return JSON.stringify(a)
  } catch {
    return String(a)
  }
}

/** Extrae la URL de cualquier entrada admitida por fetch. */
function urlDe(input: Parameters<typeof fetch>[0]): string {
  try {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.href
    if (input instanceof Request) return input.url
    return String(input)
  } catch {
    return ''
  }
}

/** Extrae el método cuando la entrada de fetch es un Request. */
function metodoDe(input: Parameters<typeof fetch>[0]): string | undefined {
  try {
    return input instanceof Request ? input.method : undefined
  } catch {
    return undefined
  }
}

/** Reporta un error manualmente. Fire-and-forget: nunca lanza ni bloquea la app. */
export function reportarError(
  err: unknown,
  ctx?: { url?: string; nivel?: 'error' | 'warning' },
): void {
  if (!opciones || !opciones.activo) return
  const mensaje = mensajeDe(err)
  if (mensaje === '') return

  const ahora = Date.now()
  if (ahora - (ultimoEnvio.get(mensaje) ?? 0) < DEDUP_MS) return
  ultimoEnvio.set(mensaje, ahora)

  const payload: Record<string, unknown> = {
    app: opciones.app,
    mensaje,
    nivel: ctx?.nivel ?? opciones.nivelPorDefecto ?? 'error',
    stack: stackDe(err),
    url: ctx?.url ?? urlActual(),
    entorno: opciones.entorno,
    breadcrumbs: [...migajas], // copia del rastro: eventos previos al error
  }
  // Si hay release definido, lo incluimos para que el motor des-minifique el stack.
  if (opciones.release) payload.release = opciones.release
  try {
    void fetch(`${opciones.endpoint}/api/error`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* entrega best-effort: ignorar fallos de red */
    })
  } catch {
    /* jamás romper la app que nos usa por culpa del reporte */
  }
}

function urlActual(): string | undefined {
  return typeof location !== 'undefined' ? location.href : undefined
}

function mensajeDe(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function stackDe(err: unknown): string | undefined {
  return err instanceof Error && err.stack ? err.stack : undefined
}
