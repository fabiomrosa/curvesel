// The demo: the vanilla engine over cards that keep their own buttons and inputs (DEC-07).
import type { PresetName } from "@curvesel/core";
import { type Carousel, createCarousel } from "../packages/vanilla/src/index.ts";

const byId = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const stage = byId<HTMLDivElement>("stage");
const preset = byId<HTMLSelectElement>("preset");
const active = byId<HTMLOutputElement>("active");

// The user's own cards: the library adopts them, it never builds or changes their inside.
for (let i = 1; i <= 8; i++) {
  const card = document.createElement("article");
  card.className = "card";
  const title = document.createElement("h2");
  title.textContent = `Card ${i}`;
  const counter = document.createElement("button");
  counter.type = "button";
  counter.textContent = "Clicked 0 times";
  let clicks = 0;
  counter.addEventListener("click", () => {
    clicks++;
    counter.textContent = `Clicked ${clicks} times`;
  });
  const note = document.createElement("input");
  note.placeholder = "Type here";
  card.append(title, counter, note);
  stage.append(card);
}

let carousel: Carousel | undefined;
function mount(): void {
  carousel?.destroy();
  carousel = createCarousel(stage, { layout: preset.value as PresetName });
  active.textContent = "1";
  carousel.on("select", (index) => {
    active.textContent = String(index + 1);
  });
}

preset.addEventListener("change", mount);
byId<HTMLButtonElement>("previous").addEventListener("click", () => carousel?.previous());
byId<HTMLButtonElement>("next").addEventListener("click", () => carousel?.next());
mount();
