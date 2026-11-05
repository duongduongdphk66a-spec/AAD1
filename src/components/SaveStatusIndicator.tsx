import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { TerrainSaveStatus } from '../core/terrainV3Controller';

export interface SaveStatusIndicatorProps {
  status: TerrainSaveStatus;
  dirtyTiles?: number;
  onSyncNow?: () => void;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = React.memo(
  ({ status, dirtyTiles = 0, onSyncNow }) => {
    const isSaving = status === 'saving' || dirtyTiles > 0;

    return (
      <aside
        data-testid="save-status-indicator"
        data-save-status={isSaving ? 'saving' : 'saved'}
        aria-live="polite"
        aria-label="Trạng thái lưu bản đồ"
        onClick={onSyncNow}
        title={
          isSaving
            ? `Đang đồng bộ dữ liệu địa hình (${dirtyTiles} ô thay đổi chưa lưu)...`
            : 'Tất cả dữ liệu địa hình và cọ vẽ đã được đồng bộ an toàn'
        }
        className={`fixed bottom-2.5 left-2.5 z-30 pointer-events-auto rounded-xl bg-[#111927]/95 border shadow-xl px-2.5 py-1.5 text-slate-100 select-none flex items-center gap-2 transition-colors ${
          onSyncNow ? 'cursor-pointer hover:bg-slate-800/95' : ''
        } ${
          isSaving
            ? 'border-amber-500/70 text-amber-200'
            : 'border-slate-700/90 text-emerald-300'
        }`}
      >
        {isSaving ? (
          <Loader2
            data-testid="save-status-icon-saving"
            className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0"
          />
        ) : (
          <CheckCircle2
            data-testid="save-status-icon-saved"
            className="w-3.5 h-3.5 text-emerald-400 shrink-0"
          />
        )}

        <div className="flex items-center gap-1.5 text-[11px] font-medium leading-none">
          <span
            data-testid="save-status-label"
            className={isSaving ? 'text-amber-200 font-semibold' : 'text-emerald-300 font-semibold'}
          >
            {isSaving ? 'Đang lưu...' : 'Đã lưu'}
          </span>
          {dirtyTiles > 0 && (
            <span
              data-testid="save-status-dirty-count"
              className="font-mono text-[10px] text-amber-300/90 tabular-nums"
            >
              ({dirtyTiles} ô)
            </span>
          )}
        </div>
      </aside>
    );
  }
);
