const { test, expect } = require('@playwright/test');

test.describe('Allocation Wizard Styling', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Login
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 })) {
      await emailInput.fill('test@test.test');
      await page.locator('input[type="password"]').fill('test1234');
      await page.locator('button[type="submit"]').click();

      // Wait for navigation away from login page (auth redirect)
      await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(async () => {
        // If not auto-redirected to dashboard, wait for any navigation
        await page.waitForTimeout(3000);
      });
    }

    // Make sure we're on the dashboard
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load
  });

  test('wizard-step text color matches wizard-header color', async ({ page }) => {
    await page.screenshot({ path: 'test-results/dashboard-state.png' });

    // Check current page - if still on login, skip
    const url = page.url();
    console.log('Current URL:', url);

    if (url.includes('login') || await page.locator('input[type="email"]').isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Still on login page. Skipping.');
      test.skip();
      return;
    }

    // The allocate button only shows when remaining_budget > 0
    const allocateBtn = page.locator('button:has-text("Allocate Savings")');
    const btnVisible = await allocateBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!btnVisible) {
      console.log('Allocate button not visible. Trying January 2026...');

      // Try changing month via MonthPicker
      const monthBtn = page.locator('.month-picker-toggle, .month-trigger, button:has-text("February"), button:has-text("Jan"), button:has-text("2026")').first();
      if (await monthBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monthBtn.click();
        await page.waitForTimeout(500);
        const janBtn = page.locator('button:has-text("Jan")').first();
        if (await janBtn.isVisible().catch(() => false)) {
          await janBtn.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
      }

      const btnVisibleRetry = await allocateBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (!btnVisibleRetry) {
        await page.screenshot({ path: 'test-results/dashboard-no-allocate.png' });
        console.log('Allocate button still not visible.');
        test.skip();
        return;
      }
    }

    await allocateBtn.click();

    const modal = page.locator('.wizard-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/wizard-step1.png' });

    // Get the header text color
    const headerColor = await page.locator('.wizard-header h2').evaluate(
      el => getComputedStyle(el).color
    );

    // Get the wizard-step h3 text color
    const stepH3Color = await page.locator('.wizard-step h3').evaluate(
      el => getComputedStyle(el).color
    );

    // Get a surplus-row label color
    const surplusLabelColor = await page.locator('.surplus-row span:first-child').first().evaluate(
      el => getComputedStyle(el).color
    );

    // Get the surplus-total label color
    const surplusTotalColor = await page.locator('.surplus-total span:first-child').evaluate(
      el => getComputedStyle(el).color
    );

    console.log('Header h2 color:', headerColor);
    console.log('Step h3 color:', stepH3Color);
    console.log('Surplus label color:', surplusLabelColor);
    console.log('Surplus total color:', surplusTotalColor);

    // All non-accent text should be the same pure white
    expect(stepH3Color).toBe(headerColor);
    expect(surplusLabelColor).toBe(headerColor);
    expect(surplusTotalColor).toBe(headerColor);
    expect(headerColor).toBe('rgb(255, 255, 255)');
  });

  test('step 1 modal has wizard-wide class and adequate width', async ({ page }) => {
    const url = page.url();
    if (url.includes('login') || await page.locator('input[type="email"]').isVisible({ timeout: 1000 }).catch(() => false)) {
      test.skip();
      return;
    }

    const allocateBtn = page.locator('button:has-text("Allocate Savings")');
    if (!(await allocateBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await allocateBtn.click();

    const modal = page.locator('.wizard-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(modal).toHaveClass(/wizard-wide/);

    const step1Width = await modal.evaluate(el => el.getBoundingClientRect().width);
    console.log('Step 1 modal width:', step1Width);
    expect(step1Width).toBeGreaterThanOrEqual(700);
  });

  test('accent colors are preserved (green income, red expense)', async ({ page }) => {
    const url = page.url();
    if (url.includes('login') || await page.locator('input[type="email"]').isVisible({ timeout: 1000 }).catch(() => false)) {
      test.skip();
      return;
    }

    const allocateBtn = page.locator('button:has-text("Allocate Savings")');
    if (!(await allocateBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await allocateBtn.click();

    const modal = page.locator('.wizard-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const incomeEl = page.locator('.surplus-income');
    if (await incomeEl.count() > 0) {
      const incomeColor = await incomeEl.first().evaluate(el => getComputedStyle(el).color);
      console.log('Income color:', incomeColor);
      expect(incomeColor).toBe('rgb(34, 197, 94)');
    }

    const expenseEl = page.locator('.surplus-expense');
    if (await expenseEl.count() > 0) {
      const expenseColor = await expenseEl.first().evaluate(el => getComputedStyle(el).color);
      console.log('Expense color:', expenseColor);
      expect(expenseColor).toBe('rgb(244, 63, 94)');
    }
  });
});
