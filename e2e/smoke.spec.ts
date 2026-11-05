import { test, expect } from '@playwright/test';

test('khởi động sạch với CSP production, xuất .atw và xuất GLB', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await expect(page.getByTestId('world-dimensions-spec')).toHaveText('10×10 km');

  // Xuất .atw qua popover V3
  await page.getByTestId('toggle-v3-link-stamp-btn').click();
  const [atwDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-atw-v3-btn').click(),
  ]);
  expect(atwDownload.suggestedFilename()).toMatch(/\.atw$/);

  // Xuất GLB từ dock dưới (kiểm tra cả chunk three-bvh-csg/GLTFExporter nạp động)
  await page.getByTestId('dock-tab-world').click();
  const [glbDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-world-glb-btn').click(),
  ]);
  expect(glbDownload.suggestedFilename()).toMatch(/\.glb$/);

  expect(errors).toEqual([]);
});
