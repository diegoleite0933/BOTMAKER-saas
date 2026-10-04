"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function LandingNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <>
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
          <nav id="landing-account-menu" aria-label="Acesso à conta" className="absolute right-0 top-12 z-[60] grid w-52 gap-2 rounded-md border border-slate-700 bg-slate-950 p-3 text-white shadow-xl">
            <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full border-blue-700 bg-blue-950 text-white hover:bg-blue-900" })} onClick={() => setOpen(false)}>
              Entrar
            </Link>
            <Link href="/register" className={buttonVariants({ className: "w-full bg-blue-600 text-white hover:bg-blue-700" })} onClick={() => setOpen(false)}>
              Começar Grátis
            </Link>
          </nav>
        )}
      </div>
    </>
  );
}
