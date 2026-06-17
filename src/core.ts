// Núcleo del reporter: engancha errores globales y los manda a GLZ Maintenance.
// Sin dependencias. Fire-and-forget: nunca lanza ni bloquea la app que lo usa.

export interface InitOpts {
  /** Slug/nombre de la app, p.ej. 'MANDO', 'DXB'. Identifica el origen en GLZ Maintenance. */
  app: string
  /** Base del motor, p.ej. 'https://maintenance.glzstudio.dev'. */
  endpoint: string
  /** Nivel por defecto de los errores no clasificados. */
  nivelPorDefecto?: 'error' | 'warning'
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

let opciones: InitOpts | null = null
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

/** Arranca el reporter: engancha window.error y unhandledrejection. */
export function initMaintenance(opts: InitOpts): void {
  opciones = opts
  if (typeof window === 'undefined') return
  window.addEventListener('error', (e: ErrorEvent) => {
    reportarError(e.error ?? e.message, { url: urlActual() })
  })
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    reportarError(e.reason, { url: urlActual() })
  })
  // Captura del rastro de eventos previos al error (breadcrumbs estilo Sentry).
  engancharMigajas()
  // Registro al conectar: la app aparece en el tablero (estado ok) aunque no falle.
  try {
    void fetch(`${opts.endpoint}/api/registro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app: opts.app }),
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
  if (!opciones) return
  const mensaje = mensajeDe(err)
  if (mensaje === '') return

  const ahora = Date.now()
  if (ahora - (ultimoEnvio.get(mensaje) ?? 0) < DEDUP_MS) return
  ultimoEnvio.set(mensaje, ahora)

  const payload = {
    app: opciones.app,
    mensaje,
    nivel: ctx?.nivel ?? opciones.nivelPorDefecto ?? 'error',
    stack: stackDe(err),
    url: ctx?.url ?? urlActual(),
    breadcrumbs: [...migajas], // copia del rastro: eventos previos al error
  }
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
