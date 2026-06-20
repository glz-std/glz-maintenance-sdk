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

> **Matiz del cliente:** Next solo inyecta en el bundle de navegador los **literales**
> `process.env.NEXT_PUBLIC_*`, no los accesos dinámicos. Por eso en el **cliente** se pasa
> `app` explícito a `initMaintenance` (el endpoint sí va horneado). En **servidor** todo se
> resuelve de entorno sin tocar nada.

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

- **`@glz/maintenance`** (cliente): `initMaintenance(opts?)`, `reportarError(err, ctx?)`, `MaintenanceBoundary`.
- **`@glz/maintenance/server`** (Node/edge): `initServidor(opts?)`, `reportarErrorServidor(err, ctx?)`, `reportarMensajeServidor(mensaje, ctx?)`, `onRequestError`.

Las `opts` (`{ app?, endpoint?, release? }`) siempre ganan al entorno, y el entorno al default horneado.

## Notas

- El `endpoint` es público (modelo DSN de Sentry): no lleva secretos.
- Cliente: fire-and-forget, dedup de 10 s por mensaje. Servidor: awaitable con timeout de 3 s
  (en serverless conviene `await` para que el POST salga antes de congelarse la función).
- Nunca lanza ni bloquea tu app.
- React es peer dependency **opcional**: sin React, usa solo las funciones de captura.
- `dist/` se versiona (git-install lo usa directamente). Tras cambiar `src/`, ejecuta
  `pnpm build` y commitea `dist/`.
