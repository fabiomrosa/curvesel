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
  "wavy ribbon": (x, y) => x > 0 && x < 200 && y === 0,
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

test("the wavy ribbon undulates: the third card out comes forward again", async ({ page }) => {
  await page.selectOption("#preset", "wavy ribbon");
  const depth = await page.evaluate(() =>
    [...(document.getElementById("stage") as HTMLElement).children].map((card) =>
      Number((card as HTMLElement).style.zIndex),
    ),
  );
  // A plain bend goes deeper with each card; the Wave turns back after its trough.
  expect(depth[3]).toBeGreaterThan(depth[2] as number);
});

test("the side cards are dimmed and smaller, by the demo's own CSS", async ({ page }) => {
  const look = (index: number) =>
    page
      .locator(".card .face")
      .nth(index)
      .evaluate((face) => {
        const style = getComputedStyle(face);
        return { opacity: Number(style.opacity), scale: style.scale };
      });
  expect(await look(0)).toEqual({ opacity: 1, scale: "1" });
  const side = await look(1);
  expect(side.opacity).toBeLessThan(1);
  expect(Number(side.scale)).toBeLessThan(1);
});

test("the loop goes round from the first card to the last", async ({ page }) => {
  await page.check("#loop");
  await page.click("#previous");
  await expect(page.locator("#active")).toHaveText("10");
});

test("the library writes on the cards and the Stage only what DEC-07 and DEC-14 list", async ({
  page,
}) => {
  const slide = [
    "position",
    "transform",
    "z-index",
    "visibility",
    "--cs-offset",
    "--cs-abs-offset",
  ];
  const stage = ["perspective", "touch-action", "position"];
  for (const option of Object.keys(neighbours)) {
    await page.selectOption("#preset", option);
    await page.click("#next");
    const written = await page.evaluate(() => {
      const root = document.getElementById("stage") as HTMLElement;
      const names = (element: HTMLElement) => [...element.style];
      const marks = (element: HTMLElement) => element.getAttributeNames();
      const cards = [...root.children] as HTMLElement[];
      return {
        slide: [...new Set(cards.flatMap(names))],
        marks: [...new Set(cards.flatMap(marks))],
        stage: names(root),
        stageMarks: marks(root),
      };
    });
    for (const name of written.slide) expect(slide, option).toContain(name);
    for (const name of written.stage) expect(stage, option).toContain(name);
    expect(written.marks.sort(), option).toEqual([
      "class",
      "data-cs-active",
      "data-cs-visible",
      "style",
    ]);
    expect(written.stageMarks.sort(), option).toEqual(["id", "style", "tabindex"]);
  }
});
