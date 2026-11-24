import { expect, type Page, test } from "@playwright/test";

/** Where the Active card's centre is, from the Stage's centre, in px. */
function offCentre(page: Page): Promise<number> {
  return page.evaluate(() => {
    const stage = (document.getElementById("stage") as HTMLElement).getBoundingClientRect();
    const card = document.querySelector("[data-cs-active]") as HTMLElement;
    const box = card.getBoundingClientRect();
    return Math.abs(box.left + box.width / 2 - (stage.left + stage.width / 2));
  });
}

const position = (page: Page) =>
  page.evaluate(() => (window as { carousel?: { position: number } }).carousel?.position);

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/");
  await page.selectOption("#preset", "ribbon");
});

test("Tab onto a card's button brings that card to the centre, in view", async ({ page }) => {
  await page.focus("#stage");
  // Each card has a button and an input: eight Tabs reach the fourth card's input.
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  await expect(page.locator(".card").nth(3).locator("input")).toBeFocused();
  await expect(page.locator("#active")).toHaveText("4");
  await expect.poll(() => position(page)).toBe(3);
  expect(await offCentre(page)).toBeLessThan(1);
});

test("a click on a side card's button clicks it without moving the Carousel", async ({ page }) => {
  const side = page.locator(".card").nth(1).locator("button");
  await side.click();
  await expect(side).toHaveText("Clicked 1 times");
  await page.waitForTimeout(500);
  expect(await position(page)).toBe(0);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("a tap on a side card's button or input leaves the Carousel where it is", async ({
    page,
  }) => {
    const card = page.locator(".card").nth(1);
    await card.locator("button").tap();
    await expect(card.locator("button")).toHaveText("Clicked 1 times");
    await card.locator("input").tap();
    await expect(card.locator("input")).toBeFocused();
    await page.waitForTimeout(500);
    expect(await position(page)).toBe(0);
  });
});
