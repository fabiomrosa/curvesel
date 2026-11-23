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

test("a tap clicks a card's button; a drag ending over one does not, and the next tap does", async ({
  page,
}) => {
  const button = (index: number) => page.locator(`#stage > :nth-child(${index + 1}) button`);
  // Clicks as a handler delegated to the page hears them: a capture retargets a drag's to the Stage.
  await page.evaluate(() => {
    const heard: string[] = [];
    Object.assign(window, { heard });
    document.addEventListener("click", (event) => heard.push((event.target as Element).tagName));
  });
  const heard = () => page.evaluate(() => (window as unknown as { heard: string[] }).heard);
  await button(0).click();
  await expect(button(0)).toHaveText("Clicked 1 times");
  // Pressed on the first card's button, the cards follow: the release is over a button too.
  const box = await button(0).boundingBox();
  if (!box) throw new Error("the button is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await settled(page);
  await expect(page.locator("#active")).toHaveText("2");
  await expect(button(0)).toHaveText("Clicked 1 times");
  await expect(button(1)).toHaveText("Clicked 0 times");
  expect(await heard()).toEqual(["BUTTON"]);
  await button(1).click();
  await expect(button(1)).toHaveText("Clicked 1 times");
  expect(await heard()).toEqual(["BUTTON", "BUTTON"]);
});
