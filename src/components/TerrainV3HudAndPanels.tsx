import React, { useSyncExternalStore } from 'react';
import { Link } from '../core/linkSystem';
import { Stamp } from '../core/stampSystem';
import { ADDRESSABLE_SAMPLES_L0, Level, spacing } from '../core/units';

export interface ResolutionHudProps {
  addressableSamples: number;
  residentTiles: number;
  residentMB: number;
  fineAreaKm2: number;
  activeLevels: number;
  fineActiveLevel: Level;
  visibleTriangles: number;
  pendingJobs: number;
  fps: number;
  uploadMs: number;
  softCapExceeded?: boolean;
  dirtyTiles?: number;
}

export interface BrushPanelProps {
  radiusMeters: number;
  targetLevel: Level;
  mbPerKm2: number;
  warningQuota80Pct: boolean;
}

export interface LinkPanelProps {
  snapEnabled: boolean;
  links: readonly Link[];
  onToggleSnap(v: boolean): void;
  onCreatePath(): void;
  onBakeUnion(linkId: string): void;
  onDeleteLink(linkId: string): void;
}

export interface StampInspectorProps {
  stamp: Stamp;
  onChangePadY(dy: number): void;
  onChangeFalloff(m: number): void;
  onChangeEmbedDepth(m: number): void;
  onChangeSmoothK(m: number): void;
  debugShowSdfOutline: boolean;
  onToggleDebugOutline?(v: boolean): void;
}

/**
 * Throttled external store (max 4 updates/sec = 250ms) so HUD telemetry never triggers
 * React re-renders of the 3D canvas or main application tree.
 */
class V3HudTelemetryStore {
  private snapshot: ResolutionHudProps = {
    addressableSamples: ADDRESSABLE_SAMPLES_L0,
    residentTiles: 0,
    residentMB: 1.5,
    fineAreaKm2: 0,
    activeLevels: 10,
    fineActiveLevel: 0,
    visibleTriangles: 131_072,
    pendingJobs: 0,
    fps: 60,
    uploadMs: 0.2,
    softCapExceeded: false,
    dirtyTiles: 0,
  };
  private listeners = new Set<() => void>();
  private lastEmitTime = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ResolutionHudProps => {
    return this.snapshot;
  };

  publish(partial: Partial<ResolutionHudProps>, force = false): void {
    const now = performance.now();
    this.snapshot = { ...this.snapshot, ...partial };
    if (force || now - this.lastEmitTime >= 250) {
      this.lastEmitTime = now;
      for (const fn of this.listeners) {
        fn();
      }
    }
  }
}

export const v3HudStore = new V3HudTelemetryStore();

