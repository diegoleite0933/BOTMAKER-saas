"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

const pageLinks = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#integracoes", label: "Integrações" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <nav aria-label="Navegação da página" className="hidden items-center gap-5 lg:flex">
        {pageLinks.map((item) => <Link key={item.href} href={item.href} className="text-sm text-slate-400 transition-colors hover:text-white">{item.label}</Link>)}
      </nav>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="landing-account-menu"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
        {open && (
          <nav id="landing-account-menu" aria-label="Menu principal" className="absolute right-0 top-12 z-[60] grid w-64 gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-white shadow-xl">
            <div className="grid gap-1 lg:hidden">
              {pageLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white">{item.label}</Link>)}
            </div>
            <div className="grid gap-2 border-t border-slate-800 pt-3">
            <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full border-slate-700 bg-slate-900 text-white hover:bg-slate-800" })} onClick={() => setOpen(false)}>
              Entrar
            </Link>
            <Link href="/register" className={buttonVariants({ className: "w-full bg-blue-600 text-white hover:bg-blue-700" })} onClick={() => setOpen(false)}>
              Começar agora
            </Link>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
