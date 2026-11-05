import { t } from '../i18n';

export const SHORTCUTS = [
  { id: 'undo', keys: 'Ctrl+Z', labelKey: 'shortcuts.undo', label: 'Hoàn tác thao tác gần nhất' },
  {
    id: 'redo',
    keys: 'Ctrl+Shift+Z / Ctrl+Y',
    labelKey: 'shortcuts.redo',
    label: 'Làm lại thao tác vừa hoàn tác',
  },
  { id: 'zen', keys: 'H', labelKey: 'shortcuts.zen', label: 'Chế độ điện ảnh (Ẩn/hiện thanh Dock)' },
  { id: 'help', keys: '?', labelKey: 'shortcuts.help', label: 'Danh sách phím tắt' },
] as const;

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

export function getLocalizedShortcuts() {
  return SHORTCUTS.map((s) => ({
    ...s,
    label: t(s.labelKey),
  }));
}
