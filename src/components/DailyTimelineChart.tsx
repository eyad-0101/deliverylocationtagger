"use client";

type DayCount = { date: string; count: number };

// Arabic weekday initials, indexed the way Date.getDay() returns (0=Sun).
const WEEKDAY_LABELS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

// No charting library — 30 bars is simple enough to hand-roll as SVG and
// keeps this dependency-free, consistent with the rest of the app (no
// Google Maps SDK, no auth library, etc.).
export default function DailyTimelineChart({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const barWidth = 20;
  const gap = 6;
  const chartHeight = 120;
  const width = days.length * (barWidth + gap);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={chartHeight + 34}
        viewBox={`0 0 ${width} ${chartHeight + 34}`}
        className="block"
      >
        {days.map((d, i) => {
          const barHeight = (d.count / max) * (chartHeight - 8);
          const x = i * (barWidth + gap);
          const y = chartHeight - barHeight;
          const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <g key={d.date}>
              <title>
                {d.date} — {d.count} موقع
              </title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, d.count > 0 ? 3 : 1)}
                rx={3}
                fill={isToday ? "#EA580C" : d.count > 0 ? "#2563EB" : "#E5E7EB"}
              />
              {d.count > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#6B7280"
                >
                  {d.count}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#9CA3AF"
              >
                {WEEKDAY_LABELS[dow]}
              </text>
              {(i % 5 === 0 || i === days.length - 1) && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 28}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9CA3AF"
                >
                  {formatDayLabel(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
