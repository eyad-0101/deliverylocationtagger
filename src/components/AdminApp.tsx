"use client";

import { useEffect, useState } from "react";

type Driver = {
  id: string;
  phone: string;
  name: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminApp() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // add driver form
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // reset password form
  const [resetPhone, setResetPhone] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  async function loadDrivers() {
    const res = await fetch("/api/admin/drivers");
    const data = await res.json();
    if (res.ok) setDrivers(data.drivers);
  }

  const [stats, setStats] = useState<{ locations: number } | null>(null);

  async function loadStats() {
    const res = await fetch("/api/admin/all-tags");
    const data = await res.json();
    if (res.ok) setStats({ locations: data.tags.length });
  }

  useEffect(() => {
    loadDrivers();
    loadStats();
  }, []);

  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    const res = await fetch("/api/admin/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, password }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setPhone("");
    setName("");
    setPassword("");
    setMsg("تمت إضافة المندوب بنجاح");
    loadDrivers();
  }

  async function toggleAdmin(id: string, makeAdmin: boolean) {
    setMsg(null);
    const res = await fetch(`/api/admin/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: makeAdmin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg(makeAdmin ? "تم منح صلاحية المسؤول" : "تم إلغاء صلاحية المسؤول");
    loadDrivers();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetting(true);
    setMsg(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: resetPhone, newPassword: resetPassword }),
    });
    const data = await res.json();
    setResetting(false);
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setResetPhone("");
    setResetPassword("");
    setMsg("تم تغيير كلمة المرور بنجاح");
  }

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      {msg && <div className="card bg-blue-50 border-blue-200 text-sm">{msg}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col items-center justify-center py-6 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {drivers.length}
          </span>
          <span className="text-sm text-[var(--color-muted)] font-medium">عدد المناديب</span>
        </div>
        <div className="card flex flex-col items-center justify-center py-6 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {stats?.locations ?? "..."}
          </span>
          <span className="text-sm text-[var(--color-muted)] font-medium">مواقع العملاء</span>
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="/admin/pins"
          className="btn-outline flex-1 flex items-center justify-center gap-2 py-3"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          إدارة المواقع
        </a>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">المندوبون ({drivers.length})</h2>
        <div className="flex flex-col gap-2">
          {drivers.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-2 last:border-0 gap-2"
            >
              <span>
                {d.name} {d.is_admin && "(مسؤول)"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-muted)]" dir="ltr">
                  {d.phone}
                </span>
                <button
                  onClick={() => toggleAdmin(d.id, !d.is_admin)}
                  className="text-xs text-[var(--color-primary)] whitespace-nowrap cursor-pointer"
                >
                  {d.is_admin ? "إلغاء صلاحية المسؤول" : "اجعله مسؤولًا"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
