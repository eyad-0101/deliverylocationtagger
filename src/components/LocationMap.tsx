"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons reference image files that don't resolve
// correctly under bundlers like Turbopack/webpack — rebuild them from CDN
// URLs instead of the package's local asset paths.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const fadedIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "opacity-40",
});

const pickerIcon = L.divIcon({
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#EA580C;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>',
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const CAIRO_CENTER: [number, number] = [30.0444, 31.2357];

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  faded?: boolean;
  popup?: React.ReactNode;
  onClick?: () => void;
};

type Props = {
  pins: MapPin[];
  onMapClick?: (lat: number, lng: number) => void;
  pickerPin?: { lat: number; lng: number } | null;
  route?: [number, number][] | null;
  height?: string;
};

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({
  pins,
  pickerPin,
  route,
}: {
  pins: MapPin[];
  pickerPin?: { lat: number; lng: number } | null;
  route?: [number, number][] | null;
}) {
  const map = useMap();
  const didFit = useRef(false);
  const lastRouteLen = useRef(0);

  useEffect(() => {
    // Route changes should always re-fit, even after an initial fit already ran.
    if (route && route.length !== lastRouteLen.current) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      lastRouteLen.current = route.length;
      didFit.current = true;
      return;
    }

    if (didFit.current) return;
    if (pickerPin) {
      map.setView([pickerPin.lat, pickerPin.lng], 16);
      didFit.current = true;
    } else if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      didFit.current = true;
    }
  }, [map, pins, pickerPin, route]);

  return null;
}

export default function LocationMap({ pins, onMapClick, pickerPin, route, height = "360px" }: Props) {
  const center = useMemo<[number, number]>(() => {
    if (pickerPin) return [pickerPin.lat, pickerPin.lng];
    if (pins[0]) return [pins[0].lat, pins[0].lng];
    return CAIRO_CENTER;
  }, [pins, pickerPin]);

  return (
    <div style={{ height, borderRadius: "14px", overflow: "hidden" }}>
      <MapContainer
        center={center}
        zoom={pins.length || pickerPin ? 15 : 11}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={pins} pickerPin={pickerPin} route={route} />
        <ClickHandler onClick={onMapClick} />
        {route && route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: "#2563EB", weight: 5, opacity: 0.8 }} />
        )}
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={p.faded ? fadedIcon : defaultIcon}
            eventHandlers={p.onClick ? { click: () => p.onClick!() } : undefined}
          >
            {p.popup && <Popup>{p.popup}</Popup>}
          </Marker>
        ))}
        {pickerPin && (
          <Marker position={[pickerPin.lat, pickerPin.lng]} icon={pickerIcon} />
        )}
      </MapContainer>
    </div>
  );
}
