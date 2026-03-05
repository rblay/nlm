"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "LLM Score" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/careers", label: "Careers" },
];

export default function Header() {
  const pathname = usePathname();

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
        </nav>
      </div>
    </header>
  );
}
