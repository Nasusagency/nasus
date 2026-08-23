"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/admin/leads", label: "Leads", icon: "◎" },
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/clientes", label: "Clientes", icon: "◉" },
  { href: "/admin/propuestas/nueva", label: "Propuestas", icon: "◎" },
  { href: "/admin/cambios", label: "Cambios", icon: "◌" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return <>
    <header className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-zinc-950/95 backdrop-blur border-b border-zinc-900 flex items-center justify-between">
      <div><span className="text-[#c4a882] font-mono font-bold text-sm tracking-widest">NASUS</span><span className="text-zinc-600 text-[10px] font-mono ml-2">Admin</span></div>
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú de administración" aria-expanded={open} aria-controls="admin-navigation" className="h-10 w-10 rounded-lg border border-zinc-800 text-zinc-300 grid place-items-center hover:border-zinc-700">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </header>
    {open && <button type="button" aria-label="Cerrar menú de administración" onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />}
    <aside id="admin-navigation" className={`fixed inset-y-0 left-0 z-50 w-[min(82vw,18rem)] flex-none bg-zinc-950 border-r border-zinc-900 flex flex-col h-dvh transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:w-52 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="px-5 py-4 lg:py-5 border-b border-zinc-900 flex items-center justify-between">
        <div>
        <span className="text-[#c4a882] font-mono font-bold text-sm tracking-widest">
          NASUS
        </span>
        <p className="text-zinc-600 text-[10px] font-mono mt-0.5">Admin Panel</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="lg:hidden h-9 w-9 rounded-lg text-zinc-500 grid place-items-center hover:bg-zinc-900 hover:text-zinc-300">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
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
  </>;
}
