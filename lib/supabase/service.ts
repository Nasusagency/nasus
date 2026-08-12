import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con service role, para rutas sin sesión de usuario.
 *
 * El webhook de WhatsApp lo invoca Meta, no un navegador: no hay cookies ni
 * sesión, así que `lib/supabase/server.ts` (que lee cookies) no aplica.
 *
 * La service role salta RLS. Las tablas de WhatsApp tienen RLS activo sin
 * políticas justamente para que este sea el único camino de acceso. Nunca
 * importar este módulo desde código de cliente.
 */

let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Sin credenciales se devuelve null en vez de lanzar: el webhook debe seguir
  // contestando al cliente aunque la persistencia esté mal configurada.
  if (!url || !serviceKey) return null;

  cached = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
