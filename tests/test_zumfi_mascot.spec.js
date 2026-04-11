import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

// Helper: login and get to dashboard
async function loginAndNavigate(page) {
    await page.goto(BASE_URL);
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    // Wait for dashboard to load
    await page.waitForSelector('.zumfi-mascot', { timeout: 15000 });
}

test.describe('Zumfi Mascot Interactions', () => {
    test.beforeEach(async ({ page }) => {
        // Clear Zumfi position from localStorage so we start fresh
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.removeItem('zumfi_position');
            localStorage.removeItem('zumfi_prefs');
        });
        await loginAndNavigate(page);
    });

    test('should appear on the page at home position', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');
        await expect(mascot).toBeVisible();
        // Should have transform-based positioning (x/y motion values)
        const box = await mascot.boundingBox();
        expect(box).toBeTruthy();
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
    });

    test('should be draggable and stay at new position', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');
        const startBox = await mascot.boundingBox();

        // Drag Zumfi 200px to the right and 100px down
        await mascot.hover();
        await page.mouse.down();
        await page.mouse.move(startBox.x + startBox.width / 2 + 200, startBox.y + startBox.height / 2 + 100, { steps: 10 });
        await page.mouse.up();

        // Wait for drag to settle
        await page.waitForTimeout(300);

        const endBox = await mascot.boundingBox();
        // Should have moved significantly (at least 150px to account for elastic)
        expect(endBox.x - startBox.x).toBeGreaterThan(100);
        expect(endBox.y - startBox.y).toBeGreaterThan(50);
    });

    test('should return home on double-click (mascot)', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');
        const startBox = await mascot.boundingBox();
        const startX = startBox.x;
        const startY = startBox.y;

        // First drag Zumfi away from home
        await mascot.hover();
        await page.mouse.down();
        await page.mouse.move(startBox.x + startBox.width / 2 + 300, startBox.y + startBox.height / 2 - 200, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Verify Zumfi moved
        const draggedBox = await mascot.boundingBox();
        expect(Math.abs(draggedBox.x - startX)).toBeGreaterThan(100);

        // Double-click Zumfi to return home
        await mascot.dblclick();

        // Wait for animation (0.35s) + buffer
        await page.waitForTimeout(600);

        // Should be back near home position
        const homeBox = await mascot.boundingBox();
        expect(Math.abs(homeBox.x - startX)).toBeLessThan(20);
        expect(Math.abs(homeBox.y - startY)).toBeLessThan(20);
    });

    test('should return home on double-click (house icon)', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');
        const startBox = await mascot.boundingBox();
        const startX = startBox.x;
        const startY = startBox.y;

        // Drag Zumfi away
        await mascot.hover();
        await page.mouse.down();
        await page.mouse.move(startBox.x + startBox.width / 2 + 400, startBox.y + startBox.height / 2 - 150, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);

        // Verify moved
        const draggedBox = await mascot.boundingBox();
        expect(Math.abs(draggedBox.x - startX)).toBeGreaterThan(100);

        // Double-click the house icon
        const house = page.locator('.zumfi-home');
        await house.dblclick();

        // Wait for animation
        await page.waitForTimeout(600);

        // Should be back near home
        const homeBox = await mascot.boundingBox();
        expect(Math.abs(homeBox.x - startX)).toBeLessThan(20);
        expect(Math.abs(homeBox.y - startY)).toBeLessThan(20);
    });

    test('should show speech bubble on double-click home', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');

        // Double-click to trigger "Home sweet home!" speech
        await mascot.dblclick();
        await page.waitForTimeout(500);

        // Check for speech bubble
        const bubble = page.locator('.zumfi-speech');
        await expect(bubble).toBeVisible({ timeout: 3000 });
        const text = await bubble.textContent();
        expect(text).toContain('Home sweet home');
    });

    test('should play click animation on single click', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');

        // Single click on Zumfi
        await mascot.click();
        await page.waitForTimeout(200);

        // Mascot should still be visible (no crash)
        await expect(mascot).toBeVisible();
    });

    test('should consistently return to same position on repeated double-clicks', async ({ page }) => {
        const mascot = page.locator('.zumfi-mascot');

        // Get initial home position
        const homeBox = await mascot.boundingBox();

        // Drag away, double-click home, 3 times
        for (let i = 0; i < 3; i++) {
            // Drag to a random-ish position
            await mascot.hover();
            await page.mouse.down();
            await page.mouse.move(
                homeBox.x + 200 + i * 50,
                homeBox.y - 100 - i * 30,
                { steps: 8 }
            );
            await page.mouse.up();
            await page.waitForTimeout(300);

            // Double-click home
            await mascot.dblclick();
            await page.waitForTimeout(600);

            // Should be back at home
            const box = await mascot.boundingBox();
            expect(Math.abs(box.x - homeBox.x)).toBeLessThan(20);
            expect(Math.abs(box.y - homeBox.y)).toBeLessThan(20);
        }
    });
});
