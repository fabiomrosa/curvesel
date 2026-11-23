import { expect, type Page, test } from "@playwright/test";

/** Builds Stages of `.card`s and mounts each in `order`; returns nothing, the page keeps them. */
async function mount(page: Page, html: string, order: string[], options = {}): Promise<void> {
  await page.evaluate(
    ([html, order, options]) => {
      document.body.insertAdjacentHTML("beforeend", html as string);
      const carousels = (order as string[]).map((id) =>
        window.createCarousel(document.getElementById(id) as HTMLElement, {
          layout: "ribbon",
          perspective: 1e6,
          ...(options as object),
        }),
      );
      Object.assign(window, { carousels });
    },
    [html, order, options],
  );
}

/** Each card's centre, from the centre of its Stage's padding box, in px. */
async function centres(page: Page, id: string): Promise<number[]> {
  return page.evaluate((id) => {
    const stage = document.getElementById(id) as HTMLElement;
    const box = stage.getBoundingClientRect();
    const middle = box.left + stage.clientLeft + stage.clientWidth / 2;
    return [...stage.children].map((card) => {
      const rect = card.getBoundingClientRect();
      return Math.round(rect.left + rect.width / 2 - middle);
    });
  }, id);
}

const frames = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

const cards = (n: number) => '<div class="card"></div>'.repeat(n);

/** Page errors and console errors (a `ResizeObserver` loop shows here): none are expected. */
let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/e2e/engine.html");
  await page.waitForFunction(() => "createCarousel" in window);
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test("lays the Slides out again when a Slide's padding changes", async ({ page }) => {
  await mount(page, `<div class="stage" id="s">${cards(3)}</div>`, ["s"]);
  expect(await centres(page, "s")).toEqual([0, 220, 440]);
  await page.evaluate(() => {
    for (const card of document.querySelectorAll<HTMLElement>("#s .card"))
      card.style.padding = "0 50px";
  });
  await frames(page);
  expect(await centres(page, "s")).toEqual([0, 320, 640]);
});

test("keeps the last layout while the Stage is hidden, and catches up when shown", async ({
  page,
}) => {
  await mount(page, `<div class="stage" id="s">${cards(3)}</div>`, ["s"]);
  const transform = () =>
    page.evaluate(() => document.querySelectorAll<HTMLElement>("#s .card")[1]?.style.transform);
  const before = await transform();
  await page.evaluate(() => {
    const stage = document.getElementById("s") as HTMLElement;
    stage.style.display = "none";
    for (const card of stage.querySelectorAll<HTMLElement>(".card")) card.style.width = "250px";
  });
  await frames(page);
  expect(await transform()).toBe(before);
  await page.evaluate(() => {
    (document.getElementById("s") as HTMLElement).style.display = "";
  });
  await frames(page);
  expect(await centres(page, "s")).toEqual([0, 270, 540]);
});

test("moves without a ResizeObserver loop when the user's CSS sizes the Active slide", async ({
  page,
}) => {
  await page.addStyleTag({ content: ".card[data-cs-active] { height: 150px; }" });
  await mount(page, `<div class="stage" id="s">${cards(4)}</div>`, ["s"]);
  await page.evaluate(() => window.carousels[0]?.goTo(2));
  await page.waitForFunction(() => window.carousels[0]?.position === 2);
  expect(await centres(page, "s")).toEqual([-440, -220, 0, 220]);
});

test("leaves no style attribute on a removed Slide that had none", async ({ page }) => {
  await mount(page, `<div class="stage" id="s">${cards(3)}</div>`, ["s"]);
  const style = await page.evaluate(async () => {
    const card = document.querySelector("#s .card") as HTMLElement;
    card.remove();
    await new Promise((done) => setTimeout(done, 0));
    return card.getAttribute("style");
  });
  expect(style).toBeNull();
});

test("hands a Slide to a Carousel created earlier, and gives it back whole", async ({ page }) => {
  const html = `<div class="stage" id="a">${cards(2)}</div><div class="stage" id="b">${cards(1)}</div>`;
  await mount(page, html, ["b", "a"]);
  const result = await page.evaluate(async () => {
    const moving = document.querySelector("#a .card") as HTMLElement;
    (document.getElementById("b") as HTMLElement).append(moving);
    await new Promise((done) => setTimeout(done, 0));
    const during = [moving.style.position, moving.style.getPropertyValue("--cs-offset")];
    for (const carousel of window.carousels) carousel.destroy();
    return { during, after: moving.getAttribute("style") };
  });
  expect(result).toEqual({ during: ["absolute", "1"], after: null });
});
