export type LocationPoint = {
  lat: number;
  lng: number;
  recordedAt: string; // ISO timestamp
};

// Two different kinds of "gap" end a trip:
//  1. A reporting gap — pings stop arriving (tab closed, app backgrounded,
//     lost connection) for longer than this. The dashboard pings every
//     ~20s while open, so anything past a couple of missed pings means
//     the driver genuinely stopped this trip rather than just hit one bad
//     GPS fix.
const REPORTING_GAP_SECONDS = 8 * 60;
//  2. A stationary gap — pings keep arriving (app still open) but the
//     driver hasn't actually moved, e.g. they're parked making a
//     delivery. GPS drifts a little even standing still, so a small
//     movement threshold filters that noise out rather than treating it
//     as "moving."
const MOVE_THRESHOLD_METERS = 25;
const STATIONARY_GAP_SECONDS = 5 * 60;

// Points more than this old are never considered at all, regardless of
// gaps — keeps a stale multi-day-old history row (if pruning ever lagged)
// from ever being drawn as if it were today's trip.
const MAX_TRAIL_AGE_HOURS = 12;

function haversineMeters(a: LocationPoint, b: LocationPoint) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Takes a driver's raw location history (any order) and returns just the
// points belonging to their current, still-in-progress trip — i.e. since
// the last time they were either offline or parked for a while.
export function currentTripFromHistory(rawPoints: LocationPoint[]): LocationPoint[] {
  const cutoff = Date.now() - MAX_TRAIL_AGE_HOURS * 3600 * 1000;
  const points = rawPoints
    .filter((p) => new Date(p.recordedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (points.length === 0) return [];

  let tripStart = 0;
  let lastMovingTime = new Date(points[0].recordedAt).getTime();

  for (let i = 1; i < points.length; i++) {
    const prevTime = new Date(points[i - 1].recordedAt).getTime();
    const time = new Date(points[i].recordedAt).getTime();
    const gapSeconds = (time - prevTime) / 1000;

    if (gapSeconds > REPORTING_GAP_SECONDS) {
      tripStart = i;
      lastMovingTime = time;
      continue;
    }

    const dist = haversineMeters(points[i - 1], points[i]);
    if (dist > MOVE_THRESHOLD_METERS) {
      lastMovingTime = time;
    } else if ((time - lastMovingTime) / 1000 > STATIONARY_GAP_SECONDS) {
      // Been idle too long — trim the trip forward. Kept updating on
      // every still-idle point rather than breaking out, so once movement
      // resumes the trip correctly starts right there.
      tripStart = i;
    }
  }

  return points.slice(tripStart);
}
