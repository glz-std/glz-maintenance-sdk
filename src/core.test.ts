// Tests del filtro de ruido del SW/extensiones (v0.5.0). Runner: node:test vía tsx.
//   pnpm test  →  tsx --test src/*.test.ts
//
// esRuidoSW decide ruido por el ORIGEN DEL STACK, no por palabras sueltas. Regla de
// oro: si el stack toca el bundle propio, NUNCA se filtra (no tragarse bugs reales).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esRuidoSW } from './core.js'

/** Crea un Error con un stack concreto (Error.captureStackTrace lo sobreescribiría). */
function errorConStack(mensaje: string, stack: string): Error {
  const e = new Error(mensaje)
  e.stack = stack
  return e
}

test('esRuidoSW: stack EXCLUSIVO de registro de SW → true', () => {
  const reason = errorConStack(
    'Rejected',
    [
      'Error: Rejected',
      '    at registerSW.js:1:234',
      '    at ServiceWorkerRegistration.register (registerSW.js:1:120)',
      '    at navigator.serviceWorker.register (<anonymous>)',
    ].join('\n'),
  )
  assert.equal(esRuidoSW(reason), true)
})

test('esRuidoSW: stack con un frame del bundle propio (/assets/) aunque mencione SW → false (regla de oro)', () => {
  const reason = errorConStack(
    'Rejected',
    [
      'Error: Rejected',
      '    at navigator.serviceWorker.register (<anonymous>)',
      '    at https://app.glzstudio.dev/assets/index-a1b2c3.js:5:9999', // FRAME PROPIO
    ].join('\n'),
  )
  assert.equal(esRuidoSW(reason), false)
})

test('esRuidoSW: stack con frame propio en /_next/ aunque mencione SW → false', () => {
  const reason = errorConStack(
    'boom',
    [
      'Error: boom',
      '    at registerSW.js:1:1',
      '    at https://dxbcia.com/_next/static/chunks/page-xyz.js:2:3', // FRAME PROPIO
    ].join('\n'),
  )
  assert.equal(esRuidoSW(reason), false)
})

test('esRuidoSW: esquema chrome-extension:// → true', () => {
  const reason = errorConStack(
    'wrsParams failed',
    [
      'Error: wrsParams failed',
      '    at wrap (chrome-extension://abcdefghijklmnop/inject.js:10:5)',
      '    at chrome-extension://abcdefghijklmnop/content.js:1:1',
    ].join('\n'),
  )
  assert.equal(esRuidoSW(reason), true)
})

test('esRuidoSW: esquema moz-extension:// → true', () => {
  const reason = errorConStack(
    'ext',
    'Error: ext\n    at moz-extension://uuid/background.js:3:3',
  )
  assert.equal(esRuidoSW(reason), true)
})

test('esRuidoSW: reason que LANZA al inspeccionar → false (fail-soft, reportar de más)', () => {
  const reason = {
    get stack() {
      throw new Error('getter explosivo')
    },
  }
  assert.equal(esRuidoSW(reason), false)
})

test('esRuidoSW: reason sin stack (string, null) → false (no se puede demostrar que es ruido)', () => {
  assert.equal(esRuidoSW('un string suelto'), false)
  assert.equal(esRuidoSW(null), false)
  assert.equal(esRuidoSW(undefined), false)
  assert.equal(esRuidoSW({}), false)
})

test('esRuidoSW: error de la app SIN frames de SW → false (no es ruido, es un bug real)', () => {
  const reason = errorConStack(
    'TypeError: x is not a function',
    [
      'TypeError: x is not a function',
      '    at https://app.glzstudio.dev/assets/index-a1b2c3.js:1:1',
      '    at https://app.glzstudio.dev/assets/vendor-zzz.js:2:2',
    ].join('\n'),
  )
  assert.equal(esRuidoSW(reason), false)
})

test('esRuidoSW: filtroRuido custom puede MARCAR ruido (override aditivo)', () => {
  const reason = errorConStack(
    'ResizeObserver loop limit exceeded',
    'Error: ResizeObserver loop limit exceeded', // sin stack útil → por defecto false
  )
  // Sin filtro: no es ruido.
  assert.equal(esRuidoSW(reason), false)
  // Con filtro custom: el proyecto lo declara ruido.
  const filtroRuido = (r: unknown) =>
    r instanceof Error && /ResizeObserver loop/.test(r.message)
  assert.equal(esRuidoSW(reason, { filtroRuido }), true)
})

test('esRuidoSW: patronesRuido custom (RegExp[]) marca ruido por mensaje/stack', () => {
  const reason = errorConStack(
    'Non-Error promise rejection captured with value: undefined',
    'Error\n    at https://app.glzstudio.dev/assets/index.js:1:1', // frame propio: regla de oro NO aplica a patrones custom
  )
  assert.equal(esRuidoSW(reason), false)
  assert.equal(
    esRuidoSW(reason, { patronesRuido: [/Non-Error promise rejection/] }),
    true,
  )
})

test('esRuidoSW: filtroRuido custom que LANZA no rompe (fail-soft → sigue con el filtro base)', () => {
  const reason = errorConStack(
    'Rejected',
    'Error: Rejected\n    at registerSW.js:1:1', // solo-SW → base diría true
  )
  const filtroRuido = () => {
    throw new Error('filtro roto')
  }
  // El filtro custom explota, pero el filtro base (solo-SW) sigue aplicando.
  assert.equal(esRuidoSW(reason, { filtroRuido }), true)
})
