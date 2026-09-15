import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the landing layout checks.',
  );
});

// Feature grid columns per width: 3 -> 2 at 960px -> 1 at 620px.
const VIEWPORTS = [
  { width: 1920, height: 1080, columns: 3 },
  { width: 1440, height: 900, columns: 3 },
  { width: 1024, height: 768, columns: 3 },
  { width: 961, height: 800, columns: 3 },
  { width: 960, height: 800, columns: 2 },
  { width: 768, height: 1024, columns: 2 },
  { width: 621, height: 900, columns: 2 },
  { width: 620, height: 900, columns: 1 },
  { width: 480, height: 800, columns: 1 },
  { width: 375, height: 812, columns: 1 },
  { width: 320, height: 568, columns: 1 },
];

test.describe('landing layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`lays out cleanly at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForSelector('.landing-grid');

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(horizontalOverflow, 'no horizontal page overflow').toBeLessThanOrEqual(1);

      const columns = await page.evaluate(() => {
        const grid = document.querySelector('.landing-grid');
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      });
      expect(columns, 'feature grid columns').toBe(viewport.columns);

      await expect(page.locator('.landing-grid .landing-card')).toHaveCount(6);
      await expect(page.locator('.landing-hero__actions .landing-button--primary')).toBeVisible();
      await expect(page.locator('.landing-marquee')).toBeVisible();

      const cardBox = await page.locator('.landing-grid .landing-card').first().boundingBox();
      expect(cardBox, 'first card has a layout box').not.toBeNull();
      if (cardBox) {
        expect(cardBox.width, 'card fits the viewport').toBeLessThanOrEqual(viewport.width);
      }
    });
  }
});
