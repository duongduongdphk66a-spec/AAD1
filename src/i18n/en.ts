import type { vi } from './vi';

export const en: Record<keyof typeof vi, string> = {
  'toast.undone': 'Undone: "{label}" ({n} undo steps remaining).',
  'toast.redone': 'Redone: "{label}" ({n} redo steps remaining).',
  'toast.deletedObject': 'Removed object from map (Press Undo to restore).',
  'toast.sdfEnabled': 'SDF Outline enabled: Showing live SDF collision volume for selected object.',
  'toast.sdfDisabled': 'SDF Outline disabled.',
  'autosave.storageNearlyFull': 'Browser storage is nearly full, please export .atw to back up.',
  'autosave.chunkQuotaWarning':
    'Warning: Edited {edited}/{max} terrain tiles (>80% storage ceiling) — please export .atw to back up.',
  'autosave.failed':
    'Session autosave failed (attempt {count}: {reason}) — Please export .ATW to avoid data loss.',
  'errorBoundary.defaultLabel': 'Application',
  'errorBoundary.titleSuffix': '{label} encountered an error',
  'errorBoundary.description':
    'Your latest action may not have been saved. You can try again, or reload the page if the error persists.',
  'errorBoundary.retry': 'Retry',
  'errorBoundary.reload': 'Reload page',
  'quality.label': 'Quality',
  'quality.auto': 'Auto',
  'quality.high': 'High',
  'quality.low': 'Low',
  'touch.navigate': 'Navigate',
  'touch.sculpt': 'Sculpt',
  'shortcuts.title': 'Keyboard Shortcuts',
  'shortcuts.close': 'Close (Esc)',
  'shortcuts.undo': 'Undo last action',
  'shortcuts.redo': 'Redo last undone action',
  'shortcuts.zen': 'Cinema mode (Toggle bottom dock)',
  'shortcuts.help': 'Keyboard shortcuts help',
};
