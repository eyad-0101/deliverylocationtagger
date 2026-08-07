"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { createClient } from "@supabase/supabase-js";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon in Next.js/Webpack
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationTag {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  notes?: string;
  driver_id: string;
  created_at: string;
}

interface DriverNameCache {
  [key: string]: string;
}

// Initialize Supabase Client (Client-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.flyTo(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function AllPinsMap() {
  const [locations, setLocations] = useState<LocationTag[]>([]);
  const [driverNames, setDriverNames] = useState<DriverNameCache>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("location_tags")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLocations(data || []);

      // Fetch driver names for new IDs
      if (data && data.length > 0) {
        const uniqueIds = Array.from(new Set(data.map((d) => d.driver_id)));
        const newNames: DriverNameCache = { ...driverNames };

        for (const id of uniqueIds) {
          if (!newNames[id]) {
            const { data: userData } = await supabase
              .from("profiles") // Assuming table is named 'profiles' or 'users'
              .select("full_name, username")
              .eq("id", id)
              .single();

            newNames[id] =
              userData?.full_name || userData?.username || "Unknown Driver";
          }
        }
        setDriverNames(newNames);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();

    // REALTIME SUBSCRIPTION
    const channel = supabase
      .channel("public:location_tags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_tags" },
        (payload) => {
          console.log("Realtime change received:", payload);

          if (payload.eventType === "INSERT") {
            setLocations((prev) => [payload.new as LocationTag, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLocations((prev) =>
              prev.map((loc) =>
                loc.id === (payload.new as LocationTag).id
                  ? (payload.new as LocationTag)
                  : loc,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setLocations((prev) =>
              prev.filter((loc) => loc.id !== (payload.old as LocationTag).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const center: [number, number] = useMemo(() => {
    if (locations.length === 0) return [0, 0];
    const avgLat =
      locations.reduce((acc, loc) => acc + loc.latitude, 0) / locations.length;
    const avgLng =
      locations.reduce((acc, loc) => acc + loc.longitude, 0) / locations.length;
    return [avgLat, avgLng];
  }, [locations]);

  if (loading) return <div className="p-4">Loading map...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border border-gray-200 shadow-md">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController center={center} />

        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={markerIcon}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-lg mb-1">
                  {driverNames[loc.driver_id] || "Loading..."}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{loc.address}</p>
                {loc.notes && (
                  <p className="text-xs bg-gray-100 p-2 rounded mt-2">
                    <strong>Note:</strong> {loc.notes}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(loc.created_at).toLocaleString()}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
