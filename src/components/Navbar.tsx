"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

type Props = {
  name: string;
  isAdmin: boolean;
};

export default function Navbar({ name, isAdmin }: Props) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "بحث عن موقع" },
    ...(isAdmin
      ? [
          { href: "/admin", label: "لوحة التحكم" },
          { href: "/admin/pins", label: "إدارة المواقع" },
          { href: "/admin/live", label: "تتبع المندوبين مباشرة" },
          { href: "/admin/audit", label: "سجل النشاط" },
        ]
      : []),
  ];

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">مواقع العملاء</h1>
          <p className="text-xs text-[var(--color-muted)]">مرحبًا، {name}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
      <nav className="flex gap-1 px-4 pb-2 overflow-x-auto">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
