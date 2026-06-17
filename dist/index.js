// @glz/maintenance — reporter de errores hacia GLZ Maintenance (alternativa propia a Sentry).
//
// Uso:
//   import { initMaintenance, MaintenanceBoundary } from '@glz/maintenance'
//   initMaintenance({ app: 'MANDO', endpoint: 'https://maintenance.glzstudio.dev' })
//   ...envolver <App/> en <MaintenanceBoundary> para cazar la pantalla blanca.
export { initMaintenance, reportarError } from './core.js';
export { MaintenanceBoundary } from './boundary.js';
