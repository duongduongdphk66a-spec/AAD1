import React from 'react';
import { Ruler } from 'lucide-react';

interface DistanceScaleBarProps {
  metersPerPixel: number;
  cameraDistanceMeters: number;
  hoverCoords: { x: number; z: number } | null; // chỉ cần x, z (thanh thước không hiển thị độ cao)
}

const NICE_STEPS_METERS = [
  0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
];

function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)}km`;
  }
  if (meters < 1) {
    return `${Math.round(meters * 100)}cm`;
  }
  return `${meters}m`;
}

export const DistanceScaleBar: React.FC<DistanceScaleBarProps> = ({
  metersPerPixel,
  cameraDistanceMeters,
  hoverCoords,
}) => {
  const safeMpp = Math.max(0.005, metersPerPixel || 0.08);
  const targetMaxPx = 120;
  const maxMeters = safeMpp * targetMaxPx;

  let chosenStep = NICE_STEPS_METERS[0];
  for (const step of NICE_STEPS_METERS) {
    if (step <= maxMeters) {
      chosenStep = step;
    } else {
      break;
    }
  }

  const barWidthPx = Math.max(48, Math.min(132, Math.round(chosenStep / safeMpp)));
  const halfLabel = formatDistanceLabel(chosenStep / 2);
  const fullLabel = formatDistanceLabel(chosenStep);

  return (
    <aside
      data-testid="distance-scale-bar"
      aria-label="Thước khoảng cách thực tế"
      className="fixed bottom-2.5 right-2.5 z-30 pointer-events-auto w-[168px] rounded-xl bg-[#111927]/95 border border-slate-700/90 shadow-xl px-2.5 py-1.5 text-slate-100 select-none"
    >
      <div className="flex items-center justify-between text-[10px] text-slate-300 mb-0.5">
        <span className="font-semibold flex items-center gap-1 text-amber-300">
          <Ruler className="w-3 h-3 text-amber-400 shrink-0" />
          Thước 1:1
        </span>
        <span
          data-testid="scale-bar-label"
          className="font-mono font-bold text-[10px] text-emerald-300 tabular-nums"
        >
          {fullLabel} · Cam{' '}
          {cameraDistanceMeters >= 1000
            ? `${(cameraDistanceMeters / 1000).toFixed(1)}km`
            : `${Math.round(cameraDistanceMeters)}m`}
        </span>
      </div>

      {/* Crisp Vector SVG Graphic Ruler */}
      <div className="bg-[#0b111c] rounded-lg px-2 py-1 border border-slate-800 flex flex-col items-start">
        <div
          style={{ width: `${barWidthPx}px` }}
          className="flex items-center justify-between text-[9px] font-mono text-slate-300 tabular-nums leading-none mb-0.5"
        >
          <span>0</span>
          <span>{halfLabel}</span>
          <span className="text-amber-300 font-semibold">{fullLabel}</span>
        </div>

        <svg
          width={barWidthPx}
          height={8}
          viewBox={`0 0 ${barWidthPx} 8`}
          className="overflow-visible block"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke="#fbbf24" strokeWidth={1.75} />
          <rect
            x={1}
            y={2.5}
            width={Math.max(2, barWidthPx / 2 - 1)}
            height={3.5}
            fill="#fbbf24"
          />
          <line
            x1={barWidthPx / 2}
            y1={1}
            x2={barWidthPx / 2}
            y2={7}
            stroke="#38bdf8"
            strokeWidth={1.5}
          />
          <rect
            x={barWidthPx / 2}
            y={2.5}
            width={Math.max(2, barWidthPx / 2 - 1)}
            height={3.5}
            fill="#38bdf8"
          />
          <line
            x1={barWidthPx}
            y1={0}
            x2={barWidthPx}
            y2={8}
            stroke="#38bdf8"
            strokeWidth={1.75}
          />
        </svg>
      </div>

      {hoverCoords && (
        <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400 tabular-nums leading-none">
          <span className="text-cyan-300">62,5m/ô (161×161)</span>
          <span className="text-emerald-300">
            X:{hoverCoords.x.toFixed(0)} Z:{hoverCoords.z.toFixed(0)}m
          </span>
        </div>
      )}
    </aside>
  );
};
