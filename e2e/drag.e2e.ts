import { expect, type Page, test } from "@playwright/test";

/** The screen x of a card's centre, from the Stage's centre. */
function cardX(page: Page, index: number): Promise<number> {
  return page.evaluate((index) => {
    const stage = document.getElementById("stage") as HTMLElement;
    const box = stage.getBoundingClientRect();
    const rect = (stage.children[index] as HTMLElement).getBoundingClientRect();
    return Math.round(rect.left + rect.width / 2 - (box.left + box.width / 2));
  }, index);
}

/** Presses on the Stage's centre and moves by `dx` in steps; the caller releases. */
async function press(page: Page, dx: number): Promise<void> {
  const box = await page.locator("#stage").boundingBox();
  if (!box) throw new Error("the Stage is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
  // The moves are applied in the next frame.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

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

test("the cards follow the pointer, and a held release Snaps to the nearest", async ({ page }) => {
  await press(page, -260);
  expect(await cardX(page, 0)).toBeCloseTo(-260, -1);
  await page.waitForTimeout(200);
  await page.mouse.up();
  await settled(page);
  await expect(page.locator("#active")).toHaveText("2");
  expect(await cardX(page, 1)).toBe(0);
});

test("past the first card the Rubber band resists, and the cards Snap back", async ({ page }) => {
  await press(page, 200);
  expect(await cardX(page, 0)).toBeCloseTo(20, -1);
  await page.mouse.up();
  await settled(page);
  expect(await cardX(page, 0)).toBe(0);
  await expect(page.locator("#active")).toHaveText("1");
});

test("a flick carries the cards on with Inertia", async ({ page }) => {
  const box = await page.locator("#stage").boundingBox();
  if (!box) throw new Error("the Stage is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  await settled(page);
  expect(Number(await page.locator("#active").textContent())).toBeGreaterThan(2);
});
