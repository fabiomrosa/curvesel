// The cost of a frame during a drag, from a Chrome trace (`npm run bench`). Not part of the gate.
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const PORT = 5190;
/** Pointer moves per case, one frame each. */
const MOVES = 120;
const WAVE = { amplitude: 0.7, wavelength: 4 };
const CASES = [20, 200].flatMap((count) => [
  { name: `${count} Slides, ribbon`, count, layout: { curvature: 0, gap: 20 } },
  { name: `${count} Slides, wavy ribbon`, count, layout: { curvature: 0, gap: 20, wave: WAVE } },
]);
/** The main thread's work in a frame: the engine's callback, then style, layout and paint. */
const WORK = new Set([
  "FireAnimationFrame",
  "UpdateLayoutTree",
  "Layout",
  "PrePaint",
  "Paint",
  "Layerize",
]);

interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  tid: number;
}

/**
 * Milliseconds of work per frame the engine wrote in (its callback ran, and its writes started a
 * style update). The script's own wait for a frame lands in the next one and is left out.
 */
function frameCosts(events: TraceEvent[]): number[] {
  const starts = events.filter((e) => e.name === "BeginMainThreadFrame").map((e) => e.ts);
  const main = events.find((e) => e.name === "FireAnimationFrame")?.tid;
  const work = events.filter((e) => e.ph === "X" && e.tid === main && WORK.has(e.name));
  return starts.flatMap((start, i) => {
    const end = starts[i + 1] ?? Number.POSITIVE_INFINITY;
    const inFrame = work.filter((e) => e.ts >= start && e.ts < end).sort((a, b) => a.ts - b.ts);
    const names = new Set(inFrame.map((e) => e.name));
    if (!names.has("FireAnimationFrame") || !names.has("UpdateLayoutTree")) return [];
    // Top-level events only: a Paint nests the Paints of its children.
    let until = Number.NEGATIVE_INFINITY;
    let total = 0;
    for (const e of inFrame) {
      if (e.ts < until) continue;
      total += e.dur ?? 0;
      until = e.ts + (e.dur ?? 0);
    }
    return [total / 1000];
  });
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};

const server = await createServer({
  configFile: "vite.config.ts",
  server: { port: PORT, strictPort: true },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({ channel: "chrome" });
try {
  console.log(
    `Chrome ${browser.version()}\n\n| Case | Frames | Median ms | Worst ms |\n|---|---|---|---|`,
  );
  for (const { name, count, layout } of CASES) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/e2e/engine.html`);
    await page.waitForFunction(() => "createCarousel" in window);
    await page.evaluate(
      ({ count, layout }) => {
        const stage = document.createElement("div");
        stage.className = "stage";
        for (let i = 0; i < count; i++) {
          const card = document.createElement("div");
          card.className = "card";
          stage.append(card);
        }
        document.body.append(stage);
        window.createCarousel(stage, { layout });
      },
      { count, layout },
    );
    await browser.startTracing(page, {
      categories: ["devtools.timeline", "disabled-by-default-devtools.timeline.frame"],
    });
    await page.mouse.move(400, 150);
    await page.mouse.down();
    for (let i = 1; i <= MOVES; i++) {
      // Back and forth across one Slide, so the Position stays near the start.
      await page.mouse.move(400 - 220 * Math.abs(Math.sin(i / 10)), 150);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
    }
    await page.mouse.up();
    const { traceEvents } = JSON.parse((await browser.stopTracing()).toString());
    const costs = frameCosts(traceEvents);
    const worst = Math.max(...costs);
    console.log(
      `| ${name} | ${costs.length} | ${median(costs).toFixed(2)} | ${worst.toFixed(2)} |`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
