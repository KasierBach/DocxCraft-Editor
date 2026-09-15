import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the header layout checks.',
  );
});

// Below this width the header deliberately becomes two rows (identity, then
// toolbar). Above it everything fits on one row: the identity needs ~800px and
// the compact toolbar ~555px, so a single row needs roughly 1370px.
const SINGLE_ROW_WIDTH = 1340;
const WIDE = [1920, 1600, 1512, 1440, 1366];
const NARROW = [SINGLE_ROW_WIDTH, 1280, 1024, 900, 768, 430, 320];

for (const width of [...WIDE, ...NARROW]) {
  test(`header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app');
    await page.waitForSelector('.topbar');

    const metrics = await page.evaluate(() => {
      const identity = document.querySelector('.topbar__identity');
      const toolbar = document.querySelector('.toolbar');
      const actions = document.querySelector('.toolbar__actions');
      const breadcrumbs = document.querySelector('.breadcrumbs');
      const nameInput = document.querySelector('.document-name-input');
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        identityTop: identity?.getBoundingClientRect().top ?? -1,
        toolbarTop: toolbar?.getBoundingClientRect().top ?? -1,
        actionsHeight: actions?.getBoundingClientRect().height ?? -1,
        breadcrumbHeight: breadcrumbs?.getBoundingClientRect().height ?? -1,
        nameWidth: nameInput?.getBoundingClientRect().width ?? -1,
      };
    });

    expect(metrics.overflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
    expect(metrics.breadcrumbHeight, 'breadcrumb stays on one line').toBeLessThan(26);
    expect(metrics.nameWidth, 'document name input is capped').toBeLessThanOrEqual(421);

    // Below ~1024px the action buttons are expected to wrap.
    if (width >= 1024) {
      expect(metrics.actionsHeight, 'toolbar actions stay on one line').toBeLessThanOrEqual(60);
    }

    if (WIDE.includes(width)) {
      expect(
        Math.abs(metrics.toolbarTop - metrics.identityTop),
        'toolbar shares the identity row',
      ).toBeLessThanOrEqual(2);
    } else {
      expect(
        metrics.toolbarTop,
        'toolbar drops to its own row',
      ).toBeGreaterThan(metrics.identityTop + 8);
    }
  });
}
