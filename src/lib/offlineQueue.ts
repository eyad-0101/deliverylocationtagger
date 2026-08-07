"use client";

// Simple offline-first queue for tag submissions. When a driver is in a
// low-connectivity area, tags are saved to localStorage immediately and
// flushed to the server the moment the browser comes back online.

export type PendingTag = {
  localId: string;
  customerPhone: string;
  customerName?: string;
  lat: number;
  lng: number;
  note?: string;
  label?: string;
  queuedAt: number;
};

const STORAGE_KEY = "pending_tags_queue";

export function getQueue(): PendingTag[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingTag[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueTag(tag: Omit<PendingTag, "localId" | "queuedAt">) {
  const queue = getQueue();
  const entry: PendingTag = {
    ...tag,
    localId: crypto.randomUUID(),
    queuedAt: Date.now(),
  };
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

export function removeFromQueue(localId: string) {
  const queue = getQueue().filter((t) => t.localId !== localId);
  saveQueue(queue);
}

// Attempts to send every queued tag. Successfully-sent tags are removed;
// failures stay queued for the next attempt.
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const queue = getQueue();
  let sent = 0;
  let failed = 0;

  for (const tag of queue) {
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPhone: tag.customerPhone,
          customerName: tag.customerName,
          lat: tag.lat,
          lng: tag.lng,
          note: tag.note,
          label: tag.label,
        }),
      });
      if (res.ok) {
        removeFromQueue(tag.localId);
        sent++;
      } else {
        failed++;
      }
    } catch {
      // Still offline or request failed — leave it queued.
      failed++;
    }
  }

  return { sent, failed };
}

export function setupAutoSync(
  onSynced?: (result: { sent: number; failed: number }) => void,
  onSyncingChange?: (syncing: boolean) => void
) {
  if (typeof window === "undefined") return () => {};

  const handler = async () => {
    if (navigator.onLine && getQueue().length > 0) {
      onSyncingChange?.(true);
      const result = await flushQueue();
      onSyncingChange?.(false);
      if (result.sent > 0) onSynced?.(result);
    }
  };

  window.addEventListener("online", handler);
  // Also try once on mount in case we're already online with a stale queue.
  handler();

  return () => window.removeEventListener("online", handler);
}

// Roughly 25 meters — close enough that two queued tags at "the same spot"
// are almost certainly the driver forgetting to move the map pin between
// two different customers, rather than two customers who genuinely live
// right next to each other (that's rarer, and this is just a heads-up, not
// a hard block).
const DUPLICATE_THRESHOLD_DEGREES = 0.00025;

export type DuplicateGroup = { lat: number; lng: number; phones: string[] };

/**
 * Finds queued tags that share (almost) the same coordinates but were
 * saved under different customer phone numbers — a strong signal the
 * picker pin wasn't moved before the second save. Surfaced as a warning
 * in the UI before these sync, not blocked automatically, since it's a
 * heuristic and could be a false positive (neighbors).
 */
export function findDuplicateLocations(queue: PendingTag[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  for (const tag of queue) {
    const existing = groups.find(
      (g) =>
        Math.abs(g.lat - tag.lat) < DUPLICATE_THRESHOLD_DEGREES &&
        Math.abs(g.lng - tag.lng) < DUPLICATE_THRESHOLD_DEGREES
    );
    if (existing) {
      if (!existing.phones.includes(tag.customerPhone)) {
        existing.phones.push(tag.customerPhone);
      }
    } else {
      groups.push({ lat: tag.lat, lng: tag.lng, phones: [tag.customerPhone] });
    }
  }

  return groups.filter((g) => g.phones.length > 1);
}
