import { expect, type Page, test } from "@playwright/test";

/** The Position one frame after Next. */
async function afterNext(page: Page): Promise<number> {
  await page.goto("/demo/");
  await page.click("#next");
  return page.evaluate(
    () =>
      new Promise<number>((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            done((window as unknown as { carousel: { position: number } }).carousel.position),
          ),
        ),
      ),
  );
}

test("with reduced motion, Next lands in the next frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await afterNext(page)).toBe(1);
});

test("without it, Next animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const position = await afterNext(page);
  expect(position).toBeGreaterThan(0);
  expect(position).toBeLessThan(1);
});
