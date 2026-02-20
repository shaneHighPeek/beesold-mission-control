"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  subtitle?: string;
  active: "dashboard" | "intake";
  children: ReactNode;
};

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/mission-control" },
  { key: "intake", label: "Listings Portal", href: "/portal/off-market-group" },
] as const;

export function AppShell({ title, subtitle, active, children }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand-block">
          <Image
            src="/logo.png?v=2"
            alt="BeeSold logo"
            width={1400}
            height={420}
            className="brand-logo"
            sizes="(max-width: 1024px) 70vw, 220px"
            priority
          />
          <p className="brand-subheadline">Dashboard</p>
        </div>

        <nav className="shell-nav">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`shell-nav-item ${active === item.key ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="shell-sidebar-footer">Secure Multi-Tenant Intake Live</div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <span className="credits-pill">Operator Ready</span>
        </header>

        <div className="shell-content">{children}</div>
      </div>
    </div>
  );
}
