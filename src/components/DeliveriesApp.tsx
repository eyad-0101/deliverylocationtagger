"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default Leaflet marker icons in Next.js
const driverIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const customerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Driver = {
  id: string;
  phone: string;
  name: string;
  is_admin: boolean;
  created_at: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    battery_level?: number;
    is_online: boolean;
    last_seen_at: string;
  } | null;
};

type Delivery = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  customer_address: string | null;
  driver_id: string | null;
  status: "pending" | "assigned" | "picked_up" | "in_transit" | "delivered" | "cancelled";
  note: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  driver: {
    name: string;
    lat?: number;
    lng?: number;
    is_online?: boolean;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  assigned: "تم التعيين",
  picked_up: "تم الاستلام",
  in_transit: "في الطريق",
  delivered: "تم التسليم",
  cancelled: "ملغاة",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  assigned: "bg-blue-100 text-blue-800",
  picked_up: "bg-yellow-100 text-yellow-800",
  in_transit: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function DeliveriesApp() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  // New delivery form
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newDriverId, setNewDriverId] = useState("");
  const [newNote, setNewNote] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadDeliveries() {
    try {
      const res = await fetch(`/api/admin/deliveries?includeCompleted=${includeCompleted}`);
      const data = await res.json();
      if (res.ok) {
        setDeliveries(data.deliveries);
      } else {
        setError(data.error ?? "حدث خطأ");
      }
    } catch (err) {
      setError("تعذر الاتصال بالخادم");
    }
  }

  async function loadDrivers() {
    try {
      const res = await fetch("/api/admin/drivers/location");
      const data = await res.json();
      if (res.ok) {
        setDrivers(data.drivers);
      }
    } catch (err) {
      console.error("Error loading drivers:", err);
    }
  }

  useEffect(() => {
    loadDeliveries();
    loadDrivers();
    setLoading(false);

    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      loadDeliveries();
      loadDrivers();
    }, 10000);

    return () => clearInterval(interval);
  }, [includeCompleted]);

  async function handleCreateDelivery(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    const res = await fetch("/api/admin/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_phone: newCustomerPhone,
        customer_name: newCustomerName || null,
        customer_address: newCustomerAddress || null,
        driver_id: newDriverId || null,
        note: newNote || null,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setNewCustomerPhone("");
    setNewCustomerName("");
    setNewCustomerAddress("");
    setNewDriverId("");
    setNewNote("");
    setMsg("تم إنشاء التوصيلة بنجاح");
    loadDeliveries();
  }

  async function updateDeliveryStatus(id: string, status: Delivery["status"], driverId?: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/deliveries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, driver_id: driverId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg(`تم تحديث الحالة إلى ${STATUS_LABELS[status]}`);
    loadDeliveries();
  }

  async function assignDriver(deliveryId: string, driverId: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: driverId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg("تم تعيين السائق");
    loadDeliveries();
  }

  async function cancelDelivery(id: string) {
    if (!confirm("هل أنت متأكد من إلغاء هذه التوصيلة؟")) return;
    const res = await fetch(`/api/admin/deliveries/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error);
      return;
    }
    setMsg("تم إلغاء التوصيلة");
    loadDeliveries();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        جارٍ التحميل...
      </div>
    );
  }

  const activeDeliveries = deliveries.filter((d) => d.status !== "delivered" && d.status !== "cancelled");
  const completedDeliveries = deliveries.filter((d) => d.status === "delivered" || d.status === "cancelled");

  return (
    <main className="flex-1 flex flex-col gap-4 p-4 max-w-6xl mx-auto w-full">
      {msg && <div className="card bg-blue-50 border-blue-200 text-sm">{msg}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card flex flex-col items-center justify-center py-4 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">{activeDeliveries.length}</span>
          <span className="text-xs text-[var(--color-muted)] font-medium">توصيلات نشطة</span>
        </div>
        <div className="card flex flex-col items-center justify-center py-4 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {deliveries.filter((d) => d.status === "pending").length}
          </span>
          <span className="text-xs text-[var(--color-muted)] font-medium">قيد الانتظار</span>
        </div>
        <div className="card flex flex-col items-center justify-center py-4 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {deliveries.filter((d) => d.status === "in_transit").length}
          </span>
          <span className="text-xs text-[var(--color-muted)] font-medium">في الطريق</span>
        </div>
        <div className="card flex flex-col items-center justify-center py-4 text-center">
          <span className="text-2xl font-bold text-[var(--color-primary)]">
            {drivers.filter((d) => d.location?.is_online).length}
          </span>
          <span className="text-xs text-[var(--color-muted)] font-medium">سائقون متصلون</span>
        </div>
      </div>

      {/* Map Toggle */}
      {activeDeliveries.some((d) => d.customer_lat && d.customer_lng) && (
        <button
          onClick={() => setShowMap(!showMap)}
          className="btn-outline flex items-center justify-center gap-2 py-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          {showMap ? "إخفاء الخريطة" : "عرض الخريطة"}
        </button>
      )}

      {/* Map View */}
      {showMap && (
        <div className="card p-0 overflow-hidden" style={{ height: "400px" }}>
          <MapContainer
            center={[24.7136, 46.6753]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {activeDeliveries.map((d) =>
              d.customer_lat && d.customer_lng ? (
                <Marker
                  key={`customer-${d.id}`}
                  position={[d.customer_lat, d.customer_lng]}
                  icon={customerIcon}
                >
                  <Popup>
                    <div className="p-2">
                      <strong>العميل:</strong> {d.customer_name ?? d.customer_phone}
                      <br />
                      <strong>الحالة:</strong> {STATUS_LABELS[d.status]}
                      {d.driver && (
                        <>
                          <br />
                          <strong>السائق:</strong> {d.driver.name}
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
            {drivers.map((driver) =>
              driver.location ? (
                <CircleMarker
                  key={`driver-${driver.id}`}
                  center={[driver.location.lat, driver.location.lng]}
                  radius={8}
                  color={driver.location.is_online ? "#22c55e" : "#ef4444"}
                  fillColor={driver.location.is_online ? "#22c55e" : "#ef4444"}
                  fillOpacity={0.8}
                >
                  <Popup>
                    <div className="p-2">
                      <strong>السائق:</strong> {driver.name}
                      <br />
                      <strong>الحالة:</strong> {driver.location.is_online ? "متصل" : "غير متصل"}
                      {driver.location.last_seen_at && (
                        <>
                          <br />
                          <strong>آخر ظهور:</strong>{" "}
                          {new Date(driver.location.last_seen_at).toLocaleTimeString("ar-EG")}
                        </>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null
            )}
          </MapContainer>
        </div>
      )}

      {/* Create New Delivery Form */}
      <form onSubmit={handleCreateDelivery} className="card flex flex-col gap-3">
        <h2 className="font-bold">إنشاء توصيلة جديدة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="field"
            placeholder="رقم هاتف العميل *"
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value)}
            required
          />
          <input
            className="field"
            placeholder="اسم العميل"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />
        </div>
        <input
          className="field"
          placeholder="العنوان"
          value={newCustomerAddress}
          onChange={(e) => setNewCustomerAddress(e.target.value)}
        />
        <select
          className="field"
          value={newDriverId}
          onChange={(e) => setNewDriverId(e.target.value)}
        >
          <option value="">تعيين سائق (اختياري)</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.location?.is_online ? "(متصل)" : ""}
            </option>
          ))}
        </select>
        <textarea
          className="field"
          placeholder="ملاحظات"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
        />
        <button className="btn-primary" disabled={creating}>
          {creating ? "جارٍ الإنشاء..." : "إنشاء التوصيلة"}
        </button>
      </form>

      {/* Active Deliveries */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">التوصيلات النشطة ({activeDeliveries.length})</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            إظهار المكتملة
          </label>
        </div>
        <div className="flex flex-col gap-3">
          {activeDeliveries.map((d) => (
            <div
              key={d.id}
              className={`border rounded-lg p-3 ${selectedDelivery?.id === d.id ? "border-[var(--color-primary)] bg-blue-50" : "border-[var(--color-border)]"}`}
              onClick={() => setSelectedDelivery(d)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                      {STATUS_LABELS[d.status]}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]" dir="ltr">
                      {d.customer_phone}
                    </span>
                  </div>
                  {d.customer_name && <p className="font-medium">{d.customer_name}</p>}
                  {d.customer_address && <p className="text-sm text-[var(--color-muted)]">{d.customer_address}</p>}
                  {d.note && <p className="text-sm text-[var(--color-muted)] mt-1">{d.note}</p>}
                  {d.driver && (
                    <p className="text-sm text-[var(--color-primary)] mt-1">
                      السائق: {d.driver.name} {d.driver.is_online ? "●" : "○"}
                    </p>
                  )}
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {new Date(d.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {!d.driver && d.status === "pending" && (
                    <select
                      className="text-xs field py-1"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          assignDriver(d.id, e.target.value);
                          e.stopPropagation();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">تعيين سائق</option>
                      {drivers.filter((drv) => drv.location?.is_online).map((drv) => (
                        <option key={drv.id} value={drv.id}>
                          {drv.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {d.status === "assigned" && d.driver && (
                    <button
                      className="text-xs btn-outline py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDeliveryStatus(d.id, "picked_up", d.driver_id ?? undefined);
                      }}
                    >
                      تم الاستلام
                    </button>
                  )}
                  {d.status === "picked_up" && (
                    <button
                      className="text-xs btn-primary py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDeliveryStatus(d.id, "in_transit", d.driver_id ?? undefined);
                      }}
                    >
                      في الطريق
                    </button>
                  )}
                  {d.status === "in_transit" && (
                    <button
                      className="text-xs btn-primary py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateDeliveryStatus(d.id, "delivered", d.driver_id ?? undefined);
                      }}
                    >
                      تم التسليم
                    </button>
                  )}
                  <button
                    className="text-xs text-[var(--color-destructive)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelDelivery(d.id);
                    }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          ))}
          {activeDeliveries.length === 0 && (
            <p className="text-sm text-[var(--color-muted)] text-center py-4">لا توجد توصيلات نشطة</p>
          )}
        </div>
      </div>

      {/* Completed Deliveries (if enabled) */}
      {includeCompleted && completedDeliveries.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-lg mb-3">التوصيلات المكتملة ({completedDeliveries.length})</h2>
          <div className="flex flex-col gap-2">
            {completedDeliveries.slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-2 last:border-0">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                    {STATUS_LABELS[d.status]}
                  </span>
                  <span className="mr-2" dir="ltr">{d.customer_phone}</span>
                  {d.customer_name && <span className="text-[var(--color-muted)]">{d.customer_name}</span>}
                </div>
                <span className="text-xs text-[var(--color-muted)]">
                  {d.delivered_at ? new Date(d.delivered_at).toLocaleDateString("ar-EG") : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
