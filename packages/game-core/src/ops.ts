import { defOf } from "./cards.js";
import { isJoker, JOKER_ID } from "./catalog/joker.js";
import { rngNextInt, rngShuffle } from "./rng.js";
import type { CardDef, CardInstance, EngineCtx, GameEvent, GameState, TableSlot } from "./types.js";

/** Pip ink for Eclipse pairing: water/earth red, air/fire black. Courts use element; gold titled Majors do not pair by ink. */
export function defInk(def: CardDef): "red" | "black" | null {
  if (isJoker(def)) return null;
  if (def.arcana === "major" && !def.tags.includes("court")) return null;
  if (def.element === "water" || def.element === "earth") return "red";
  if (def.element === "air" || def.element === "fire") return "black";
  return null;
}

/** Altar Eclipse: red+black courts of the same face (L0), or Sun↔Moon titled Major pair / same rank (L1). */
export function altarHasRedBlackPair(ctx: EngineCtx, majors: readonly CardInstance[]): boolean {
  const courtsByRank = new Map<number, { red: boolean; black: boolean }>();
  for (const c of majors) {
    const def = defOf(ctx.catalog, c);
    if (!def.tags.includes("court")) continue;
    const ink = defInk(def);
    if (!ink) continue;
    const row = courtsByRank.get(def.rank) ?? { red: false, black: false };
    if (ink === "red") row.red = true;
    if (ink === "black") row.black = true;
    courtsByRank.set(def.rank, row);
  }
  for (const row of courtsByRank.values()) {
    if (row.red && row.black) return true;
  }
  for (let i = 0; i < majors.length; i++) {
    for (let j = i + 1; j < majors.length; j++) {
      const a = defOf(ctx.catalog, majors[i]!);
      const b = defOf(ctx.catalog, majors[j]!);
      if (a.tags.includes("court") || b.tags.includes("court")) continue;
      if (a.arcana !== "major" || b.arcana !== "major") continue;
      if (a.pairId === b.id || b.pairId === a.id) return true;
      if (a.rank === b.rank && a.deck !== b.deck) return true;
    }
  }
  return false;
}

/** Pull the Altar cards that completed Eclipse into the Veil so the pair is not a permanent aura. */
export function consumeAltarEclipsePair(state: GameState, ctx: EngineCtx): CardInstance[] {
  const majors = state.altar.major;
  let pairI = -1;
  let pairJ = -1;

  const courtsByRank = new Map<number, number[]>();
  for (let i = 0; i < majors.length; i++) {
    const def = defOf(ctx.catalog, majors[i]!);
    if (!def.tags.includes("court")) continue;
    const list = courtsByRank.get(def.rank) ?? [];
    list.push(i);
    courtsByRank.set(def.rank, list);
  }
  outerCourt: for (const idxs of courtsByRank.values()) {
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const inkA = defInk(defOf(ctx.catalog, majors[idxs[a]!]!));
        const inkB = defInk(defOf(ctx.catalog, majors[idxs[b]!]!));
        if (inkA && inkB && inkA !== inkB) {
          pairI = idxs[a]!;
          pairJ = idxs[b]!;
          break outerCourt;
        }
      }
    }
  }

  if (pairI < 0) {
    outer: for (let i = 0; i < majors.length; i++) {
      for (let j = i + 1; j < majors.length; j++) {
        const a = defOf(ctx.catalog, majors[i]!);
        const b = defOf(ctx.catalog, majors[j]!);
        if (a.tags.includes("court") || b.tags.includes("court")) continue;
        if (a.arcana !== "major" || b.arcana !== "major") continue;
        if (a.pairId === b.id || b.pairId === a.id || (a.rank === b.rank && a.deck !== b.deck)) {
          pairI = i;
          pairJ = j;
          break outer;
        }
      }
    }
  }
  if (pairI < 0 || pairJ < 0) return [];
  const hi = Math.max(pairI, pairJ);
  const lo = Math.min(pairI, pairJ);
  const taken = [majors.splice(hi, 1)[0]!, majors.splice(lo, 1)[0]!];
  for (const c of taken) {
    if (c) state.veil.push(c);
  }
  return taken.filter(Boolean);
}

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

