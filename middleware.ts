import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { guiaNode, guiaSlugFromPath } from "@/lib/guia/routes";
import { AGENT_FILES, clientIp, logVisit } from "@/lib/guia/log";

const PROTECTED = ["/fotos"];
const ADMIN_COOKIE = "nasus_admin";

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const path = request.nextUrl.pathname;

  // ── Guía pública y archivos para agentes: se registra la visita y se sirve
  //    sin pasar por Supabase Auth (no la necesitan). Ver lib/guia/log.ts. ──
  const guiaSlug = guiaSlugFromPath(path);
  if (guiaSlug !== null || AGENT_FILES.has(path)) {
    const isPrefetch = request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
    if (!isPrefetch) {
      event.waitUntil(logVisit({
        path,
        status: guiaSlug === null || guiaNode(guiaSlug) ? 200 : 404,
        origen: guiaSlug === null ? "archivo" : "guia",
        method: request.method,
        userAgent: request.headers.get("user-agent"),
        ip: clientIp(request.headers),
        ref: request.nextUrl.searchParams.get("ref"),
        referer: request.headers.get("referer"),
      }));
    }
    return NextResponse.next();
  }

  // La ruta viaja al render para que app/not-found.tsx registre los 404 del
  // resto del sitio (el not-found no recibe la URL de otra forma).
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nasus-path", path.slice(0, 200));
    return NextResponse.next({ request: { headers } });
  };

  // ── Admin routes: presence check only (shell layout does full JWT verify) ──
  const isAdminPage =
    path.startsWith("/admin") && !path.startsWith("/admin/login");
  if (isAdminPage) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // ── Supabase auth for user-facing protected routes ────────────────────────
  let supabaseResponse = forward();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = forward();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/validador";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // `api/whatsapp` queda fuera: Meta reintenta si el 200 tarda, y el
    // middleware añade una llamada a Supabase que el webhook no necesita.
    "/((?!_next/static|_next/image|api/whatsapp|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
