import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The vanilla README's quick start, exactly as written. An import map stands in for the bundler,
// resolving the packages to their build (the gate builds before the browser tests); nothing is written to disk, which would
// make Vite reload the other tests' pages.
test("the vanilla README's quick start runs as written", async ({ page }) => {
  const readme = readFileSync("packages/vanilla/README.md", "utf8");
  const snippet = readme.match(/## Quick start\n[^`]*```html\n([\s\S]*?)```/)?.[1];
  if (!snippet) throw new Error("no quick start in the vanilla README");
  const imports = {
    "@curvesel/vanilla": "/packages/vanilla/dist/index.js",
    "@curvesel/core": "/packages/core/dist/index.js",
  };
  const body = `<!doctype html><meta charset="utf-8"><script type="importmap">${JSON.stringify({ imports })}</script>${snippet}`;
  await page.route("**/quickstart.html", (route) =>
    route.fulfill({ contentType: "text/html", body }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/quickstart.html");
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("aria-roledescription", "carousel");
  await expect(stage.locator(".card").first()).toHaveAttribute("data-cs-active", "");
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(stage.locator(".card").nth(1)).toHaveAttribute("data-cs-active", "");
  expect(errors).toEqual([]);
});
