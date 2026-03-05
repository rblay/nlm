import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#1e2d4a]/10 bg-[#ece8e1] mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm font-semibold text-[#1e2d4a]" style={{ fontFamily: "var(--font-playfair)" }}>NLM</span>
        <nav className="flex items-center gap-6">
          {[
            { href: "/", label: "LLM Score" },
            { href: "/about", label: "About" },
            { href: "/pricing", label: "Pricing" },
            { href: "/careers", label: "Careers" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-xs text-[#1e2d4a]/50 hover:text-[#1e2d4a] transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#1e2d4a]/40">© {new Date().getFullYear()} NLM</span>
          <span className="text-[#1e2d4a]/20 text-xs">·</span>
          <a href="/?demo" className="text-xs text-[#1e2d4a]/30 hover:text-[#1e2d4a]/60 transition-colors">
            Demo
          </a>
          <a href="/?dev" className="text-xs text-[#1e2d4a]/30 hover:text-[#1e2d4a]/60 transition-colors">
            Dev
          </a>
        </div>
      </div>
    </footer>
  );
}
