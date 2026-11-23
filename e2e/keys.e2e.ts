import { expect, type Page, test } from "@playwright/test";

const settled = (page: Page) =>
  page.waitForFunction(() => {
    const position =
      (window as { carousel?: { position: number } }).carousel?.position ?? Number.NaN;
    return Number.isInteger(position);
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/");
  await page.selectOption("#preset", "ribbon");
});

test("the arrow keys step the focused Carousel; Home and End go to the ends", async ({ page }) => {
  const active = page.locator("#active");
  await page.focus("#stage");
  for (const [key, card] of [
    ["ArrowRight", "2"],
    ["ArrowRight", "3"],
    ["ArrowLeft", "2"],
    ["End", "10"],
    ["Home", "1"],
  ]) {
    await page.keyboard.press(key as string);
    await expect(active).toHaveText(card as string);
  }
  // In a card's input the arrows move the caret, not the Carousel.
  await page.locator("#stage input").first().focus();
  await page.keyboard.press("ArrowRight");
  await settled(page);
  await expect(active).toHaveText("1");
});

test("a wheel along the Curve moves the cards instead of the page, and they Snap", async ({
  page,
}) => {
  await page.selectOption("#preset", "wheel");
  // A page taller than the window, so a wheel the Carousel does not take would scroll it.
  await page.evaluate(() => {
    document.body.style.minHeight = "300vh";
  });
  const box = await page.locator("#stage").boundingBox();
  if (!box) throw new Error("the Stage is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 260);
  await expect(page.locator("#active")).toHaveText("2");
  await settled(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // Past the last card, the page scrolls.
  await page.focus("#stage");
  await page.keyboard.press("End");
  await expect(page.locator("#active")).toHaveText("10");
  await settled(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.mouse.wheel(0, 260);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
