"use client";

import { useEffect, useMemo, useState } from "react";

type EventType = "tagged" | "edited" | "flagged";

type AuditEvent = {
  id: string;
  type: EventType;
  at: string;
  actorId: string | null;
  actorName: string;
  tagId: string;
  customerPhone: string;
  customerName: string | null;
  label: string | null;
};

type Driver = { id: string; name: string };

const TYPE_LABEL: Record<EventType, string> = {
  tagged: "إضافة موقع",
  edited: "تعديل",
  flagged: "تم الإبلاغ كخطأ",
};

const TYPE_STYLE: Record<EventType, string> = {
  tagged: "bg-green-50 text-green-700 border-green-200",
  edited: "bg-blue-50 text-blue-700 border-blue-200",
  flagged: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminAuditApp() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? "تعذر تحميل سجل النشاط");
          return;
        }
        setEvents(data.events ?? []);
        setDrivers(data.drivers ?? []);
      })
      .catch(() => setError("تعذر الاتصال بالخادم"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (driverFilter !== "all" && e.actorId !== driverFilter) return false;
      return true;
    });
  }, [events, typeFilter, driverFilter]);

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="font-bold text-lg">سجل النشاط</h1>
        <p className="text-sm text-[var(--color-muted)]">
          كل عمليات الإضافة والتعديل والإبلاغ عن خطأ، الأحدث أولًا
        </p>
      </div>

      <div className="flex gap-2">
        <select
          className="field"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EventType | "all")}
        >
          <option value="all">كل الأحداث</option>
          <option value="tagged">إضافة موقع</option>
          <option value="edited">تعديل</option>
          <option value="flagged">تم الإبلاغ كخطأ</option>
        </select>
        <select
          className="field"
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
        >
          <option value="all">كل المناديب</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-sm text-[var(--color-muted)] text-center py-6">
          جارٍ التحميل...
        </p>
      )}

      {error && (
        <p className="text-sm text-[var(--color-destructive)] text-center py-4">{error}</p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-sm text-[var(--color-muted)] text-center py-6">
          لا يوجد نشاط مطابق
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((e) => (
          <div key={e.id} className="card flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-medium border rounded-full px-2.5 py-0.5 ${TYPE_STYLE[e.type]}`}
              >
                {TYPE_LABEL[e.type]}
              </span>
              <span className="text-xs text-[var(--color-muted)]" dir="ltr">
                {new Date(e.at).toLocaleString("ar-EG")}
              </span>
            </div>
            <p>
              <span className="font-medium">{e.actorName}</span> —{" "}
              {e.customerName ? `${e.customerName} (${e.customerPhone})` : e.customerPhone}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
