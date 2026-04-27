import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#050508]/90 backdrop-blur border-b border-zinc-900">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            className="text-[#c4a882] font-mono font-bold tracking-wide text-sm"
          >
            Nasus Agency
          </a>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-1">
              <a
                href="/validador"
                className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-[#c4a882] transition-colors rounded-lg hover:bg-zinc-900"
              >
                Documentos
              </a>
              <a
                href="/fotos"
                className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-[#c4a882] transition-colors rounded-lg hover:bg-zinc-900"
              >
                Fotografías
              </a>
            </nav>
            {user ? (
              <>
                <span className="text-xs text-zinc-500 truncate max-w-[160px] hidden sm:block">
                  {user.email}
                </span>
                <LogoutButton />
              </>
            ) : (
              <a
                href="/login"
                className="text-sm border border-[#c4a882] text-[#c4a882] px-4 py-2 rounded-lg hover:bg-[#c4a882] hover:text-[#050508] transition-colors"
              >
                Iniciar sesión
              </a>
            )}
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}