export const ResolutionHudV3: React.FC<{
  v3Enabled: boolean;
  onToggleV3: (v: boolean) => void;
}> = React.memo(({ v3Enabled, onToggleV3 }) => {
  const stats = useSyncExternalStore(v3HudStore.subscribe, v3HudStore.getSnapshot);
  const fineStep = spacing(stats.fineActiveLevel);

  return (
    <div
      data-testid="v3-resolution-hud"
      className="pointer-events-auto rounded-lg bg-slate-950/85 border border-cyan-500/30 px-3 py-2 text-[11px] text-slate-200 shadow-lg backdrop-blur-md space-y-1 max-w-xs"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1">
        <span className="font-semibold text-cyan-300 tracking-wide uppercase">
          Địa hình Clipmap V3
        </span>
        <button
          type="button"
          onClick={() => onToggleV3(!v3Enabled)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
            v3Enabled
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
          title="Chuyển đổi giữa Clipmap V3 (10 tỷ mẫu ảo) và Lưới V2 (161×161)"
        >
          {v3Enabled ? 'V3 Đang Bật' : 'Chế Độ V2'}
        </button>
      </div>

      {v3Enabled ? (
        <div className="space-y-0.5 font-mono text-[10.5px] leading-snug">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Địa chỉ hóa được:</span>
            <span className="text-emerald-300 font-semibold">
              {stats.addressableSamples.toLocaleString('vi-VN')} mẫu (0,1 m)
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Đang lưu:</span>
            <span className="text-cyan-200">
              {stats.residentTiles} ô · {stats.residentMB.toFixed(1)} MB ·{' '}
              {stats.fineAreaKm2.toFixed(3)} km² ở 0,1 m
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Đang vẽ:</span>
            <span className="text-amber-200">
              {stats.activeLevels} mức LOD · mịn nhất {fineStep.toFixed(1).replace('.', ',')} m ·{' '}
              {Math.round(stats.visibleTriangles / 1000)}k Δ
            </span>
          </div>
          {stats.softCapExceeded && (
            <div
              data-testid="v3-soft-cap-warning"
              className="rounded bg-amber-500/20 border border-amber-400/40 px-1.5 py-0.5 text-[10px] text-amber-200 font-sans"
            >
              ⚠ Vượt mềm hạn mức 512 ô ({stats.residentTiles} ô, {stats.dirtyTiles ?? 0} chưa lưu) — đang chờ lưu tự động, không xóa dữ liệu
            </div>
          )}
          <div className="flex justify-between gap-2 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
            <span>Hàng đợi: {stats.pendingJobs}</span>
            <span>{Math.round(stats.fps)} FPS</span>
            <span>GPU: {stats.uploadMs.toFixed(2)} ms</span>
          </div>
        </div>
      ) : (
        <div className="text-[10.5px] text-slate-400">
          Đang chạy bộ kết xuất cổ điển 161×161 (62,5 m/ô). Bật V3 để kích hoạt 10 mức LOD Clipmap.
        </div>
      )}
    </div>
  );
});

export const BrushLevelBadgeV3: React.FC<BrushPanelProps> = React.memo(
  ({ radiusMeters, targetLevel, mbPerKm2, warningQuota80Pct }) => {
    const stepM = spacing(targetLevel);
    return (
      <div
        data-testid="v3-brush-badge"
        className="flex flex-wrap items-center gap-2 rounded bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 text-[11px] text-slate-200"
      >
        <span>
          Bán kính <strong>{radiusMeters.toFixed(1)} m</strong> → ghi vào mức{' '}
          <strong className="text-cyan-300">
            L{targetLevel} ({stepM >= 1 ? stepM.toFixed(1) : stepM.toFixed(1)} m/mẫu)
          </strong>
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-emerald-300 font-mono">
          {mbPerKm2 >= 10 ? Math.round(mbPerKm2) : mbPerKm2.toFixed(2)} MB/km²
        </span>
        {targetLevel === 0 && (
          <span className="text-amber-300 text-[10px]">
            (Cọ siêu mịn 10 cm — tối đa 0,25 km²)
          </span>
        )}
        {warningQuota80Pct && (
          <span className="text-rose-300 font-semibold text-[10px]">
            ⚠ Đã dùng &gt;80% hạn mức 0,1 m
          </span>
        )}
      </div>
    );
  }
);

export const LinkAndStampPopoverV3: React.FC<{
  linkProps: LinkPanelProps;
  stampProps: StampInspectorProps | null;
  onExportAtw: () => void;
}> = React.memo(({ linkProps, stampProps, onExportAtw }) => {
  return (
    <div
      data-testid="v3-link-stamp-panel"
      className="pointer-events-auto rounded-lg bg-slate-950/90 border border-slate-700/80 p-3 text-xs text-slate-200 shadow-xl backdrop-blur-md w-72 space-y-2.5"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="font-semibold text-cyan-300">Kết Nối &amp; Tem Nền SDF (V3)</span>
        <button
          type="button"
          onClick={onExportAtw}
          className="px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 text-[10.5px] transition"
          title="Xuất tệp nhị phân nén .atw (WorldSaveV3)"
        >
          Lưu .ATW
        </button>
      </div>

      {/* Socket Snap & Link Controls */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Hít khớp nối (Socket Snap):</span>
          <button
            type="button"
            onClick={() => linkProps.onToggleSnap(!linkProps.snapEnabled)}
            className={`px-2 py-0.5 rounded text-[10.5px] font-medium ${
              linkProps.snapEnabled
                ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {linkProps.snapEnabled ? 'Đang Bật' : 'Tắt'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={linkProps.onCreatePath}
            className="flex-1 py-1 px-2 rounded bg-cyan-600/30 hover:bg-cyan-600/45 border border-cyan-500/40 text-cyan-100 text-[11px] font-medium transition"
          >
            + Tạo đường nối Spline ({linkProps.links.length})
          </button>
        </div>

        {linkProps.links.length > 0 && (
          <div className="max-h-24 overflow-y-auto space-y-1 pr-1 border-t border-slate-800/80 pt-1">
            {linkProps.links.slice(0, 6).map((lnk) => (
              <div
                key={lnk.id}
                className="flex items-center justify-between bg-slate-900/90 px-2 py-1 rounded text-[10.5px]"
              >
                <span className="truncate max-w-[115px] text-slate-300" title={lnk.id}>
                  {lnk.kind.toUpperCase()} · {lnk.width.toFixed(1)}m
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => linkProps.onBakeUnion(lnk.id)}
                    className="px-1.5 py-0.5 rounded bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-400/40 text-[9.5px]"
                    title="Chốt hợp khối Boolean CSG (three-bvh-csg)"
                  >
                    Chốt CSG
                  </button>
                  <button
                    type="button"
                    onClick={() => linkProps.onDeleteLink(lnk.id)}
                    className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-[9.5px]"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stamp Inspector when an object is selected */}
      {stampProps && (
        <div className="border-t border-slate-800 pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-amber-300 text-[11px]">
              Tem Nền Vật Thể ({stampProps.stamp.shape.kind})
            </span>
            {stampProps.onToggleDebugOutline && (
              <button
                type="button"
                onClick={() =>
                  stampProps.onToggleDebugOutline!(!stampProps.debugShowSdfOutline)
                }
                className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                  stampProps.debugShowSdfOutline
                    ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                Viền SDF
              </button>
            )}
          </div>

          <label className="flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">Cao độ đệm (padY):</span>
            <input
              type="range"
              min={-5}
              max={10}
              step={0.2}
              value={stampProps.stamp.padY}
              onChange={(e) => stampProps.onChangePadY( parseFloat(e.target.value) )}
              className="w-28 accent-cyan-400"
            />
            <span className="w-10 text-right font-mono">
              {stampProps.stamp.padY.toFixed(1)}m
            </span>
          </label>

          <label className="flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">Bán kính chuyển (falloff):</span>
            <input
              type="range"
              min={0.5}
              max={25}
              step={0.5}
              value={stampProps.stamp.falloff}
              onChange={(e) => stampProps.onChangeFalloff(parseFloat(e.target.value))}
              className="w-28 accent-cyan-400"
            />
            <span className="w-10 text-right font-mono">
              {stampProps.stamp.falloff.toFixed(1)}m
            </span>
          </label>

          <label className="flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">Độ mượt giao (smoothK):</span>
            <input
              type="range"
              min={0.2}
              max={12}
              step={0.2}
              value={stampProps.stamp.smoothK}
              onChange={(e) => stampProps.onChangeSmoothK(parseFloat(e.target.value))}
              className="w-28 accent-cyan-400"
            />
            <span className="w-10 text-right font-mono">
              {stampProps.stamp.smoothK.toFixed(1)}m
            </span>
          </label>

          <label className="flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">Độ chôn móng (embed):</span>
            <input
              type="range"
              min={0}
              max={8}
              step={0.2}
              value={stampProps.stamp.embedDepth}
              onChange={(e) => stampProps.onChangeEmbedDepth(parseFloat(e.target.value))}
              className="w-28 accent-cyan-400"
            />
            <span className="w-10 text-right font-mono">
              {stampProps.stamp.embedDepth.toFixed(1)}m
            </span>
          </label>
        </div>
      )}
    </div>
  );
});
