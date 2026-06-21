import { test, expect } from '@playwright/test';

test('shows the main app interface', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('heading', { name: 'Know-how Vault' })).toBeVisible();
  await expect(page.getByRole('button', { name: '収集' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ワークフロー' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ベストプラクティス' })).toBeVisible();
});
