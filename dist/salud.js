// @glz/maintenance/salud — helper para un endpoint /api/health PROFUNDO.
//
// Por qué: el uptime "tonto" (un GET a la raíz) MIENTE. Vercel sirve el HTML estático aunque
// Supabase esté caído o falte una env var, así que un 200 en la home no dice si el negocio
// funciona (p.ej. si entran los leads del formulario). /api/health comprueba las dependencias
// REALES y responde 503 si algo falla, para que la sonda de GLZ Maintenance lo detecte.
//
// Uso (Next.js App Router, app/api/health/route.ts):
//   import { respuestaSalud } from '@glz/maintenance/salud'
//   export const dynamic = 'force-dynamic'
//   export async function GET() {
//     return respuestaSalud({
//       release: process.env.VERCEL_GIT_COMMIT_SHA,
//       checks: {
//         supabase: async () => {
//           const { error } = await supabase.from('contactos').select('id').limit(1)
//           return !error
//         },
//         env: () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
//       },
//     })
//   }
/** Ejecuta las comprobaciones (en paralelo, con timeout) y resume la salud. Nunca lanza. */
export async function evaluarSalud(opts = {}) {
    const entradas = Object.entries(opts.checks ?? {});
    const timeout = opts.timeoutMs ?? 3000;
    const checks = {};
    await Promise.all(entradas.map(async ([nombre, fn]) => {
        checks[nombre] = await conTimeout(fn, timeout);
    }));
    const ok = entradas.every(([nombre]) => checks[nombre]);
    return { ok, release: opts.release ?? null, checks, ts: Date.now() };
}
/**
 * Devuelve una Response lista para un route handler: 200 si sana, 503 si alguna comprobación
 * falla (la sonda de uptime de GLZ Maintenance trata el 503 como caído). Sin caché.
 */
export async function respuestaSalud(opts = {}) {
    const r = await evaluarSalud(opts);
    return new Response(JSON.stringify(r), {
        status: r.ok ? 200 : 503,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
}
async function conTimeout(fn, ms) {
    try {
        const r = await Promise.race([
            Promise.resolve(fn()),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
        ]);
        return r === true;
    }
    catch {
        return false;
    }
}
