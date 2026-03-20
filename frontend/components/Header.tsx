"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const navLinks = [
  { href: "/", label: "LLM Score" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/careers", label: "Careers" },
];

function HeaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = searchParams.has("admin") || pathname === "/admin";

  return (
    <header className="w-full border-b border-[#1e2d4a]/10 bg-[#ece8e1]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[#1e2d4a] tracking-tight" style={{ fontFamily: "var(--font-playfair)" }}>
          NLM
        </Link>
        <nav className="flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                pathname === href
                  ? "text-[#1e2d4a]"
                  : "text-[#1e2d4a]/50 hover:text-[#1e2d4a]"
              }`}
            >
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`text-sm font-medium transition-colors px-3 py-1 rounded-lg ${
                pathname === "/admin"
                  ? "bg-[#1e2d4a] text-white"
                  : "bg-[#1e2d4a]/10 text-[#1e2d4a] hover:bg-[#1e2d4a]/20"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function Header() {
  return (
    <Suspense fallback={
      <header className="w-full border-b border-[#1e2d4a]/10 bg-[#ece8e1]">
        <div className="max-w-6xl mx-auto px-6 py-4 h-[57px]" />
      </header>
    }>
      <HeaderInner />
    </Suspense>
  );
}
