// firstmate-calm under `claude plugin test`: the running Clawd that replaces the stock
// working row while Calm is on, its back-and-forth on the mocked clock, its size against
// the viewport, and how it lets go of a site the surface no longer draws.
import { describe, expect, test } from "claude-code/testing";
import { CALM_CLAWD_BODY, CALM_CLAWD_LEGS, CALM_CLAWD_TICK_MS as TICK } from "../lib/fm-calm-clawd-sprite.ts";
import { calmCommand, decodeCells, isStock, rasterOf, spinner, themeChange, unmeasuredSpinner, world } from "./support.ts";

const WIDTH = 9;
const ROWS = 3;
const DEFAULT = 0x01000000;
// Claude Code's own theme tables: the spinner blue of each family for the ground and
// the Claude orange of the stock spinner for Clawd.
const DARK_GROUND = 0x93a5ff;
const LIGHT_GROUND = 0x5769f7;
const BODY = 0xd77757;

/** The three rows as drawn with Clawd `x` columns from the left edge. */
function clawd(width: number, x: number, legs: 0 | 1): string[] {
  const rest = width - x - WIDTH;
  return [
    " ".repeat(x) + CALM_CLAWD_BODY[0] + " ".repeat(rest),
    " ".repeat(x) + CALM_CLAWD_BODY[1] + " ".repeat(rest),
    "▁".repeat(x) + CALM_CLAWD_LEGS[legs].replaceAll(" ", "▁") + "▁".repeat(rest),
  ];
}

