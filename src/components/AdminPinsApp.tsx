"use client";

import { useEffect, useState } from "react";

type Tag = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  lat: number;
  lng: number;
  note: string | null;
  label: string | null;
  created_at: string;
  edited_by: string | null;
  edited_at: string | null;
  drivers: { name: string } | null;
  editor: { name: string } | null;
};

const LABELS = [
  { value: "home", text: "المنزل" },
  { value: "work", text: "العمل" },
  { value: "other", text: "أخرى" },
];

export default function AdminPinsApp() {
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // edit form state
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [label, setLabel] = useState("home");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  function loadTags() {
    fetch("/api/admin/all-tags")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error ?? "حدث خطأ");
          return;
        }
        setTags(data.tags);
      })
      .catch(() => setError("تعذر الاتصال بالخادم"));
  }

  useEffect(loadTags, []);

  function startEdit(t: Tag) {
    setEditingId(t.id);
    setCustomerName(t.customer_name ?? "");
    setNote(t.note ?? "");
    setLabel(t.label ?? "home");
    setLat(String(t.lat));
    setLng(String(t.lng));
    setMsg(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        note,
        label,
        lat: Number(lat),
        lng: Number(lng),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setEditingId(null);
    setMsg("تم حفظ التعديلات");
    loadTags();
  }

  async function deleteTag(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا الموقع نهائيًا؟")) return;
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg("تم حذف الموقع");
    loadTags();
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-destructive)]">
        {error}
      </div>
    );
  }

  const filteredTags = tags?.filter(
    (t) =>
      t.customer_phone.includes(search) ||
      (t.customer_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  function exportToCSV() {
    if (!tags) return;
    const headers = [
      "Phone",
      "Name",
      "Label",
      "Lat",
      "Lng",
      "Note",
      "Added By",
      "Date",
      "Last Edited By",
      "Last Edited At",
    ];
    const rows = tags.map((t) => [
      t.customer_phone,
      t.customer_name ?? "",
      t.label ?? "",
      t.lat,
      t.lng,
      (t.note ?? "").replace(/\n/g, " "),
      t.drivers?.name ?? "",
      new Date(t.created_at).toISOString(),
      t.editor?.name ?? "",
      t.edited_at ? new Date(t.edited_at).toISOString() : "",
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `delivery_locations_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="flex-1 flex flex-col gap-3 p-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">إدارة جميع المواقع</h2>
        <button onClick={exportToCSV} className="text-xs text-[var(--color-primary)] font-medium">
          تصدير CSV
        </button>
      </div>

      {msg && <div className="card bg-blue-50 border-blue-200 text-sm">{msg}</div>}

      <div className="relative">
        <input
          className="field pr-10"
          placeholder="بحث برقم الهاتف أو الاسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg
            className="h-4 w-4 text-[var(--color-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        {tags ? `${filteredTags?.length} موقع` : "جارٍ التحميل..."}
      </p>

      <div className="flex flex-col gap-2">
        {filteredTags?.map((t) => (
          <div key={t.id} className="card flex flex-col gap-2 text-sm">
            {editingId === t.id ? (
              <>
                <input
                  className="field"
                  placeholder="اسم العميل"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <select
                  className="field"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                >
                  {LABELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.text}
                    </option>
                  ))}
                </select>
                <textarea
                  className="field"
                  placeholder="ملاحظة"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <input
                    className="field"
                    placeholder="خط العرض"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                  <input
                    className="field"
                    placeholder="خط الطول"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1"
                    disabled={saving}
                    onClick={() => saveEdit(t.id)}
                  >
                    {saving ? "جارٍ الحفظ..." : "حفظ"}
                  </button>
                  <button className="btn-outline" onClick={() => setEditingId(null)}>
                    إلغاء
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-medium" dir="ltr">
                    {t.customer_phone}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {new Date(t.created_at).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                {t.customer_name && <p>{t.customer_name}</p>}
                {t.label && (
                  <p className="text-xs text-[var(--color-muted)]">
                    {LABELS.find((l) => l.value === t.label)?.text ?? t.label}
                  </p>
                )}
                {t.note && <p>{t.note}</p>}
                <p className="text-xs text-[var(--color-muted)]">
                  أضافه: {t.drivers?.name ?? "غير معروف"}
                </p>
                {t.edited_at && (
                  <p className="text-xs text-[var(--color-muted)]">
                    آخر تعديل: {t.editor?.name ?? "غير معروف"} —{" "}
                    {new Date(t.edited_at).toLocaleDateString("ar-EG")}
                  </p>
                )}
                <div className="flex gap-2">
                  <button className="btn-outline text-xs py-1.5 px-3" onClick={() => startEdit(t)}>
                    تعديل
                  </button>
                  <button
                    className="text-xs py-1.5 px-3 text-[var(--color-destructive)] cursor-pointer"
                    onClick={() => deleteTag(t.id)}
                  >
                    حذف
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
