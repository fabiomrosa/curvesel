import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The vanilla README's quick start, exactly as written, served by Vite like a user's page.
test("the vanilla README's quick start runs as written", async ({ page }) => {
  const readme = readFileSync("packages/vanilla/README.md", "utf8");
  const snippet = readme.match(/## Quick start\n\n```html\n([\s\S]*?)```/)?.[1];
  if (!snippet) throw new Error("no quick start in the vanilla README");
  writeFileSync("e2e/.quickstart.html", `<!doctype html><meta charset="utf-8">${snippet}`);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/e2e/.quickstart.html");
  const stage = page.locator("#stage");
  await expect(stage).toHaveAttribute("aria-roledescription", "carousel");
  await expect(stage.locator(".card").first()).toHaveAttribute("data-cs-active", "");
  await stage.focus();
  await page.keyboard.press("ArrowRight");
  await expect(stage.locator(".card").nth(1)).toHaveAttribute("data-cs-active", "");
  expect(errors).toEqual([]);
});
