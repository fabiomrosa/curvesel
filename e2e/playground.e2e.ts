import { expect, type Page, test } from "@playwright/test";

/** The screen x of every Slide's segment in a view, left to right. */
function slideXs(page: Page, view: string): Promise<number[]> {
  return page.locator(`#${view} line.slide`).evaluateAll((lines) =>
    lines
      .map((line) => {
        const box = line.getBoundingClientRect();
        return box.x + box.width / 2;
      })
      .sort((a, b) => a - b),
  );
}

/** Drags the top view by `dx` px in steps, holding still for `holdMs` before letting go. */
async function drag(page: Page, dx: number, holdMs = 0): Promise<void> {
  const box = await page.locator("#top").boundingBox();
  if (!box) throw new Error("the top view is not visible");
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 5 });
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

async function rest(page: Page): Promise<number> {
  await expect(page.locator("#track-phase")).toHaveText("rest");
  return Number(await page.locator("#at").textContent());
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1800 });
  await page.goto("/playground/");
});

test("the Slides follow a Drag one to one, and a held release Snaps", async ({ page }) => {
  const before = await slideXs(page, "top");
  const box = await page.locator("#top").boundingBox();
  if (!box) throw new Error("the top view is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 5 });
  const during = await slideXs(page, "top");
  expect((during[3] ?? 0) - (before[3] ?? 0)).toBeCloseTo(-60, 0);
  await page.waitForTimeout(300);
  await page.mouse.up();
  expect(Number.isInteger(await rest(page))).toBe(true);
});

test("the Rubber band resists past the first Slide, then Snaps back", async ({ page }) => {
  const before = await slideXs(page, "top");
  await drag(page, 200, 100);
  expect(await rest(page)).toBe(0);
  const box = await page.locator("#top").boundingBox();
  if (!box) throw new Error("the top view is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 5 });
  const stretched = await slideXs(page, "top");
  await page.mouse.up();
  expect((stretched[3] ?? 0) - (before[3] ?? 0)).toBeCloseTo(20, 0);
});

test("no frame is requested at rest", async ({ page }) => {
  await page.click("#next");
  await rest(page);
  const frames = await page.locator("#frames").textContent();
  await page.waitForTimeout(500);
  await expect(page.locator("#frames")).toHaveText(frames ?? "");
});
