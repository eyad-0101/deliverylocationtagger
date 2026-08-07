"use client"; // CRITICAL: Forces this component to run only in the browser

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { createClient } from "@supabase/supabase-js";

// Fix for default Leaflet marker icons in Next.js
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Initialize Supabase Client (Client-side only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface LocationTag {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  driver_name?: string;
  created_at: string;
}

// Component to update map view when new pins arrive
function MapUpdater({ locations }: { locations: LocationTag[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const latLngs = locations.map((loc) => [loc.latitude, loc.longitude]);
      const bounds = L.latLngBounds(latLngs as any);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);

  return null;
}

export default function AllPinsMap() {
  const [locations, setLocations] = useState<LocationTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial data
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("location_tags")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setLocations(data || []);
      } catch (err) {
        console.error("Error fetching locations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel("realtime-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_tags" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLocations((prev) => [payload.new as LocationTag, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLocations((prev) =>
              prev.map((loc) =>
                loc.id === payload.new.id ? (payload.new as LocationTag) : loc,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setLocations((prev) =>
              prev.filter((loc) => loc.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading Map...
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <MapContainer
        center={[24.7136, 46.6753]} // Default to Riyadh, adjust as needed
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        {/* Free OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater locations={locations} />

        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="p-2">
                <strong>Driver:</strong> {loc.driver_name || "Unknown"}
                <br />
                <strong>Address:</strong> {loc.address || "No address provided"}
                <br />
                <strong>Time:</strong>{" "}
                {new Date(loc.created_at).toLocaleTimeString()}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
