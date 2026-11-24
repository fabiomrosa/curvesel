import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/");
  // Every card is shown on the ribbon: none is taken out of the tree by `visibility`.
  await page.selectOption("#preset", "ribbon");
});

test("Chrome's accessibility tree has the carousel region and each card's place", async ({
  page,
}) => {
  await expect(page.locator("#stage")).toMatchAriaSnapshot(`
    - region "Carousel":
      - group "1 of 10":
        - heading "Card 1"
      - group "2 of 10":
        - heading "Card 2"
  `);
});

test("a card hidden on the cylinder leaves the tree", async ({ page }) => {
  await page.selectOption("#preset", "cylinder");
  await expect(page.getByRole("group", { name: "5 of 10" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "2 of 10" })).toHaveCount(1);
});

test("the demo's live region says the new card once the Carousel settles", async ({ page }) => {
  const announcer = page.locator("#announcer");
  await expect(announcer).toHaveAttribute("aria-live", "polite");
  await expect(announcer).toHaveText("");
  await page.click("#next");
  await expect(page.locator("#active")).toHaveText("2");
  await expect(announcer).toHaveText("2 of 10");
});
