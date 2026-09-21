import { defOf } from "./cards.js";
import { rngNextInt, rngShuffle } from "./rng.js";
import type { CardInstance, EngineCtx, GameEvent, GameState, TableSlot } from "./types.js";

export function activePlayer(state: GameState) {
  const p = state.players.find((x) => x.id === state.meta.activePlayerId);
  if (!p) throw new Error(`missing active player ${state.meta.activePlayerId}`);
  return p;
}

export function livingPlayers(state: GameState) {
  return state.players.filter((p) => p.health > 0);
}

export function top(slot: CardInstance[]): CardInstance | undefined {
  return slot[0];
}

export function takeTop(slot: CardInstance[]): CardInstance | undefined {
  return slot.shift();
}

export function pushEvent(state: GameState, event: { type: string } & Record<string, unknown>): GameEvent {
  const full = {
    seq: state.log.length + 1,
    clock: state.meta.clock,
    ...event,
  } as GameEvent;
  state.log.push(full);
  return full;
}

export function eclipseBonus(state: GameState, playerId: string, amount: number): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return amount;
  if (p.eclipse || p.joker.active) return amount + 1;
  return amount;
}

export function recycleVeil(state: GameState, ctx?: EngineCtx): void {
  if (ctx && ctx.ruleset.experimental.enableVeilRecycle === false) return;
  if (state.drawDeck.length || !state.veil.length) return;
  const sh = rngShuffle(state.gameRng, state.veil);
  state.gameRng = sh.rng;
  state.drawDeck = sh.items;
  state.veil = [];
  pushEvent(state, { type: "VEIL_RECYCLED", count: state.drawDeck.length });
}

export function drawOne(state: GameState, ctx?: EngineCtx): CardInstance | undefined {
  recycleVeil(state, ctx);
  return takeTop(state.drawDeck);
}

/** Majors never enter a player hand: PD if empty, otherwise Altar. */
export function divertMajor(
  state: GameState,
  ctx: EngineCtx,
  card: CardInstance,
  reason: string,
): boolean {
  if (defOf(ctx.catalog, card).arcana !== "major") return false;
  if (!top(state.roundTable.pd)) {
    card.arrivedTurn = state.meta.turn;
    state.roundTable.pd = [card];
    pushEvent(state, { type: "MAJOR_DIVERTED", cardId: card.cardId, dest: "pd", reason });
    return true;
  }
  state.altar.major.push(card);
  overflowAltar(state, "major", ctx.ruleset.experimental.altarMajorCap);
  pushEvent(state, { type: "MAJOR_DIVERTED", cardId: card.cardId, dest: "altar.major", reason });
  return true;
}

export function giveToHand(
  state: GameState,
  playerId: string,
  card: CardInstance,
  limit: number,
  ctx: EngineCtx,
): void {
  if (divertMajor(state, ctx, card, "hand_blocked")) return;
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return;
  p.hand.push(card);
  while (p.hand.length > limit) {
    const extra = p.hand.shift();
    if (extra) {
      state.veil.push(extra);
      pushEvent(state, { type: "HAND_OVERFLOW", playerId, cardId: extra.cardId });
    }
  }
}

export function dealToHand(
  state: GameState,
  playerId: string,
  n: number,
  limit: number,
  ctx: EngineCtx,
): CardInstance[] {
  const got: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    const c = drawOne(state, ctx);
    if (!c) break;
    giveToHand(state, playerId, c, limit, ctx);
    got.push(c);
  }
  return got;
}

export function tableSlot(state: GameState, slot: TableSlot): CardInstance[] {
  return state.roundTable[slot];
}

export function setSlot(state: GameState, slot: TableSlot, cards: CardInstance[]): void {
  state.roundTable[slot] = cards;
}

export function overflowAltar(
  state: GameState,
  kind: "minors" | "major",
  cap: number,
): CardInstance[] {
  const extra: CardInstance[] = [];
  const pile = state.altar[kind];
  while (pile.length > cap) {
    const c = pile.shift();
    if (c) {
      state.veil.push(c);
      extra.push(c);
    }
  }
  return extra;
}

export function hurt(state: GameState, playerId: string, amount: number): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || amount <= 0) return 0;
  const before = p.health;
  p.health = Math.max(0, p.health - amount);
  return before - p.health;
}

export function shuffleSlots(state: GameState): void {
  const slots: TableSlot[] = ["left", "middle"];
  const cards = slots.map((s) => takeTop(state.roundTable[s]));
  const sh = rngShuffle(state.gameRng, cards);
  state.gameRng = sh.rng;
  slots.forEach((s, i) => {
    const c = sh.items[i];
    state.roundTable[s] = c ? [c] : [];
  });
}

export function firePush(state: GameState, ctx?: EngineCtx): boolean {
  const buried = takeTop(state.roundTable.left);
  if (!buried) return false;
  const fresh = drawOne(state, ctx);
  state.drawDeck.push(buried);
  if (fresh) state.roundTable.left = [fresh];
  return true;
}

export function waterBring(state: GameState): boolean {
  if (!state.drawDeck.length) return false;
  const up = state.drawDeck.pop();
  if (!up) return false;
  const displaced = takeTop(state.roundTable.left);
  state.roundTable.left = [up];
  if (displaced) state.drawDeck.unshift(displaced);
  return true;
}

export function earthSwap(state: GameState): boolean {
  const a = takeTop(state.roundTable.left);
  const b = takeTop(state.roundTable.middle);
  if (!a || !b) {
    if (a) state.roundTable.left = [a];
    if (b) state.roundTable.middle = [b];
    return false;
  }
  state.roundTable.left = [b];
  state.roundTable.middle = [a];
  return true;
}

export function rollDie(state: GameState, faces: number, playerId?: string): number {
  const r = rngNextInt(state.gameRng, faces);
  state.gameRng = r.rng;
  const raw = r.value + 1;
  return playerId ? Math.min(faces, eclipseBonus(state, playerId, raw)) : raw;
}
