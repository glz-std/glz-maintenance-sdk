# @glz/maintenance

Reporter de errores hacia **GLZ Maintenance** — la alternativa propia a Sentry, sin terceros.
Cubre **cliente** (navegador) y **servidor** (Node/edge) con un mismo paquete y manda los
errores a `POST <endpoint>/api/error`, donde el motor los agrega por app y avisa por push.
El endpoint viene **horneado**: un proyecto nuevo reporta sin configurar DSN.

## Instalar (git-install)

```bash
pnpm add github:GleZz24/glz-maintenance-sdk
```

## Configuración por entorno

- `NEXT_PUBLIC_GLZ_APP` (cliente) / `GLZ_APP` (servidor) — nombre de la app en el tablero.
- `NEXT_PUBLIC_GLZ_MAINT_URL` / `GLZ_MAINT_URL` — opcional, override del endpoint (por defecto, infra GLZ).
- `NEXT_PUBLIC_RELEASE` / `GLZ_RELEASE` — opcional, SHA/versión del deploy (des-minifica stacks).
- `NEXT_PUBLIC_GLZ_ENV` / `GLZ_ENV` — opcional, etiqueta del entorno (production/preview/dev…).
  Si no se fija, se autodetecta (ver más abajo).

> **Matiz del cliente:** Next solo inyecta en el bundle de navegador los **literales**
> `process.env.NEXT_PUBLIC_*`, no los accesos dinámicos. Por eso en el **cliente** se pasan
> `app` y `entorno` explícitos a `initMaintenance` (el endpoint sí va horneado). En **servidor**
> todo se resuelve de entorno sin tocar nada.

## Conciencia de entorno (agnóstico del host)

Cada reporte lleva un campo `entorno` para que el tablero separe producción de dev/preview
sin fragmentar la app (un solo `error-<app>`, desglosado por entorno dentro). No asume Vercel:

- **Fijar explícito (vale en cualquier host):** `GLZ_ENV` en servidor, o `entorno` en
  `initMaintenance({ entorno })` en cliente. Manda sobre todo lo demás.
- **Autodetección de cortesía** si no se fija nada:
  1. Vercel: `production` directo; si no, la rama de git (`VERCEL_GIT_COMMIT_REF`) separa dev/preview.
  2. Genérico (Docker, VPS, Railway, Render, Fly, local…): `NODE_ENV`.
  3. Sin pistas → `development`.

Gating: por defecto **`development` (local) y `test` (vitest/CI) NO reportan** (un reporter
no debe disparar POSTs reales al motor desde el test suite); el resto sí. Para afinar:
`initMaintenance({ soloEntornos: ['production'] })` (allowlist estricta) o
`{ reportarEnDesarrollo: true }` (incluir local). Aplica igual en `initServidor`.

## Enchufar un proyecto Next (plug&play)

Tres ficheros, una línea cada uno, más las envs. No hay que escribir el reporter de servidor
a mano (eso vive ya en el SDK).

**`instrumentation-client.ts`** — errores de navegador:

```ts
import { initMaintenance } from '@glz/maintenance'

initMaintenance({ app: 'DXB', release: process.env.NEXT_PUBLIC_RELEASE })
// engancha window.error + unhandledrejection + breadcrumbs + registro en el tablero
```

**`instrumentation.ts`** — errores de servidor (Node/edge):

```ts
import { initServidor } from '@glz/maintenance/server'

export async function register() {
  await initServidor() // registra la app en el tablero (sale en estado OK aunque no falle)
}

export { onRequestError } from '@glz/maintenance/server' // errores de petición del servidor
```

**(Opcional, React)** envuelve tu app para cazar la pantalla blanca:

```tsx
import { MaintenanceBoundary } from '@glz/maintenance'

<MaintenanceBoundary><App /></MaintenanceBoundary>
```

## Filtro de ruido del Service Worker / extensiones (cliente)

El handler de `unhandledrejection` recibe rechazos que **no son bugs de la app**: una
extensión del navegador (p.ej. una que envuelve `navigator.serviceWorker.register`) puede
rechazar con `"Rejected"` y, sin filtro, eso llegaba al tablero como un error. Desde v0.5.0,
antes de reportar un `unhandledrejection` se descarta el ruido **por el ORIGEN del stack**
(no por palabras sueltas):

