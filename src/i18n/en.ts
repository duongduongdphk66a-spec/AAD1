import type { vi } from './vi';

export const en: Record<keyof typeof vi, string> = {
  'toast.undone': 'Undone: "{label}" ({n} undo steps remaining).',
  'toast.deletedObject': 'Removed object from map (Press Undo to restore).',
  'toast.sdfEnabled': 'SDF Outline enabled: Showing live SDF collision volume for selected object.',
  'toast.sdfDisabled': 'SDF Outline disabled.',
  'quality.label': 'Quality',
  'quality.auto': 'Auto',
  'quality.high': 'High',
  'quality.low': 'Low',
  'touch.navigate': 'Navigate',
  'touch.sculpt': 'Sculpt',
  'shortcuts.title': 'Keyboard Shortcuts',
  'shortcuts.close': 'Close (Esc)',
};
