import test from 'node:test';
import assert from 'node:assert/strict';
import { getLang, setLang, t } from './index';

test('i18n dictionary formats parameters and switches between vi and en cleanly', () => {
  setLang('vi');
  assert.equal(getLang(), 'vi');
  assert.equal(
    t('toast.undone', { label: 'Đặt Nhà Cối Xay', n: 3 }),
    'Đã hoàn tác: "Đặt Nhà Cối Xay" (3 bước hoàn tác còn lại).'
  );

  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(
    t('toast.undone', { label: 'Place Windmill', n: 3 }),
    'Undone: "Place Windmill" (3 undo steps remaining).'
  );

  // Restore default
  setLang('vi');
});
