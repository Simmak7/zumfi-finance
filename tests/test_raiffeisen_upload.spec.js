const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Raiffeisen Statement Upload', () => {
  const testFile = path.join('C:', 'zumfi', 'Zuzi docs', 'Vypis_1025785486_CZK_2026_001.pdf');

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3001');

    // Login if needed (adjust credentials)
    try {
      await page.click('text=Login', { timeout: 2000 });
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
    } catch (e) {
      // Already logged in or no login required
    }
  });

  test('should upload Raiffeisen statement and extract transactions', async ({ page }) => {
    // Navigate to Import page
    await page.goto('http://localhost:3001/import');
    await page.waitForLoadState('networkidle');

    // Upload file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);

    // Wait for upload to complete
    await page.waitForSelector('text=/Successfully imported \\d+ transactions/', { timeout: 30000 });

    // Check success message
    const successMessage = await page.textContent('.import-result, .success-message, .alert-success');
    console.log('Success message:', successMessage);

    // Extract transaction count from message
    const match = successMessage.match(/(\d+) transaction/);
    const transactionCount = match ? parseInt(match[1]) : 0;

    console.log(`Transactions extracted: ${transactionCount}`);

    // Verify we got transactions (should be 80-90)
    expect(transactionCount).toBeGreaterThan(70);
    expect(transactionCount).toBeLessThan(100);
  });

  test('should display transactions in DocumentList', async ({ page }) => {
    // Navigate to Import page
    await page.goto('http://localhost:3001/import');

    // Click on "View Documents" tab
    await page.click('text=View Documents');
    await page.waitForTimeout(1000);

    // Check for uploaded document
    const documentCards = await page.locator('.document-card');
    const count = await documentCards.count();

    expect(count).toBeGreaterThan(0);

    // Check transaction count badge
    const badge = await page.locator('.transaction-count-badge').first();
    const badgeText = await badge.textContent();

    console.log('Transaction count badge:', badgeText);
    expect(badgeText).toContain('transaction');

    // Extract number
    const transCount = parseInt(badgeText.match(/\d+/)[0]);
    expect(transCount).toBeGreaterThan(70);
  });

  test('should display transactions on dashboard by month', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');

    // Select January 2026 from month picker
    const monthSelect = await page.locator('select').first(); // Assuming month picker is first select
    await monthSelect.selectOption({ label: /January 2026|2026-01/ });

    await page.waitForTimeout(2000);

    // Check KPI cards
    const incomeCard = await page.locator('text=/Total Income|Income/').first();
    const expenseCard = await page.locator('text=/Total Expenses|Expenses/').first();

    expect(await incomeCard.isVisible()).toBeTruthy();
    expect(await expenseCard.isVisible()).toBeTruthy();

    // Check if amounts are displayed (not zero)
    const amounts = await page.locator('.kpi-value, .amount').allTextContents();
    console.log('Dashboard amounts:', amounts);

    // Should have some non-zero amounts
    const hasNonZero = amounts.some(amt => {
      const num = parseFloat(amt.replace(/[^\d.]/g, ''));
      return num > 0;
    });

    expect(hasNonZero).toBeTruthy();
  });

  test('should classify transactions correctly', async ({ page }) => {
    // Navigate to transactions page
    await page.goto('http://localhost:3001/transactions');
    await page.waitForLoadState('networkidle');

    // Check for transaction table
    const transactions = await page.locator('tr, .transaction-row').count();
    console.log(`Visible transactions: ${transactions}`);

    expect(transactions).toBeGreaterThan(0);

    // Check income transactions
    await page.click('text=/Income|Příjem/');
    await page.waitForTimeout(1000);

    const incomeTransactions = await page.locator('tr, .transaction-row').count();
    console.log(`Income transactions: ${incomeTransactions}`);
    expect(incomeTransactions).toBeGreaterThan(5); // Should have some income

    // Check expense transactions
    await page.click('text=/Expense|Výdaj|All/'); // Click All or Expenses
    await page.click('text=/Expense|Výdaj/');
    await page.waitForTimeout(1000);

    const expenseTransactions = await page.locator('tr, .transaction-row').count();
    console.log(`Expense transactions: ${expenseTransactions}`);
    expect(expenseTransactions).toBeGreaterThan(60); // Most should be expenses
  });
});