describe("the running Clawd", () => {
  test("replaces the spinner with a three-row raster sized to the row inside the transcript margin", async ($, on) => {
    world(on, { preference: "on\n" });
    const raster = rasterOf(await $.ui.render(spinner("agent-main", { columns: 40, rows: 24 })));
    expect(raster).toBeDefined();
    expect(raster!.key).toBe("firstmate-calm-working-ship");
    expect(raster!.columns).toBe(38);
    expect(raster!.rows).toBe(ROWS);
    const { glyphs, foregrounds, backgrounds } = decodeCells(raster!.cells, 38, ROWS);
    expect(glyphs).toEqual(clawd(38, 0, 0));
    expect(foregrounds[1]!.slice(0, WIDTH).every((color) => color === BODY)).toBe(true);
    expect(foregrounds[2]![0]).toBe(DARK_GROUND);
    expect(foregrounds[2]![2]).toBe(BODY);
    expect(foregrounds[2]!.slice(WIDTH).every((color) => color === DARK_GROUND)).toBe(true);
    expect(backgrounds.flat().every((color) => color === DEFAULT)).toBe(true);
  });

  test("runs one column every tick to the right edge and back, swapping legs, through blits of the mounted size", async ($, on) => {
    const { clock, journal } = world(on, { preference: "on\n" });
    await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
    await $.ui.render(spinner("agent-main", { columns: 40, rows: 24 }));
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(1);
    expect(journal.blits[0]).toMatchObject({ requestId: "agent-main", key: "firstmate-calm-working-ship", columns: 38, rows: ROWS });
    expect(decodeCells(journal.blits[0]!.cells, 38, ROWS).glyphs).toEqual(clawd(38, 1, 1));
    const span = 38 - WIDTH;
    await clock.advance(TICK * (span - 1));
    expect(decodeCells(journal.blits.at(-1)!.cells, 38, ROWS).glyphs).toEqual(clawd(38, span, 1));
    await clock.advance(TICK);
    expect(decodeCells(journal.blits.at(-1)!.cells, 38, ROWS).glyphs).toEqual(clawd(38, span - 1, 0));
    await clock.advance(TICK * (span - 1));
    expect(decodeCells(journal.blits.at(-1)!.cells, 38, ROWS).glyphs).toEqual(clawd(38, 0, 0));
  });

  test("stops blitting a site the surface denies and resumes when the spinner is drawn again", async ($, on) => {
    const { clock, journal, denyBlits } = world(on, { preference: "on\n" });
    await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
    await $.ui.render(spinner());
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(1);
    denyBlits("nothing of firstmate-calm is mounted there");
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(2);
    await clock.advance(TICK * 5);
    expect(journal.blits).toHaveLength(2);
    denyBlits(undefined);
    await $.ui.render(spinner());
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(3);
  });

  test("never blits while off, and drops every site when toggled off", async ($, on) => {
    const { clock, journal } = world(on, { preference: "on\n" });
    await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
    await $.ui.render(spinner());
    await clock.advance(TICK);
    expect(journal.blits).toHaveLength(1);
    await $.command.run(calmCommand());
    await clock.advance(TICK * 4);
    expect(journal.blits).toHaveLength(1);
    expect(isStock(await $.ui.render(spinner()))).toBe(true);
    await clock.advance(TICK * 4);
    expect(journal.blits).toHaveLength(1);
  });

  test("sizes to the raster limits: an unmeasured viewport reads as 80 columns, a wide one clips at 512, a narrow one clips Clawd", async ($, on) => {
    world(on, { preference: "on\n" });
    expect(rasterOf(await $.ui.render(unmeasuredSpinner("a")))!.columns).toBe(78);
    expect(rasterOf(await $.ui.render(spinner("b", { columns: 900, rows: 40 })))!.columns).toBe(512);
    const narrow = rasterOf(await $.ui.render(spinner("c", { columns: 7, rows: 40 })))!;
    expect(narrow.columns).toBe(5);
    expect(narrow.rows).toBe(ROWS);
    expect(decodeCells(narrow.cells, 5, ROWS).glyphs).toEqual(clawd(WIDTH, 0, 0).map((row) => row.slice(0, 5)));
  });

  test("reflows to a new width on the redraw a resize causes, and blits at that width from then on", async ($, on) => {
    const { clock, journal } = world(on, { preference: "on\n" });
    await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
    await $.ui.render(spinner("agent-main", { columns: 80, rows: 24 }));
    await clock.advance(TICK * 6);
    expect(decodeCells(journal.blits.at(-1)!.cells, 78, ROWS).glyphs).toEqual(clawd(78, 6, 0));
    // A 12-column row leaves Clawd 1 free column; step 6 bounces back to the left edge.
    const shrunk = rasterOf(await $.ui.render(spinner("agent-main", { columns: 12, rows: 24 })))!;
    expect(shrunk.columns).toBe(10);
    expect(decodeCells(shrunk.cells, 10, ROWS).glyphs).toEqual(clawd(10, 0, 0));
    await clock.advance(TICK);
    expect(journal.blits.at(-1)).toMatchObject({ columns: 10, rows: ROWS });
  });

  test("leaves a non-terminal surface to the engine", async ($, on) => {
    const { clock, journal } = world(on, { preference: "on\n" });
    const desktop = { ...spinner(), surface: "desktop" as const };
    expect(isStock(await $.ui.render(desktop as never))).toBe(true);
    await clock.advance(TICK * 4);
    expect(journal.blits).toHaveLength(0);
  });

  // Each theme value needs its own world, so the family rule gets one test per value.
  for (const [theme, expected, family] of [
    ["light", LIGHT_GROUND, "light"],
    ["dark-ansi", DARK_GROUND, "dark"],
    ["dark-daltonized", DARK_GROUND, "dark"],
    ["light-daltonized", LIGHT_GROUND, "light"],
    ["light-ansi", LIGHT_GROUND, "light"],
    ["auto", LIGHT_GROUND, "light"],
    ["custom:rose-pine", LIGHT_GROUND, "light"],
  ] as const) {
    test(`paints the ${family} family for the theme value ${JSON.stringify(theme)}`, async ($, on) => {
      world(on, { preference: "on\n", theme });
      const raster = rasterOf(await $.ui.render(spinner("agent-main", { columns: 40, rows: 24 })))!;
      const { foregrounds } = decodeCells(raster.cells, 38, ROWS);
      expect(foregrounds[2]!.slice(WIDTH).every((color) => color === expected)).toBe(true);
      expect(foregrounds[1]![0]).toBe(BODY);
    });
  }

  test("re-paints in the new family after the theme changes, through the next drawing and every later blit", async ($, on) => {
    const { clock, journal } = world(on, { preference: "on\n", theme: "dark" });
    await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
    await $.ui.render(spinner("agent-main", { columns: 40, rows: 24 }));
    await clock.advance(TICK);
    expect(decodeCells(journal.blits.at(-1)!.cells, 38, ROWS).foregrounds[2]!.at(-1)).toBe(DARK_GROUND);
    const redrawsBefore = journal.invalidations.length;
    const changed = await $.config.set(themeChange("light", "dark"));
    expect(changed.value).toBe("light");
    expect(journal.invalidations.length).toBe(redrawsBefore + 1);
    await clock.advance(TICK);
    expect(decodeCells(journal.blits.at(-1)!.cells, 38, ROWS).foregrounds[2]!.at(-1)).toBe(LIGHT_GROUND);
    const raster = rasterOf(await $.ui.render(spinner("agent-main", { columns: 40, rows: 24 })))!;
    expect(decodeCells(raster.cells, 38, ROWS).foregrounds[2]!.at(-1)).toBe(LIGHT_GROUND);
    // A change within the same family redraws nothing.
    const redrawsAfter = journal.invalidations.length;
    await $.config.set(themeChange("light-ansi", "light"));
    expect(journal.invalidations.length).toBe(redrawsAfter);
  });

  test("leaves a theme change to the engine while Calm is off, and paints the new family once Calm turns on", async ($, on) => {
    const { journal } = world(on, { theme: "dark" });
    await $.session.start({ cwd: "/work", surface: "terminal", isInteractive: true });
    const redrawsBefore = journal.invalidations.length;
    await $.config.set(themeChange("light", "dark"));
    expect(journal.invalidations.length).toBe(redrawsBefore);
    await $.command.run(calmCommand());
    const raster = rasterOf(await $.ui.render(spinner("agent-main", { columns: 40, rows: 24 })))!;
    expect(decodeCells(raster.cells, 38, ROWS).foregrounds[2]!.at(-1)).toBe(LIGHT_GROUND);
  });
});
