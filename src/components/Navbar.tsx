"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

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
        ]
      : []),
  ];

  return (
    <header className="border-b border-[var(--color-border)] bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent">مواقع العملاء</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">مرحبًا، {name}</p>
        </div>
        <LogoutButton />
      </div>
      <nav className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm whitespace-nowrap px-4 py-2 rounded-xl transition-all font-medium ${
                active
                  ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-md"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-foreground)]"
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
