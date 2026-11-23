import { expect, type Page, test } from "@playwright/test";

/** Each card's centre from the Stage's centre, in px (x, y). */
function centres(page: Page): Promise<[number, number][]> {
  return page.evaluate(() => {
    const stage = document.getElementById("stage") as HTMLElement;
    const box = stage.getBoundingClientRect();
    const [cx, cy] = [box.left + box.width / 2, box.top + box.height / 2];
    return [...stage.children].map((card) => {
      const rect = card.getBoundingClientRect();
      return [
        Math.round(rect.left + rect.width / 2 - cx),
        Math.round(rect.top + rect.height / 2 - cy),
      ];
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/");
});

/** Where the second card goes from the first, per Preset (screen x right, y down; step 200 px). */
const neighbours: Record<string, (x: number, y: number) => boolean> = {
  ribbon: (x, y) => x === 200 && y === 0,
  cylinder: (x, y) => x > 0 && x < 195 && y === 0,
  wheel: (x, y) => x === 0 && y > 0,
  arc: (x, y) => x > 0 && y > 0,
};

for (const [preset, placed] of Object.entries(neighbours)) {
  test(`lays the cards out as a ${preset}, the Active card centred`, async ({ page }) => {
    await page.selectOption("#preset", preset);
    const [active, second] = await centres(page);
    expect(active).toEqual([0, 0]);
    expect(placed(...(second ?? [0, 0])), `second card at ${second}`).toBe(true);
  });
}

test("Next and Previous move the Active card, and the page says which it is", async ({ page }) => {
  await page.click("#next");
  await expect(page.locator("#active")).toHaveText("2");
  await expect(page.locator(".card").nth(1)).toHaveAttribute("data-cs-active", "");
  await page.click("#previous");
  await expect(page.locator("#active")).toHaveText("1");
});

test("switching Presets keeps the same cards, with what was typed in them", async ({ page }) => {
  const input = page.locator(".card input").first();
  const button = page.locator(".card button").first();
  await input.fill("kept");
  await button.click();
  await page.evaluate(() => Object.assign(window, { first: document.querySelector(".card") }));
  await page.selectOption("#preset", "arc");
  await page.selectOption("#preset", "ribbon");
  await expect(input).toHaveValue("kept");
  await expect(button).toHaveText("Clicked 1 times");
  await button.click();
  await expect(button).toHaveText("Clicked 2 times");
  expect(
    await page.evaluate(
      () => document.querySelector(".card") === (window as { first?: Element }).first,
    ),
  ).toBe(true);
});

test("switching Presets destroys the Carousel it replaces", async ({ page }) => {
  await page.evaluate(() =>
    Object.assign(window, { old: (window as { carousel?: unknown }).carousel }),
  );
  await page.selectOption("#preset", "wheel");
  // A destroyed Carousel ignores calls: the readout, fed by `select`, stays on the first card.
  await page.evaluate(() => (window as { old?: { goTo(index: number): void } }).old?.goTo(3));
  await page.waitForTimeout(1500);
  await expect(page.locator("#active")).toHaveText("1");
});
