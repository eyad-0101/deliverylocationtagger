// Route preview using OSRM's free public demo server. No API key needed.
// Note: the public demo server (router.project-osrm.org) is rate-limited
// and explicitly not meant for heavy production traffic — fine for a
// single-company internal tool with a modest number of drivers, but if
// usage grows, self-hosting OSRM (it's open source) is the next step.

export type RouteResult = {
  positions: [number, number][]; // [lat, lng] pairs for the polyline
  distanceMeters: number;
  durationSeconds: number;
};

export async function fetchRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("routing request failed");

  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("no route found");

  const positions: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );

  return {
    positions,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

export function googleMapsNavUrl(dest: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;
}

export function wazeNavUrl(dest: { lat: number; lng: number }) {
  return `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} كم` : `${Math.round(meters)} م`;
}

export function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs} س ${rem} د`;
}
