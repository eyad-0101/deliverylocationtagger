"use client";

import { useEffect, useState } from "react";

type Driver = {
  id: string;
  phone: string;
  name: string;
  is_admin: boolean;
  approved: boolean;
  created_at: string;
};

type LeaderboardRow = {
  driverId: string;
  name: string;
  today: number;
  week: number;
};

export default function AdminApp() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [stats, setStats] = useState<{ locations: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  async function loadDrivers() {
    const res = await fetch("/api/admin/drivers");
    const data = await res.json();
    if (res.ok) setDrivers(data.drivers);
  }

  async function loadStats() {
    const res = await fetch("/api/admin/all-tags");
    const data = await res.json();
    if (res.ok) setStats({ locations: data.tags.length });
  }

  async function loadLeaderboard() {
    const res = await fetch("/api/admin/driver-stats");
    const data = await res.json();
    if (res.ok) setLeaderboard(data.leaderboard);
  }

  useEffect(() => {
    loadDrivers();
    loadStats();
    loadLeaderboard();
  }, []);

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

  async function setApproved(id: string, approved: boolean, successMsg: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg(successMsg);
    loadDrivers();
  }

  async function deleteDriver(id: string, name: string) {
    if (
      !confirm(
        `هل أنت متأكد من حذف المندوب "${name}"؟ سيتم حذف جميع المواقع التي أضافها نهائيًا.`,
      )
    )
      return;
    setMsg(null);
    const res = await fetch(`/api/admin/drivers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg("تم حذف المندوب وجميع مواقيته بنجاح");
    loadDrivers();
    loadStats();
  }

  const pendingDrivers = drivers.filter((d) => !d.approved);
  const activeDrivers = drivers.filter((d) => d.approved);

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      {msg && (
        <div className="card bg-blue-50 border-blue-200 text-sm">{msg}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col items-center justify-center py-6 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {drivers.length}
          </span>
          <span className="text-sm text-[var(--color-muted)] font-medium">
            عدد المناديب
          </span>
        </div>
        <div className="card flex flex-col items-center justify-center py-6 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {stats?.locations ?? "..."}
          </span>
          <span className="text-sm text-[var(--color-muted)] font-medium">
            مواقع العملاء
          </span>
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

      {leaderboard.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-3">نشاط المناديب</h2>
          <div className="flex flex-col gap-2">
            {leaderboard.map((row, i) => (
              <div
                key={row.driverId}
                className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-2 last:border-0 gap-2"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[var(--color-muted)] w-4 text-center">
                    {i + 1}
                  </span>
                  {row.name}
                </span>
                <span className="text-[var(--color-muted)] whitespace-nowrap">
                  اليوم:{" "}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {row.today}
                  </span>
                  {"  ·  "}
                  الأسبوع:{" "}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {row.week}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingDrivers.length > 0 && (
        <div className="card border-amber-200">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            بانتظار الموافقة أو موقوفة
            <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {pendingDrivers.length}
            </span>
          </h2>
          <p className="text-xs text-[var(--color-muted)] mb-3">
            حسابات جديدة سجّلت بكلمة الوردية، أو حسابات أوقفتها سابقًا —
            كلاهما لا يمكنه الدخول حتى تقبله.
          </p>
          <div className="flex flex-col gap-2">
            {pendingDrivers.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-2 last:border-0 gap-2"
              >
                <div>
                  <p>{d.name}</p>
                  <p className="text-xs text-[var(--color-muted)]" dir="ltr">
                    {d.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setApproved(d.id, true, "تمت الموافقة على المندوب")
                    }
                    className="text-xs bg-green-600 text-white rounded-md px-2.5 py-1.5 cursor-pointer"
                  >
                    قبول
                  </button>
                  <button
                    onClick={() => deleteDriver(d.id, d.name)}
                    className="text-xs text-[var(--color-destructive)] cursor-pointer"
                  >
                    رفض
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-3">المندوبون ({activeDrivers.length})</h2>
        <div className="flex flex-col gap-2">
          {activeDrivers.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-2 last:border-0 gap-2"
            >
              <span>
                {d.name} {d.is_admin && "(مسؤول)"}
              </span>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-[var(--color-muted)]" dir="ltr">
                  {d.phone}
                </span>
                <button
                  onClick={() => toggleAdmin(d.id, !d.is_admin)}
                  className="text-xs text-[var(--color-primary)] whitespace-nowrap cursor-pointer"
                >
                  {d.is_admin ? "إلغاء صلاحية المسؤول" : "اجعله مسؤولًا"}
                </button>
                <button
                  onClick={() =>
                    setApproved(d.id, false, "تم إيقاف المندوب فورًا")
                  }
                  className="text-xs text-amber-700 whitespace-nowrap cursor-pointer"
                >
                  إيقاف
                </button>
                <button
                  onClick={() => deleteDriver(d.id, d.name)}
                  className="text-xs text-[var(--color-destructive)] whitespace-nowrap cursor-pointer"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