export function dialBonus(state: GameState, ctx: EngineCtx, cardId: string | "pass"): number {
  if (cardId === "pass") return 0;
  if (state.meta.dial === "none") return 0;
  if (!ctx.ruleset.experimental.enableDayDial) return 0;
  const deck = ctx.catalog.get(cardId)?.deck;
  if (state.meta.dial === "day" && deck === "sunlight") return 1;
  if (state.meta.dial === "night" && deck === "moonlight") return 1;
  return 0;
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

/** Majors never enter a player hand: PD if empty, otherwise Altar. Joker token is allowed in hand. */
export function divertMajor(
  state: GameState,
  ctx: EngineCtx,
  card: CardInstance,
  reason: string,
): boolean {
  const def = defOf(ctx.catalog, card);
  if (def.arcana !== "major") return false;
  if (isJoker(def)) return false;
  if (!top(state.roundTable.pd)) {
    card.arrivedTurn = state.meta.turn;
    state.roundTable.pd = [card];
    pushEvent(state, { type: "MAJOR_DIVERTED", cardId: card.cardId, dest: "pd", reason });
    return true;
  }
  state.altar.major.push(card);
  const spilled = overflowAltar(state, "major", ctx.ruleset.experimental.altarMajorCap);
  for (const c of spilled) {
    pushEvent(state, { type: "ALTAR_OVERFLOW", pile: "major", cardId: c.cardId, dest: "veil" });
  }
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
    const c = takeMinorFromDraw(state, ctx);
    if (!c) break;
    giveToHand(state, playerId, c, limit, ctx);
    got.push(c);
  }
  return got;
}

/** Opening deals skip Majors so they stay in the deck instead of dumping onto PD/Altar/Veil. */
export function takeMinorFromDraw(state: GameState, ctx: EngineCtx): CardInstance | undefined {
  const skipped: CardInstance[] = [];
  const n = state.drawDeck.length;
  for (let i = 0; i < n + 1; i++) {
    const c = drawOne(state, ctx);
    if (!c) break;
    if (defOf(ctx.catalog, c).arcana === "major") {
      skipped.push(c);
      continue;
    }
    state.drawDeck.push(...skipped);
    return c;
  }
  state.drawDeck.push(...skipped);
  return undefined;
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

export function hurt(state: GameState, playerId: string, amount: number, ctx?: EngineCtx): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || amount <= 0) return 0;
  const before = p.health;
  const floor = ctx?.ruleset.experimental.preventDeath ? 1 : 0;
  p.health = Math.max(floor, p.health - amount);
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

/** Pamphlet Fire: send LEFT to the top of the draw pile. */
export function firePush(state: GameState, _ctx?: EngineCtx): boolean {
  const sent = takeTop(state.roundTable.left);
  if (!sent) return false;
  state.drawDeck.unshift(sent);
  return true;
}

/** Pamphlet Air: send LEFT under the draw pile. */
export function airBury(state: GameState): boolean {
  const sent = takeTop(state.roundTable.left);
  if (!sent) return false;
  state.drawDeck.push(sent);
  return true;
}

/** Pamphlet Water: return a card from the Veil onto LEFT. */
export function waterBring(state: GameState): boolean {
  if (!state.veil.length) return false;
  const up = state.veil.pop();
  if (!up) return false;
  const displaced = takeTop(state.roundTable.left);
  state.roundTable.left = [up];
  if (displaced) state.veil.push(displaced);
  return true;
}

/** Downed seats (HP ≤ 0). Living filters exclude these. */
export function downedPlayers(state: GameState) {
  return state.players.filter((p) => p.health <= 0);
}

/**
 * Water manip: if revival is on and someone is down, stand them up to revivalHealth.
 * Otherwise Veil → LEFT (pamphlet table control). Healing-on-living is still a later verb.
 */
export function applyWaterManip(
  state: GameState,
  ctx: EngineCtx,
): { ok: boolean; revivedPlayerId?: string; healthGranted?: number } {
  if (ctx.ruleset.experimental.enableRevival) {
    const down = downedPlayers(state)[0];
    if (down) {
      const hp = Math.max(1, ctx.ruleset.experimental.revivalHealth || 1);
      down.health = hp;
      return { ok: true, revivedPlayerId: down.id, healthGranted: hp };
    }
  }
  return { ok: waterBring(state) };
}

