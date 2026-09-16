import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the header layout checks.',
  );
});

// Below this width the header deliberately becomes two rows (identity, then
// toolbar). Above it everything fits on one row: the brand tagline stacks under
// the logo and the mode picker shares the action row's vertical centre.
const SINGLE_ROW_WIDTH = 1420;
const WIDE = [1920, 1600, 1512, 1440];
const NARROW = [SINGLE_ROW_WIDTH, 1366, 1280, 1024, 900, 768, 430, 320];

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
      const tagline = document.querySelector('.topbar .eyebrow');

      // Crumbs must never be squeezed into each other: only the active one may
      // shrink, and it truncates instead of overlapping its neighbours.
      const crumbs = Array.from(
        document.querySelectorAll('.topbar .breadcrumbs__item'),
      ).filter((element) => element.getBoundingClientRect().width > 0);
      let crumbOverlaps = 0;
      for (let index = 1; index < crumbs.length; index += 1) {
        const previous = crumbs[index - 1].getBoundingClientRect();
        const current = crumbs[index].getBoundingClientRect();
        if (current.left < previous.right - 1) crumbOverlaps += 1;
      }

      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        identity: box('.topbar__identity'),
        toolbar: box('.toolbar'),
        modePicker: box('.mode-picker'),
        actions: box('.toolbar__actions'),
        breadcrumbs: box('.breadcrumbs'),
        brand: box('.brand'),
        nameWidth: nameInput?.getBoundingClientRect().width ?? -1,
        taglineVisible: (tagline?.getBoundingClientRect().height ?? 0) > 0,
        crumbOverlaps,
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
    expect(metrics.crumbOverlaps, 'breadcrumb crumbs never overlap').toBe(0);
    expect(metrics.nameWidth, 'document name input is capped').toBeLessThanOrEqual(341);

    // Phone widths stack the bar, so the one-line expectations only apply above.
    if (width >= 768) {
      // The brand stays compact: the logo row plus the stacked tagline chip
      // must not exceed 44px, or the bar reads as two misaligned rows.
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
      // The brand tagline chip is visible on the single-row bar.
      expect(metrics.taglineVisible, 'brand tagline is shown').toBe(true);
    } else {
      expect(
        metrics.toolbar.center,
        'toolbar drops below the identity row',
      ).toBeGreaterThan(metrics.identity.center + 8);
    }
  });
}
