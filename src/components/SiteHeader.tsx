"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Library" },
  { href: "/sources/new", label: "Add Source" },
  { href: "/tickers", label: "Tickers" },
  { href: "/settings", label: "Settings" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark">
          <span className="brand-x">X</span>
          <span className="brand-rest">Equity Researcher</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link" aria-current={pathname === link.href || (link.href === "/tickers" && pathname.startsWith("/tickers/")) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
