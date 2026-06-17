# @glz/maintenance

Reporter de errores hacia **GLZ Maintenance** — la alternativa propia a Sentry, sin terceros.
Captura errores en el navegador y los manda a `POST <endpoint>/api/error`, donde GLZ
Maintenance los agrega por app y avisa por push.

## Instalar (git-install)

```bash
pnpm add github:GleZz24/glz-maintenance-sdk
```

## Usar

```ts
import { initMaintenance, MaintenanceBoundary } from '@glz/maintenance'

// 1. Arranca el reporter (engancha window.error + unhandledrejection)
initMaintenance({ app: 'MANDO', endpoint: 'https://maintenance.glzstudio.dev' })

// 2. (React) envuelve tu app para cazar la pantalla blanca
//    <MaintenanceBoundary><App /></MaintenanceBoundary>

// 3. (opcional) reporta a mano
import { reportarError } from '@glz/maintenance'
reportarError(new Error('algo raro'), { nivel: 'warning' })
```

- `endpoint` es público (modelo DSN de Sentry): no lleva secretos.
- Fire-and-forget: nunca lanza ni bloquea tu app. Dedup de 10 s por mensaje.
- React es peer dependency **opcional**: sin React, usa solo `initMaintenance`/`reportarError`.

`dist/` se versiona (los consumidores hacen git-install y lo usan directamente; tras
cambiar `src/`, ejecutar `pnpm build` y commitear `dist/`).
