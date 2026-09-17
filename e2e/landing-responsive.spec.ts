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

  // The hero's vertical rhythm is capped by viewport height as well as width:
  // 1080px tall is the baseline where every cap is reached, so 1080p keeps the
  // original hero, and shorter windows compress instead of leaving only a sliver
  // of the product shot at the fold.
  test('hero compresses with viewport height so the shot reaches the fold', async ({ page }) => {
    const measure = async (height: number) => {
      await page.setViewportSize({ width: 1920, height });
      await page.goto('/');
      await page.waitForSelector('.landing-shot');
      await page.evaluate(() => document.fonts.ready);
      return page.evaluate(() => {
        const title = document.querySelector('.landing-hero__title');
        const shot = document.querySelector('.landing-shot');
        return {
          titleFontSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
          shotTop: shot ? Math.round(shot.getBoundingClientRect().top) : -1,
          shotWidth: shot ? Math.round(shot.getBoundingClientRect().width) : -1,
          innerHeight: window.innerHeight,
        };
      });
    };

    const tall = await measure(1080);
    const short = await measure(900);

    // 1080p is unchanged: the headline still renders at its 5rem cap.
    expect(tall.titleFontSize, 'title cap at 1080px tall').toBe(80);

    expect(
      short.titleFontSize,
      'title shrinks on a short viewport',
    ).toBeLessThan(tall.titleFontSize);
    expect(short.shotTop, 'compression moves the shot up').toBeLessThan(tall.shotTop);
    expect(
      short.shotTop,
      'shot is meaningfully visible above the fold',
    ).toBeLessThan(short.innerHeight - 150);

    // The shot is the widest thing in the hero, so it is height-capped too:
    // at most 90vh wide (the frame is 16:9 plus its chrome, so that is ~50vh tall).
    for (const measured of [tall, short]) {
      expect(
        measured.shotWidth,
        `shot width is capped at 90vh (${measured.innerHeight}px tall)`,
      ).toBeLessThanOrEqual(Math.round(measured.innerHeight * 0.9));
    }
  });

  // The same height cap covers the rest of the page, so the sections do not stay
  // at their desktop rhythm on a short window. 1080px tall is the baseline.
  test('sections compress with viewport height too', async ({ page }) => {
    const measure = async (height: number) => {
      await page.setViewportSize({ width: 1920, height });
      await page.goto('/');
      await page.waitForSelector('.landing-grid');
      await page.evaluate(() => document.fonts.ready);
      return page.evaluate(() => {
        const px = (el: Element | null, prop: 'paddingTop' | 'fontSize') =>
          el ? parseFloat(getComputedStyle(el)[prop]) : -1;
        return {
          sectionPaddingTop: px(document.querySelector('.landing-section'), 'paddingTop'),
          sectionTitleFontSize: px(document.querySelector('.landing-section__title'), 'fontSize'),
          ctaPaddingTop: px(document.querySelector('.landing-cta'), 'paddingTop'),
          ctaTitleFontSize: px(document.querySelector('.landing-cta__title'), 'fontSize'),
        };
      });
    };

    const tall = await measure(1080);
    const short = await measure(900);

    // 1080p keeps the original section rhythm.
    expect(tall.sectionPaddingTop, 'section padding at its cap').toBe(72);
    expect(tall.ctaPaddingTop, 'CTA padding at its cap').toBe(84);

    expect(short.sectionPaddingTop, 'section padding shrinks').toBeLessThan(
      tall.sectionPaddingTop,
    );
    expect(short.ctaPaddingTop, 'CTA padding shrinks').toBeLessThan(tall.ctaPaddingTop);
    expect(short.sectionTitleFontSize, 'section title shrinks').toBeLessThan(
      tall.sectionTitleFontSize,
    );
    expect(short.ctaTitleFontSize, 'CTA title shrinks').toBeLessThan(tall.ctaTitleFontSize);
  });
});
