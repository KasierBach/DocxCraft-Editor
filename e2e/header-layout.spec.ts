import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the header layout checks.',
  );
});

// Below this width the header deliberately becomes two rows (identity, then
// toolbar). Above it everything fits on one row, and the mode picker lines up
// with the action buttons because both are single-line blocks.
const SINGLE_ROW_WIDTH = 1340;
const WIDE = [1920, 1600, 1512, 1440, 1366];
const NARROW = [SINGLE_ROW_WIDTH, 1280, 1024, 900, 768, 430, 320];

for (const width of [...WIDE, ...NARROW]) {
  test(`header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app');
    await page.waitForSelector('.topbar');

    const metrics = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: rect.top, height: rect.height, center: rect.top + rect.height / 2 };
      };
      const nameInput = document.querySelector('.document-name-input');
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        identity: box('.topbar__identity'),
        toolbar: box('.toolbar'),
        modePicker: box('.mode-picker'),
        actions: box('.toolbar__actions'),
        breadcrumbs: box('.breadcrumbs'),
        brand: box('.brand'),
        nameWidth: nameInput?.getBoundingClientRect().width ?? -1,
      };
    });

    expect(metrics.identity, 'header identity present').not.toBeNull();
    expect(metrics.toolbar, 'header toolbar present').not.toBeNull();
    expect(metrics.modePicker, 'mode picker present').not.toBeNull();
    expect(metrics.actions, 'toolbar actions present').not.toBeNull();
    expect(metrics.brand, 'brand present').not.toBeNull();
    expect(metrics.breadcrumbs, 'breadcrumbs present').not.toBeNull();
    if (!metrics.identity || !metrics.toolbar || !metrics.modePicker || !metrics.actions) return;
    if (!metrics.brand || !metrics.breadcrumbs) return;

    expect(metrics.overflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
    expect(metrics.breadcrumbs.height, 'breadcrumb stays on one line').toBeLessThan(26);
    expect(metrics.nameWidth, 'document name input is capped').toBeLessThanOrEqual(341);

    // Phone widths stack the bar, so the one-line expectations only apply above.
    if (width >= 768) {
      // The brand must be a single line; a stacked tagline used to break this.
      expect(metrics.brand.height, 'brand is one line').toBeLessThanOrEqual(44);
    }

    if (width >= 1024) {
      // The mode picker and the action buttons must share a vertical centre, or
      // the bar reads as misaligned.
      expect(
        Math.abs(metrics.modePicker.center - metrics.actions.center),
        'mode picker lines up with the action buttons',
      ).toBeLessThanOrEqual(2);
      expect(metrics.actions.height, 'toolbar actions stay on one line').toBeLessThanOrEqual(60);
    }

    if (WIDE.includes(width)) {
      expect(
        Math.abs(metrics.toolbar.center - metrics.identity.center),
        'toolbar shares the identity row',
      ).toBeLessThanOrEqual(2);
    } else {
      expect(
        metrics.toolbar.center,
        'toolbar drops below the identity row',
      ).toBeGreaterThan(metrics.identity.center + 8);
    }
  });
}
