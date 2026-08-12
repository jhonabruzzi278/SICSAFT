export async function identifyOperator(page, operator = 'Operador Test') {
  await page.fill('[data-testid="operator-name-input"]', operator);
  await page.click('[data-testid="operator-continue-btn"]');
}

export async function selectOrgAreaLocation(
  page,
  { organizationId = 'org-001', areaId = 'area-001', locationId = 'loc-001' } = {},
) {
  await page.click('[data-testid="organization-select"]');
  await page.click(`[data-testid="organization-option-${organizationId}"]`);

  await page.click('[data-testid="area-select"]');
  await page.click(`[data-testid="area-option-${areaId}"]`);

  await page.click('[data-testid="location-select"]');
  await page.click(`[data-testid="location-option-${locationId}"]`);

  await page.click('[data-testid="area-location-continue-btn"]');
}

// El operador persiste entre pantallas (localStorage), pero organización/área/
// ubicación se re-piden cada vez que ScanPage se monta — ver plan de TASK-004.
export async function completeSessionSetup(page, opts = {}) {
  await identifyOperator(page, opts.operator);
  await selectOrgAreaLocation(page, opts);
}

export async function resetApp(page) {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('qrvault-inventory'));
  await page.reload();
  await page.waitForTimeout(500);
  await completeSessionSetup(page);
}

export async function scanCode(page, code) {
  await page.fill('[data-testid="manual-code-input"]', code);
  await page.click('[data-testid="manual-code-btn"]');
}