/** Seats Earth can reorder. PD is locked while a Major sits there. */
export function earthMovableSeats(state: GameState, ctx: EngineCtx): TableSlot[] {
  const out: TableSlot[] = [];
  for (const s of ["left", "middle", "pd"] as const) {
    const c = top(state.roundTable[s]);
    if (!c) continue;
    if (s === "pd" && isMajorCard(ctx, c)) continue;
    out.push(s);
  }
  return out;
}

/**
 * Pamphlet Earth: reorder LEFT / MIDDLE / (PD if not a Major).
 * `order` is a permutation of the movable seats: order[i] is the source seat
 * whose card moves onto movableSeats[i] (LEFT→MIDDLE→PD among those seats).
 */
export function earthOrder(state: GameState, ctx: EngineCtx, order: TableSlot[]): boolean {
  const dests = earthMovableSeats(state, ctx);
  if (dests.length < 2) return false;
  if (order.length !== dests.length) return false;
  if (new Set(order).size !== order.length) return false;
  if (!order.every((s) => dests.includes(s))) return false;
  if (order.every((s, i) => s === dests[i])) return false;

  const taken = new Map<TableSlot, CardInstance>();
  for (const s of dests) {
    const c = takeTop(state.roundTable[s]);
    if (!c) return false;
    taken.set(s, c);
  }
  for (let i = 0; i < dests.length; i++) {
    const dest = dests[i]!;
    const src = order[i]!;
    const card = taken.get(src);
    if (!card) return false;
    state.roundTable[dest] = [card];
  }
  return true;
}

export function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const head = items[i]!;
    const rest = items.filter((_, j) => j !== i);
    for (const tail of permutations(rest)) out.push([head, ...tail]);
  }
  return out;
}

export function isMajorCard(ctx: EngineCtx, card: CardInstance | undefined): boolean {
  return !!card && defOf(ctx.catalog, card).arcana === "major";
}

/** Slide minors toward LEFT, then draw so PD (and holes) stay occupied. */
export function fillRoundTable(state: GameState, ctx: EngineCtx): GameEvent[] {
  if (ctx.ruleset.experimental.keepRoundTableFilled === false) return [];
  const events: GameEvent[] = [];
  for (let n = 0; n < 12; n++) {
    let moved = false;
    if (!top(state.roundTable.left) && top(state.roundTable.middle)) {
      const card = takeTop(state.roundTable.middle);
      if (card) {
        state.roundTable.left = [card];
        events.push(pushEvent(state, { type: "MIDDLE_TO_LEFT", cardId: card.cardId, reason: "fill" }));
        moved = true;
      }
    }
    const pd = top(state.roundTable.pd);
    if (!top(state.roundTable.middle) && pd && !isMajorCard(ctx, pd)) {
      takeTop(state.roundTable.pd);
      state.roundTable.middle = [pd];
      events.push(pushEvent(state, { type: "PD_TO_MIDDLE", cardId: pd.cardId, reason: "fill" }));
      moved = true;
    }
    if (!top(state.roundTable.pd)) {
      const drawn = drawOne(state, ctx);
      if (drawn) {
        drawn.arrivedTurn = state.meta.turn;
        state.roundTable.pd = [drawn];
        events.push(
          pushEvent(state, {
            type: "DRAW_TO_PD",
            cardId: drawn.cardId,
            arcana: defOf(ctx.catalog, drawn).arcana,
            reason: "fill",
          }),
        );
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const slot of ["left", "middle"] as const) {
    while (!top(state.roundTable[slot])) {
      const drawn = drawOne(state, ctx);
      if (!drawn) break;
      if (isMajorCard(ctx, drawn)) {
        // One divert then stop — do not keep drawing courts into a majors blender.
        divertMajor(state, ctx, drawn, `fill_${slot}`);
        break;
      }
      drawn.arrivedTurn = state.meta.turn;
      state.roundTable[slot] = [drawn];
      events.push(pushEvent(state, { type: "TABLE_FILL", slot, cardId: drawn.cardId }));
    }
  }
  return events;
}

export function matchingTableRoyals(state: GameState, ctx: EngineCtx): { a: string; b: string; rank: number } | null {
  const seats = (["left", "middle", "pd"] as const)
    .map((s) => top(state.roundTable[s]))
    .filter((c): c is CardInstance => !!c && isMajorCard(ctx, c));
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const a = defOf(ctx.catalog, seats[i]!);
      const b = defOf(ctx.catalog, seats[j]!);
      const pairLinked = a.pairId === b.id || b.pairId === a.id;
      const sunMoonSameRank = a.rank === b.rank && a.deck !== b.deck;
      const inkA = defInk(a);
      const inkB = defInk(b);
      const redBlackCourts =
        a.tags.includes("court") &&
        b.tags.includes("court") &&
        inkA &&
        inkB &&
        inkA !== inkB;
      // Pair by catalog pair / Sun↔Moon same rank, or L0 courts of opposite pip ink (red+black).
      if (pairLinked || sunMoonSameRank || redBlackCourts) {
        return { a: a.id, b: b.id, rank: a.rank };
      }
    }
  }
  return null;
}

