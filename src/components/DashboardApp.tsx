"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MapPin } from "@/components/LocationMap";

const LocationMap = dynamic(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center card text-sm text-[var(--color-muted)]"
      style={{ height: "360px" }}
    >
      جارٍ تحميل الخريطة...
    </div>
  ),
});
import { normalizePhone } from "@/lib/phone";
import {
  enqueueTag,
  flushQueue,
  getQueue,
  setupAutoSync,
  findDuplicateLocations,
  type DuplicateGroup,
} from "@/lib/offlineQueue";
import {
  fetchRoute,
  googleMapsNavUrl,
  wazeNavUrl,
  whatsappShareUrl,
  formatDistance,
  formatDuration,
  type RouteResult,
} from "@/lib/routing";

type Tag = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  lat: number;
  lng: number;
  note: string | null;
  label: string | null;
  superseded: boolean;
  created_at: string;
  added_by: string;
  edited_by: string | null;
  edited_at: string | null;
  drivers: { name: string } | null;
  editor: { name: string } | null;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "found"; phone: string; tags: Tag[] }
  | { status: "miss"; phone: string };

const LABELS: { value: string; text: string }[] = [
  { value: "home", text: "المنزل" },
  { value: "work", text: "العمل" },
  { value: "other", text: "أخرى" },
];

