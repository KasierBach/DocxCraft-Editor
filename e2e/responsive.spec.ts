import { expect, test } from '@playwright/test';

type ViewportCase = {
  name: string;
  width: number;
  height: number;
  minEditorWidth: number;
};

// Covers desktop, laptop, tablet landscape/portrait, and common phone sizes
// (including the smallest phones still in use).
const VIEWPORT_CASES: ViewportCase[] = [
  { name: 'desktop 1920x1080', width: 1920, height: 1080, minEditorWidth: 900 },
  { name: 'laptop 1366x768', width: 1366, height: 768, minEditorWidth: 600 },
  { name: 'tablet landscape 1024x768', width: 1024, height: 768, minEditorWidth: 400 },
  { name: 'tablet portrait 768x1024', width: 768, height: 1024, minEditorWidth: 600 },
  { name: 'phone 430x932', width: 430, height: 932, minEditorWidth: 340 },
  { name: 'phone 390x844', width: 390, height: 844, minEditorWidth: 300 },
  { name: 'phone 320x568', width: 320, height: 568, minEditorWidth: 240 },
  // The compact-layout boundary itself: at exactly 900px the drawer layout
  // is active (max-width media query), so drawers must be reachable.
  { name: 'breakpoint 900x768', width: 900, height: 768, minEditorWidth: 700 },
];

async function measureLayout(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const shell = document.querySelector('.app-shell');
    const editorPanel = document.querySelector('.editor-panel');
    const statusBar = document.querySelector('.editor-status-bar');
    const topbar = document.querySelector('.topbar');

    const width = (el: Element | null) =>
      el ? Math.round(el.getBoundingClientRect().width) : null;
    const overflowX = (el: Element | null) =>
      el ? el.scrollWidth - el.clientWidth : null;

    return {
      viewportWidth: window.innerWidth,
      pageOverflowX: doc.scrollWidth - doc.clientWidth,
      appShellOverflowX: overflowX(shell),
      editorWidth: width(editorPanel),
      editorStatusBarOverflowX: overflowX(statusBar),
      topbarOverflowX: overflowX(topbar),
    };
  });
}

// Waits until entrance animations (drawer slide-in, modal slide-up) have
// finished so bounding-box assertions measure the settled layout.
async function waitForEnterAnimation(
  locator: import('@playwright/test').Locator,
) {
  await expect
    .poll(async () =>
      locator.evaluate((el) => {
        const animations = el.getAnimations();
        return animations.length === 0 ||
          animations.every((animation) => animation.playState === 'finished')
          ? 'done'
          : 'running';
      }),
    )
    .toBe('done');
}

test.beforeEach(() => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Desktop Chromium owns the responsive layout spec.',
  );
});

test.describe('responsive layout', () => {
  for (const viewportCase of VIEWPORT_CASES) {
    test(`keeps the workspace usable at ${viewportCase.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewportCase.width,
        height: viewportCase.height,
      });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      // The auth gate resolves the session before mounting the app shell.
      await page.locator('.app-shell').waitFor({ state: 'visible' });

      const layout = await measureLayout(page);

      expect(layout.pageOverflowX).toBeLessThanOrEqual(0);
      expect(layout.appShellOverflowX).toBeLessThanOrEqual(0);
      expect(layout.topbarOverflowX).toBeLessThanOrEqual(0);
      expect(layout.editorStatusBarOverflowX).toBeLessThanOrEqual(0);
      expect(layout.editorWidth, 'editor panel width').toBeGreaterThanOrEqual(
        viewportCase.minEditorWidth,
      );
    });
  }

  test('opens sidebars in flow on desktop by default', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('complementary', { name: 'Document outline' }),
    ).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Document details' }),
    ).toBeVisible();

    const layout = await measureLayout(page);
    expect(layout.editorWidth).toBeGreaterThan(600);
  });

  test('hides drawers by default on phones and supports open/close via backdrop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('complementary', { name: 'Document outline' }),
    ).toBeHidden();
    await expect(
      page.getByRole('complementary', { name: 'Document details' }),
    ).toBeHidden();

    const editorOnly = await measureLayout(page);
    expect(editorOnly.editorWidth).toBeGreaterThanOrEqual(300);

    const header = page.locator('header.topbar');
    await header.getByRole('button', { name: 'Show document outline' }).click();
    const outline = page.getByRole('complementary', { name: 'Document outline' });
    await expect(outline).toBeVisible();
    await waitForEnterAnimation(outline);

    const outlineBox = await outline.boundingBox();
    expect(outlineBox).not.toBeNull();
    expect(outlineBox!.width).toBeLessThanOrEqual(390);
    expect(outlineBox!.x).toBeGreaterThanOrEqual(0);

    const backdrop = page.locator('.drawer-backdrop');
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: 380, y: 400 } });

    await expect(outline).toBeHidden();
    await expect(backdrop).toBeHidden();

    const closedLayout = await measureLayout(page);
    expect(closedLayout.editorWidth).toBeGreaterThanOrEqual(300);
  });

  test('drawer close button closes the right drawer on phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('header.topbar').getByRole('button', { name: 'Show document details' }).click();
    const details = page.getByRole('complementary', { name: 'Document details' });
    await expect(details).toBeVisible();

    await page.getByRole('button', { name: 'Close document details' }).click();
    await expect(details).toBeHidden();
    await expect(page.locator('.drawer-backdrop')).toBeHidden();
  });

  test('status bar controls stay clickable at phone sizes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const shortcutDialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await page.locator('.status-button').click();
    await expect(shortcutDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(shortcutDialog).toBeHidden();
  });

  test('command palette fits within phone and short-landscape viewports', async ({
    page,
  }) => {
    const cases = [
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ];

    for (const size of cases) {
      await page.setViewportSize(size);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.locator('.app-shell').waitFor({ state: 'visible' });

      await page.keyboard.press('Control+P');
      const palette = page.getByRole('dialog', { name: 'Command palette' });
      await expect(palette).toBeVisible();
      await waitForEnterAnimation(palette);

      const box = await palette.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);

      await page.keyboard.press('Escape');
      await expect(palette).toBeHidden();
    }
  });
});
