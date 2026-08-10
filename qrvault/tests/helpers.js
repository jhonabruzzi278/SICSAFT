export async function resetApp(page) {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('qrvault-inventory'));
  await page.reload();
  await page.waitForTimeout(500);
}

export async function scanCode(page, code) {
  await page.fill('[data-testid="manual-code-input"]', code);
  await page.click('[data-testid="manual-code-btn"]');
}
