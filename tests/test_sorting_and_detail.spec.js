const { test, expect } = require('@playwright/test');

test.describe('Transaction Sorting and Detail Modal', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('http://localhost:3001');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password');
        await page.click('button[type="submit"]');

        // Wait a bit for login to complete
        await page.waitForTimeout(2000);

        // Navigate directly to transactions page
        await page.goto('http://localhost:3001/transactions');
        await page.waitForLoadState('networkidle');
    });

    test('should have sort dropdown with all options', async ({ page }) => {
        // Check if sort dropdown exists
        const sortSelect = page.locator('select.sort-select');
        await expect(sortSelect).toBeVisible();

        // Verify all sort options are present
        const options = await sortSelect.locator('option').allTextContents();
        expect(options).toContain('Newest First');
        expect(options).toContain('Oldest First');
        expect(options).toContain('Highest Amount');
        expect(options).toContain('Lowest Amount');
        expect(options).toContain('Name (A-Z)');
        expect(options).toContain('Name (Z-A)');

        console.log('✅ Sort dropdown has all options');
    });

    test('should change sort order when selecting option', async ({ page }) => {
        const sortSelect = page.locator('select.sort-select');

        // Select "Oldest First"
        await sortSelect.selectOption('date-asc');
        await page.waitForTimeout(1000);

        // Get first transaction date
        const firstTxDate = await page.locator('.tx-row .tx-date').first().textContent();
        console.log('First transaction date (oldest first):', firstTxDate);

        // Select "Newest First"
        await sortSelect.selectOption('date-desc');
        await page.waitForTimeout(1000);

        // Get first transaction date
        const firstTxDateNew = await page.locator('.tx-row .tx-date').first().textContent();
        console.log('First transaction date (newest first):', firstTxDateNew);

        // Dates should be different
        expect(firstTxDate).not.toBe(firstTxDateNew);

        console.log('✅ Sorting changes transaction order');
    });

    test('should open transaction detail modal when clicking row', async ({ page }) => {
        // Wait for transactions to load
        await page.waitForSelector('.tx-row', { timeout: 5000 });

        // Click first transaction row (but not on checkbox or select)
        const firstRow = page.locator('.tx-row').first();
        const txDescription = await firstRow.locator('.tx-desc').first();
        await txDescription.click();

        // Wait for inspector panel to open
        await page.waitForTimeout(500);

        // Check if inspector panel is visible
        const inspectorPanel = page.locator('.inspector-panel');
        await expect(inspectorPanel).toBeVisible();

        // Check if title is "Transaction Details"
        const title = await inspectorPanel.locator('h2').textContent();
        expect(title).toBe('Transaction Details');

        // Check if detail rows are present
        const detailRows = inspectorPanel.locator('.detail-row');
        const rowCount = await detailRows.count();
        expect(rowCount).toBeGreaterThan(3); // At least date, description, type, amount

        console.log('✅ Transaction detail modal opens with', rowCount, 'detail rows');

        // Close the panel
        await inspectorPanel.locator('button.close-btn').click();
        await page.waitForTimeout(300);
        await expect(inspectorPanel).not.toBeVisible();

        console.log('✅ Inspector panel can be closed');
    });

    test('should show transaction details with proper formatting', async ({ page }) => {
        // Wait for transactions to load
        await page.waitForSelector('.tx-row', { timeout: 5000 });

        // Click first transaction
        const txDescription = await page.locator('.tx-row').first().locator('.tx-desc').first();
        await txDescription.click();
        await page.waitForTimeout(500);

        // Check for amount hero section
        const heroAmount = page.locator('.detail-hero .hero-value');
        await expect(heroAmount).toBeVisible();
        const amountText = await heroAmount.textContent();
        console.log('Transaction amount:', amountText);

        // Should contain + or - and CZK/EUR
        expect(amountText).toMatch(/[+-]/);
        expect(amountText).toMatch(/CZK|EUR/);

        console.log('✅ Transaction detail shows formatted amount');
    });

    test('should not open detail when clicking checkbox or select', async ({ page }) => {
        // Wait for transactions to load
        await page.waitForSelector('.tx-row', { timeout: 5000 });

        // Click checkbox
        const checkbox = page.locator('.tx-checkbox-btn').first();
        await checkbox.click();
        await page.waitForTimeout(300);

        // Inspector should NOT be visible
        const inspectorPanel = page.locator('.inspector-panel');
        await expect(inspectorPanel).not.toBeVisible();

        console.log('✅ Clicking checkbox does not open detail modal');
    });
});