export default function DashboardApp({ isAdmin = false }: { isAdmin?: boolean }) {
  const [phoneInput, setPhoneInput] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [pendingCount, setPendingCount] = useState(0);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateGroup[]>([]);

  // Tagging form state
  const [pickerPin, setPickerPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinWarning, setPinWarning] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [label, setLabel] = useState("home");
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Default map showing every current pin, before any search narrows it down
  const [allPins, setAllPins] = useState<MapPin[]>([]);

  // Drive mode / route preview
  type DriveState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; route: RouteResult; dest: { lat: number; lng: number } };
  const [drive, setDrive] = useState<DriveState>({ status: "idle" });

  // Driver-side "alter pin" state (edit only, no delete)
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editLabel, setEditLabel] = useState("home");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Fullscreen map toggle
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/tags/all")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setSyncMsg(`تعذر تحميل المواقع: ${data.error ?? "خطأ غير معروف"}`);
          return;
        }
        if (Array.isArray(data.tags)) {
          setAllPins(
            data.tags.map(
              (t: { id: string; lat: number; lng: number; customer_phone: string }) => ({
                id: t.id,
                lat: t.lat,
                lng: t.lng,
                onClick: () => selectPinFromMap(t.customer_phone),
              })
            )
          );
        }
      })
      .catch(() => setSyncMsg("تعذر الاتصال بالخادم لتحميل المواقع"));
  }, [isAdmin]);

  const refreshPendingCount = () => {
    const queue = getQueue();
    setPendingCount(queue.length);
    setDuplicateWarnings(findDuplicateLocations(queue));
  };

  useEffect(() => {
    refreshPendingCount();
    const cleanup = setupAutoSync(
      (result) => {
        setSyncMsg(`تمت مزامنة ${result.sent} من المواقع المحفوظة مؤقتًا`);
        refreshPendingCount();
        setTimeout(() => setSyncMsg(null), 4000);
      },
      (isSyncing) => setSyncing(isSyncing)
    );
    return cleanup;
  }, []);

  async function runSearch(phone: string) {
    setFormOpen(false);
    setPickerPin(null);
    setPinWarning(null);
    setDrive({ status: "idle" });
    setSearch({ status: "loading" });

    try {
      const res = await fetch(`/api/tags/search?phone=${phone}`);
      const data = await res.json();
      if (!res.ok) {
        setSearch({ status: "error", message: data.error ?? "حدث خطأ" });
        return;
      }
      if (data.tags.length === 0) {
        setSearch({ status: "miss", phone });
      } else {
        setSearch({ status: "found", phone, tags: data.tags });
      }
    } catch {
      setSearch({ status: "error", message: "تعذر الاتصال بالخادم — تحقق من الإنترنت" });
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizePhone(phoneInput);
    if (!phone) {
      setSearch({ status: "error", message: "رقم الهاتف غير صالح" });
      return;
    }
    await runSearch(phone);
  }

  function selectPinFromMap(phone: string) {
    setPhoneInput(phone);
    runSearch(phone);
  }

  function useMyLocation() {
    if (!window.isSecureContext) {
      setSyncMsg(
        "تحديد الموقع يعمل فقط عبر HTTPS — الرابط الحالي غير آمن (http)"
      );
      setTimeout(() => setSyncMsg(null), 5000);
      return;
    }
    if (!navigator.geolocation) {
      setSyncMsg("هذا المتصفح لا يدعم تحديد الموقع");
      setTimeout(() => setSyncMsg(null), 5000);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickerPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });

        // The browser can silently hand back a cached/stale fix — especially
        // indoors or with a weak signal — instead of failing outright. That
        // produces exactly the "pin lands on my last stop, not here" bug:
        // the device just replays its last known location. Surface it
        // instead of trusting it blindly, so the driver can check the map
        // and adjust the pin manually if it's wrong.
        const ageMs = Date.now() - pos.timestamp;
        const accuracy = pos.coords.accuracy;

        if (ageMs > 30000) {
          const ageSeconds = Math.round(ageMs / 1000);
          setPinWarning(
            `هذا الموقع قديم (منذ ${ageSeconds} ثانية) — تأكد إن الدبوس في المكان الصحيح أو حدده يدويًا على الخريطة`
          );
        } else if (accuracy > 100) {
          setPinWarning(
            `دقة تحديد الموقع منخفضة (~${Math.round(accuracy)} م) — تأكد إن الدبوس في المكان الصحيح أو حدده يدويًا على الخريطة`
          );
        } else {
          setPinWarning(null);
        }
      },
      (err) => {
        let message = "تعذر الوصول إلى الموقع الحالي";
        if (err.code === err.PERMISSION_DENIED) {
          message = "تم رفض إذن الموقع — فعّله من إعدادات المتصفح لهذا الموقع";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = "تعذر تحديد الموقع الحالي — تأكد من تفعيل GPS";
        } else if (err.code === err.TIMEOUT) {
          message = "انتهت المهلة أثناء تحديد الموقع — حاول مرة أخرى";
        }
        setSyncMsg(message);
        setTimeout(() => setSyncMsg(null), 5000);
      },
      // maximumAge: 0 explicitly refuses any cached position the browser
      // might otherwise be tempted to reuse — force a fresh fix every time.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function startDriveMode(dest: { lat: number; lng: number }) {
    if (!window.isSecureContext) {
      setDrive({
        status: "error",
        message: "التوجيه يعمل فقط عبر HTTPS — الرابط الحالي غير آمن (http)",
      });
      return;
    }
    if (!navigator.geolocation) {
      setDrive({ status: "error", message: "هذا المتصفح لا يدعم تحديد الموقع" });
      return;
    }

    setDrive({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const route = await fetchRoute(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            dest
          );
          setDrive({ status: "ready", route, dest });
        } catch {
          setDrive({ status: "error", message: "تعذر حساب المسار — حاول مرة أخرى" });
        }
      },
      () => setDrive({ status: "error", message: "تعذر الوصول إلى موقعك الحالي" }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmitTag(e: React.FormEvent) {
    e.preventDefault();
    const phone = search.status === "miss" ? search.phone : null;
    if (!phone || !pickerPin) return;

    setSubmitting(true);
    const payload = {
      customerPhone: phone,
      customerName: customerName || undefined,
      lat: pickerPin.lat,
      lng: pickerPin.lng,
      note: note || undefined,
      label,
    };

    try {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");

      setSyncMsg("تم حفظ الموقع بنجاح");
      resetForm();
      // refresh search results
      const refreshed = await fetch(`/api/tags/search?phone=${phone}`);
      const data = await refreshed.json();
      setSearch({ status: "found", phone, tags: data.tags });
    } catch {
      enqueueTag(payload);
      refreshPendingCount();
      setSyncMsg("لا يوجد اتصال — تم حفظ الموقع مؤقتًا وسيتم إرساله تلقائيًا");
      resetForm();
    } finally {
      setSubmitting(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }

  function resetForm() {
    setFormOpen(false);
    setPickerPin(null);
    setPinWarning(null);
    setNote("");
    setCustomerName("");
    setLabel("home");
  }

  function startEditTag(t: Tag) {
    setEditingTagId(t.id);
    setEditNote(t.note ?? "");
    setEditLabel(t.label ?? "home");
    setEditCustomerName(t.customer_name ?? "");
  }

  async function saveEditTag(tagId: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: editNote,
          label: editLabel,
          customerName: editCustomerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg(data.error ?? "تعذر حفظ التعديلات");
        setTimeout(() => setSyncMsg(null), 4000);
        return;
      }
      setEditingTagId(null);
      if (search.status === "found") {
        const refreshed = await fetch(`/api/tags/search?phone=${search.phone}`);
        const refreshedData = await refreshed.json();
        setSearch({ status: "found", phone: search.phone, tags: refreshedData.tags });
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function flagWrong(tagId: string) {
    await fetch("/api/tags/flag-wrong", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    if (search.status === "found") {
      const refreshed = await fetch(`/api/tags/search?phone=${search.phone}`);
      const data = await refreshed.json();
      setSearch({ status: "found", phone: search.phone, tags: data.tags });
    }
  }

  async function manualSync() {
    setSyncing(true);
    const result = await flushQueue();
    setSyncing(false);
    refreshPendingCount();
    setSyncMsg(`تمت مزامنة ${result.sent} من المواقع`);
    setTimeout(() => setSyncMsg(null), 4000);
  }

  const pins: MapPin[] =
    search.status === "found"
      ? search.tags
          .filter((t) => !t.superseded)
          .map((t) => ({ id: t.id, lat: t.lat, lng: t.lng }))
          .slice(0, 1)
          .concat(
            search.tags
              .filter((t) => t.superseded)
              .map((t) => ({ id: t.id, lat: t.lat, lng: t.lng, faded: true }))
          )
      : [];

  // Whichever pins/route are currently on screen — used for the fullscreen
  // toggle so it always expands whatever the driver is actually looking at.
  const activePins: MapPin[] = search.status === "found" ? pins : isAdmin ? allPins : [];
  const activeRoute =
    search.status === "found" && drive.status === "ready" ? drive.route.positions : null;

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-background)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-muted)]">
            {search.status === "found"
              ? `الموقع الحالي لهذا العميل`
              : `${activePins.length} موقع محفوظ`}
          </p>
          <button className="btn-outline text-sm py-1.5 px-3" onClick={() => setExpanded(false)}>
            إغلاق ملء الشاشة
          </button>
        </div>
        <div className="flex-1">
          <LocationMap pins={activePins} route={activeRoute} height="100%" />
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      {pendingCount > 0 && (
        <div className="card flex items-center justify-between bg-amber-50 border-amber-200 text-sm">
          <span className="flex items-center gap-2">
            {syncing && (
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
            {syncing
              ? `جارٍ مزامنة ${pendingCount} موقع...`
              : `${pendingCount} موقع بانتظار المزامنة`}
          </span>
          <button
            onClick={manualSync}
            disabled={syncing}
            className="btn-outline text-xs py-1.5 px-3"
          >
            {syncing ? "جارٍ المزامنة..." : "مزامنة الآن"}
          </button>
        </div>
      )}
      {duplicateWarnings.length > 0 && (
        <div className="card bg-red-50 border-red-200 text-sm flex flex-col gap-1">
          <p className="font-medium">
            تنبيه: مواقع محفوظة مؤقتًا لأرقام مختلفة بنفس الإحداثيات تقريبًا
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            تحقق أنك حرّكت الدبوس على الخريطة لكل عميل قبل الحفظ — قد يكون
            هذا بسبب استخدام نفس الموقع بالخطأ لعميلين مختلفين:
          </p>
          <ul className="text-xs list-disc pr-4">
            {duplicateWarnings.map((g, i) => (
              <li key={i} dir="ltr" className="text-right">
                {g.phones.join(" ، ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {syncMsg && (
        <div className="card bg-green-50 border-green-200 text-sm">{syncMsg}</div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="field"
          type="tel"
          inputMode="numeric"
          placeholder="ابحث برقم هاتف العميل"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary whitespace-nowrap">
          بحث
        </button>
      </form>

      {isAdmin &&
        (search.status === "idle" ||
          search.status === "loading" ||
          search.status === "error") && <LocationMap pins={allPins} />}

      {isAdmin && search.status === "idle" && allPins.length > 0 && (
        <div className="flex items-center justify-between -mt-2">
          <p className="text-xs text-[var(--color-muted)]">
            {allPins.length} موقع محفوظ — ابحث برقم لتصفية الخريطة
          </p>
          <button
            className="text-xs text-[var(--color-primary)] cursor-pointer"
            onClick={() => setExpanded(true)}
          >
            ملء الشاشة
          </button>
        </div>
      )}

      {search.status === "loading" && (
        <p className="text-sm text-[var(--color-muted)] text-center py-6">
          جارٍ البحث...
        </p>
      )}

      {search.status === "error" && (
        <p className="text-sm text-[var(--color-destructive)] text-center py-4">
          {search.message}
        </p>
      )}

      {search.status === "miss" && (
        <div className="card flex flex-col gap-3 items-center text-center">
          <p className="font-medium">لا يوجد موقع محفوظ لهذا الرقم</p>
          <p className="text-sm text-[var(--color-muted)]">
            كن أول من يحفظ موقع هذا العميل ليستفيد منه المندوبون القادمون
          </p>
          {!formOpen && (
            <button className="btn-accent" onClick={() => setFormOpen(true)}>
              إضافة الموقع الآن
            </button>
          )}
        </div>
      )}

      {search.status === "found" && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end -mb-2">
            <button
              className="text-xs text-[var(--color-primary)] cursor-pointer"
              onClick={() => setExpanded(true)}
            >
              ملء الشاشة
            </button>
          </div>
          <LocationMap
            pins={pins}
            pickerPin={pickerPin}
            route={drive.status === "ready" ? drive.route.positions : null}
          />

          {pins[0] && drive.status === "idle" && (
            <button className="btn-primary" onClick={() => startDriveMode(pins[0])}>
              بدء التوجيه لهذا الموقع
            </button>
          )}
          {drive.status === "loading" && (
            <p className="text-sm text-[var(--color-muted)] text-center">
              جارٍ حساب المسار...
            </p>
          )}
          {drive.status === "error" && (
            <div className="card bg-red-50 border-red-200 text-sm flex items-center justify-between">
              <span>{drive.message}</span>
              {pins[0] && (
                <button
                  className="btn-outline text-xs py-1.5 px-3"
                  onClick={() => startDriveMode(pins[0])}
                >
                  إعادة المحاولة
                </button>
              )}
            </div>
          )}
          {drive.status === "ready" && (
            <div className="card flex flex-col gap-2 text-sm">
              <div className="flex justify-between font-medium">
                <span>{formatDistance(drive.route.distanceMeters)}</span>
                <span>{formatDuration(drive.route.durationSeconds)}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={googleMapsNavUrl(drive.dest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1 text-center"
                >
                  افتح في خرائط جوجل
                </a>
                <a
                  href={wazeNavUrl(drive.dest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline flex-1 text-center"
                >
                  افتح في Waze
                </a>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {search.tags.map((t) => (
              <div
                key={t.id}
                className={`card flex flex-col gap-1 text-sm ${
                  t.superseded ? "opacity-50" : ""
                }`}
              >
                {editingTagId === t.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="field"
                      placeholder="اسم العميل"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                    />
                    <select
                      className="field"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
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
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn-primary flex-1"
                        disabled={editSaving}
                        onClick={() => saveEditTag(t.id)}
                      >
                        {editSaving ? "جارٍ الحفظ..." : "حفظ"}
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => setEditingTagId(null)}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {t.label ? LABELS.find((l) => l.value === t.label)?.text : "موقع"}
                        {t.superseded && " (قديم)"}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {new Date(t.created_at).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
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
                    <div className="flex gap-3 mt-1 items-center flex-wrap">
                      <button
                        onClick={() => startEditTag(t)}
                        className="self-start text-xs text-[var(--color-primary)] cursor-pointer"
                      >
                        تعديل
                      </button>
                      <a
                        href={whatsappShareUrl(
                          { lat: t.lat, lng: t.lng },
                          { customerName: t.customer_name, customerPhone: t.customer_phone }
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start text-xs text-green-700 cursor-pointer flex items-center gap-1"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                          <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.464 3.484 1.346 4.997L2 22l5.117-1.34a9.96 9.96 0 004.887 1.34h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.67-1.04-5.18-2.928-7.07a9.935 9.935 0 00-7.073-2.93zm0 18.297a8.267 8.267 0 01-4.222-1.157l-.303-.18-3.036.796.81-2.96-.198-.304a8.284 8.284 0 01-1.27-4.395c0-4.583 3.73-8.313 8.32-8.313a8.26 8.26 0 015.883 2.439 8.257 8.257 0 012.435 5.878c0 4.583-3.73 8.196-8.419 8.196z" />
                        </svg>
                        مشاركة عبر واتساب
                      </a>
                      {!t.superseded && (
                        <button
                          onClick={() => flagWrong(t.id)}
                          className="self-start text-xs text-[var(--color-destructive)] cursor-pointer"
                        >
                          هذا الموقع غير صحيح
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {formOpen && search.status === "miss" && (
        <form onSubmit={handleSubmitTag} className="card flex flex-col gap-3">
          <h2 className="font-bold">إضافة موقع جديد</h2>

          <LocationMap
            pins={[]}
            pickerPin={pickerPin}
            onMapClick={(lat, lng) => {
              setPickerPin({ lat, lng });
              setPinWarning(null);
            }}
            height="280px"
          />
          <button type="button" onClick={useMyLocation} className="btn-outline text-sm">
            استخدام موقعي الحالي
          </button>
          {pinWarning && (
            <div className="card bg-amber-50 border-amber-200 text-xs text-amber-900" role="alert">
              {pinWarning}
            </div>
          )}
          {!pickerPin && (
            <p className="text-xs text-[var(--color-muted)]">
              اضغط على الخريطة لتحديد الموقع، أو استخدم موقعك الحالي
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            نوع الموقع
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
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            اسم العميل (اختياري)
            <input
              className="field"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            ملاحظة / علامة مميزة
            <textarea
              className="field"
              placeholder="مثال: البيت الأصفر جنب الفرن، الدور التالت شقة يمين"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!pickerPin || submitting}
            >
              {submitting ? "جارٍ الحفظ..." : "حفظ الموقع"}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setFormOpen(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
