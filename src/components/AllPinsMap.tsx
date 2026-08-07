"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons in Next.js/Webpack
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Initialize Supabase Client (Client-side only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LocationTag {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  notes?: string;
  driver_id?: string;
  created_at: string;
}

// Component to handle map view updates
function MapUpdater({ center }: { center: [number, number] }) {
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
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>([20, 0]); // Default world view

  useEffect(() => {
    // 1. Fetch initial data
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from("location_tags")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setLocations(data);
          // Center map on the latest location if available
          setCenter([data[0].latitude, data[0].longitude]);
        } else {
          // Default to a central location if no data (e.g., Middle East or World)
          setCenter([25.0, 55.0]);
        }
      } catch (error) {
        console.error("Error fetching locations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel("public:location_tags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "location_tags" },
        (payload) => {
          console.log("Realtime change received:", payload);

          if (payload.eventType === "INSERT") {
            setLocations((prev) => [payload.new as LocationTag, ...prev]);
            // Optional: Auto-center on new pin
            // setCenter([payload.new.latitude, payload.new.longitude]);
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

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap Tiles (Free, No Key Required) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater center={center} />

        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-sm">Delivery Location</h3>
                <p className="text-xs text-gray-600">
                  ID: {loc.id.slice(0, 8)}
                </p>
                {loc.address && <p className="text-sm mt-1">{loc.address}</p>}
                {loc.notes && (
                  <p className="text-sm mt-1 italic">"{loc.notes}"</p>
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
