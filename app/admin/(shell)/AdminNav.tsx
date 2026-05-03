"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/clientes", label: "Clientes", icon: "◉" },
  { href: "/admin/propuestas/nueva", label: "Propuestas", icon: "◎" },
  { href: "/admin/cambios", label: "Cambios", icon: "◌" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <aside className="w-52 flex-none bg-zinc-950 border-r border-zinc-900 flex flex-col min-h-screen sticky top-0 h-screen">
      <div className="px-5 py-5 border-b border-zinc-900">
        <span className="text-[#c4a882] font-mono font-bold text-sm tracking-widest">
          NASUS
        </span>
        <p className="text-zinc-600 text-[10px] font-mono mt-0.5">Admin Panel</p>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors ${
                active
                  ? "bg-[#c4a882]/10 text-[#c4a882]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-900">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900 transition-colors"
        >
          <span className="text-base leading-none">⊗</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
