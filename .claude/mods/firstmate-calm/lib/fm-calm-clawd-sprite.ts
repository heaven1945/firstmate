// Calm's working Clawd for Claude Code: the Claude Code mascot runs back and forth along
// a ground line in place of the working ship. It paints the same color-tagged runs as
// ./fm-calm-working-ship-sprite.ts, so ./fm-calm-ship-raster.ts packs it unchanged: the
// ground takes the `water` color and Clawd the `boat` color. The Pi extension keeps the
// ship sprite.
import type { CalmWorkingShipFrame, CalmWorkingShipRun } from "./fm-calm-working-ship-sprite.ts";

/** Scheduler period. Clawd moves one column and swaps legs every tick. */
export const CALM_CLAWD_TICK_MS = 120;

export const CALM_CLAWD_BODY = [" ▐▛███▜▌ ", "▝▜█████▛▘"] as const;
/** Tucked and spread legs, alternated every tick so Clawd reads as running. */
export const CALM_CLAWD_LEGS = ["  ▘▘ ▝▝  ", " ▘ ▘ ▝ ▝ "] as const;
export const CALM_CLAWD_WIDTH = 9;
const GROUND = "▁";

export type CalmClawdSprite = {
  /** Paint one frame for a row of `width` columns; the packer clips what does not fit. */
  frame(width: number): CalmWorkingShipFrame;
  /** Advance one scheduler tick. */
  tick(): void;
  /** Return Clawd to the left edge. */
  reset(): void;
};

/** The leg row: legs in Clawd's color, every gap between them is ground. */
function legRow(legs: string, left: number, right: number): CalmWorkingShipRun[] {
  const runs: CalmWorkingShipRun[] = [{ text: GROUND.repeat(left), color: "water" }];
  for (const glyph of legs) {
    const run = glyph === " " ? { text: GROUND, color: "water" as const } : { text: glyph, color: "boat" as const };
    const last = runs[runs.length - 1]!;
    if (last.color === run.color) runs[runs.length - 1] = { text: last.text + run.text, color: run.color };
    else runs.push(run);
  }
  runs.push({ text: GROUND.repeat(right), color: "water" });
  return runs;
}

export function createCalmClawdSprite(): CalmClawdSprite {
  let step = 0;
  return {
    reset(): void {
      step = 0;
    },
    tick(): void {
      step += 1;
    },
    frame(width: number): CalmWorkingShipFrame {
      // Ping-pong over the free columns: 0 → span → 0. The sprite is symmetric, so it
      // needs no mirrored copy for the way back.
      const span = Math.max(0, width - CALM_CLAWD_WIDTH);
      const phase = span === 0 ? 0 : step % (2 * span);
      const x = phase <= span ? phase : 2 * span - phase;
      const pad = { text: " ".repeat(x), color: "plain" as const };
      return [
        [pad, { text: CALM_CLAWD_BODY[0], color: "boat" }],
        [pad, { text: CALM_CLAWD_BODY[1], color: "boat" }],
        legRow(CALM_CLAWD_LEGS[step % 2]!, x, span - x),
      ];
    },
  };
}
