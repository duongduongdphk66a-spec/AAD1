export const SHORTCUTS = [
  { id: 'undo', keys: 'Ctrl+Z', label: 'Hoàn tác thao tác gần nhất' },
  { id: 'zen', keys: 'H', label: 'Chế độ điện ảnh (Ẩn/hiện thanh Dock)' },
  { id: 'help', keys: '?', label: 'Danh sách phím tắt' },
] as const;

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];