/** Grant Eclipse + put the Joker token into that player's hand (once). */
export function grantEclipse(state: GameState, playerId: string, ctx: EngineCtx): GameEvent[] {
  const p = state.players.find((x) => x.id === playerId);
  if (!p || p.eclipse) return [];
  p.eclipse = true;
  p.joker.active = true;
  const events: GameEvent[] = [];
  if (!p.hand.some((c) => c.cardId === JOKER_ID) && ctx.catalog.get(JOKER_ID)) {
    const card: CardInstance = {
      instanceId: `joker-${playerId}-${state.meta.clock}`,
      cardId: JOKER_ID,
    };
    p.hand.push(card);
    events.push(pushEvent(state, { type: "JOKER_TO_HAND", playerId, cardId: JOKER_ID }));
  }
  return events;
}

export function dealStartingAces(state: GameState, ctx: EngineCtx): GameEvent[] {
  if (!ctx.ruleset.experimental.enableLineage || !ctx.ruleset.experimental.dealStartingAce) return [];
  const events: GameEvent[] = [];
  const used = new Set<string>();
  for (const p of state.players) {
    if (p.lineage.length) continue;
    let i = state.drawDeck.findIndex((c) => {
      const d = defOf(ctx.catalog, c);
      return d.arcana === "minor" && d.rank === 1 && !!d.lineageId && !used.has(d.lineageId);
    });
    if (i < 0) {
      i = state.drawDeck.findIndex((c) => {
        const d = defOf(ctx.catalog, c);
        return d.arcana === "minor" && d.rank === 1;
      });
    }
    if (i < 0) continue;
    const ace = state.drawDeck.splice(i, 1)[0];
    if (!ace) continue;
    const lid = defOf(ctx.catalog, ace).lineageId;
    if (lid) used.add(lid);
    p.lineage.push(ace);
    events.push(
      pushEvent(state, {
        type: "LINEAGE_CLAIMED",
        playerId: p.id,
        cardId: ace.cardId,
        turn: 0,
        source: "deal",
      }),
    );
  }
  return events;
}

/** Leftover Aces leave the draw pile so Water has something before the first discards. */
export function seedLeftoverAcesToVeil(state: GameState, ctx: EngineCtx): GameEvent[] {
  const events: GameEvent[] = [];
  const keep: CardInstance[] = [];
  for (const c of state.drawDeck) {
    const d = defOf(ctx.catalog, c);
    if (d.arcana === "minor" && d.rank === 1) {
      state.veil.push(c);
      events.push(pushEvent(state, { type: "ACE_TO_VEIL", cardId: c.cardId, source: "setup" }));
    } else {
      keep.push(c);
    }
  }
  state.drawDeck = keep;
  return events;
}

export function rollDie(state: GameState, faces: number, playerId?: string): number {
  const r = rngNextInt(state.gameRng, faces);
  state.gameRng = r.rng;
  const raw = r.value + 1;
  return playerId ? Math.min(faces, eclipseBonus(state, playerId, raw)) : raw;
}