- Se filtra si el stack es **exclusivamente** frames de registro de SW (`registerSW.js`,
  `serviceWorker.register`, `navigator.serviceWorker`, `ServiceWorkerRegistration`) o de
  esquema de extensión (`chrome-extension://`, `moz-extension://`, `safari-web-extension://`).
- **Regla de oro:** si el stack contiene **al menos un frame del bundle propio**
  (`/_next/`, `/assets/`, `/chunks/`), **NO se filtra** — así no se tragan bugs reales,
  incluidos los del SW de la propia app.
- Fail-soft: ante cualquier duda o excepción, **se reporta** (no se descarta).

El handler de `error` síncrono y `reportarError` manual **no se tocan**: filtran nada.

### Extender o anular el filtro sin tocar el SDK

```ts
initMaintenance({
  app: 'DXB',
  // Patrones extra (se prueban contra mensaje + stack del reason):
  patronesRuido: [/ResizeObserver loop/, /Non-Error promise rejection/],
  // o un gancho a medida (true = descartar):
  filtroRuido: (r) => r instanceof Error && /Load failed/.test(r.message),
})
```

`patronesRuido` y `filtroRuido` son **aditivos** al filtro base (si cualquiera marca ruido,
se descarta) y solo aplican en `unhandledrejection`. La función pura `esRuidoSW(reason, opts?)`
se exporta por si un proyecto quiere clasificar por su cuenta.

## Avisos manuales

```ts
// Cliente
import { reportarError } from '@glz/maintenance'
reportarError(new Error('algo raro'), { nivel: 'warning' })

// Servidor (server actions, rutas, librerías de servidor)
import { reportarErrorServidor, reportarMensajeServidor } from '@glz/maintenance/server'
await reportarErrorServidor(err, { nivel: 'warning', contexto: 'envío de email' })
await reportarMensajeServidor('cuota de API casi agotada', { nivel: 'warning' })
```

## API

- **`@glz/maintenance`** (cliente): `initMaintenance(opts?)`, `reportarError(err, ctx?)`, `esRuidoSW(reason, opts?)`, `MaintenanceBoundary`.
- **`@glz/maintenance/server`** (Node/edge): `initServidor(opts?)`, `reportarErrorServidor(err, ctx?)`, `reportarMensajeServidor(mensaje, ctx?)`, `onRequestError`.

Las `opts` (`{ app?, endpoint?, release? }`) siempre ganan al entorno, y el entorno al default horneado.

## `/api/health` profundo (`@glz/maintenance/salud`)

Un GET a la raíz miente: Vercel sirve el HTML aunque Supabase esté caído. Expón un
`/api/health` que compruebe las dependencias reales y devuelva **503** si algo falla, y
apunta ahí la sonda de uptime de GLZ Maintenance.

```ts
// app/api/health/route.ts
import { respuestaSalud } from '@glz/maintenance/salud'
export const dynamic = 'force-dynamic'

export async function GET() {
  return respuestaSalud({
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    checks: {
      supabase: async () => {
        const { error } = await supabase.from('contactos').select('id').limit(1)
        return !error
      },
      env: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
  })
}
```

200 = sano · 503 = alguna dependencia caída (la sonda lo trata como caído). Las comprobaciones
corren en paralelo con timeout (una que cuelga = fallo, no cuelga el endpoint).

## Notas

- El `endpoint` es público (modelo DSN de Sentry): no lleva secretos.
- Cliente: fire-and-forget, dedup de 10 s por mensaje. Servidor: awaitable con timeout de 3 s
  (en serverless conviene `await` para que el POST salga antes de congelarse la función).
- Nunca lanza ni bloquea tu app.
- React es peer dependency **opcional**: sin React, usa solo las funciones de captura.
- `dist/` se versiona (git-install lo usa directamente). Tras cambiar `src/`, ejecuta
  `pnpm build` y commitea `dist/`.
- Tests con el runner nativo de Node vía `tsx`: `pnpm test` (`tsx --test src/*.test.ts`).
  Los `*.test.ts` se excluyen del build (no entran en `dist/`).
