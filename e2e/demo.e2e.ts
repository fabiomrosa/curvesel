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

for (const preset of ["cylinder", "ribbon", "wheel", "arc"]) {
  test(`lays the cards out as a ${preset}, the Active card centred`, async ({ page }) => {
    await page.selectOption("#preset", preset);
    const [active, ...others] = await centres(page);
    expect(active).toEqual([0, 0]);
    const placed = new Set(others.map((centre) => centre.join(",")));
    expect(placed.size).toBe(others.length);
  });
}

test("Next moves the Active card, and the page says which it is", async ({ page }) => {
  await page.click("#next");
  await expect(page.locator("#active")).toHaveText("2");
  await expect(page.locator(".card").nth(1)).toHaveAttribute("data-cs-active", "");
});

test("switching Presets keeps the same cards, with what was typed in them", async ({ page }) => {
  const input = page.locator(".card input").first();
  await input.fill("kept");
  await page.locator(".card button").first().click();
  const before = await page.evaluate(() => {
    const first = document.querySelector(".card");
    Object.assign(window, { first });
    return first?.querySelector("button")?.textContent;
  });
  await page.selectOption("#preset", "arc");
  await page.selectOption("#preset", "ribbon");
  await expect(input).toHaveValue("kept");
  expect(
    await page.evaluate(
      () => document.querySelector(".card") === (window as { first?: Element }).first,
    ),
  ).toBe(true);
  expect(await page.locator(".card button").first().textContent()).toBe(before);
});
