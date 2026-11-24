import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/");
  await page.selectOption("#preset", "ribbon");
});

test("Tab onto a side card's button brings that card to the centre", async ({ page }) => {
  await page.focus("#stage");
  // The first card's button, then its input, then the second card's button.
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  await expect(page.locator(".card").nth(1).locator("button")).toBeFocused();
  await expect(page.locator("#active")).toHaveText("2");
});

test("a click on a side card's button clicks it without moving the Carousel", async ({ page }) => {
  const side = page.locator(".card").nth(1).locator("button");
  await side.click();
  await expect(side).toHaveText("Clicked 1 times");
  await page.waitForTimeout(500);
  await expect(page.locator("#active")).toHaveText("1");
  expect(
    await page.evaluate(() => (window as { carousel?: { position: number } }).carousel?.position),
  ).toBe(0);
});
