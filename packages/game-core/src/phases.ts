import { defOf } from "./cards.js";
import {
  activePlayer,
  dealToHand,
  divertMajor,
  drawOne,
  earthSwap,
  eclipseBonus,
  firePush,
  giveToHand,
  hurt,
  livingPlayers,
  overflowAltar,
  pushEvent,
  rollDie,
  shuffleSlots,
  takeTop,
  top,
  waterBring,
} from "./ops.js";
import { canPlaceOnLineage } from "./lineage.js";
import { ADVANCES_PER_ROUND } from "./rulesets/l0.js";
import type {
  Action,
  CardInstance,
  EngineCtx,
  EventKind,
  GameEvent,
  GameState,
  PhaseId,
} from "./types.js";

export interface ApplyResult {
  events: GameEvent[];
  advance: boolean;
}

function nextPhase(state: GameState, rulesetPhases: PhaseId[]): PhaseId {
  if (state.meta.outcome !== "playing") return "OVER";
  const i = rulesetPhases.indexOf(state.meta.phase);
  if (state.meta.phase === "TURN_END") return "TURN_START";
  if (state.meta.phase === "SETUP") return "TURN_START";
  return rulesetPhases[i + 1] ?? "TURN_END";
}

function goNext(state: GameState, ctx: EngineCtx, from: PhaseId): GameEvent {
  const to = nextPhase(state, ctx.ruleset.phases);
  state.meta.phase = to;
  return pushEvent(state, {
    type: "PHASE_CHANGED",
    from,
    to,
    turn: state.meta.turn,
    activePlayerId: state.meta.activePlayerId,
  });
}

function classifyEvent(roll: number, ctx: EngineCtx): EventKind | "none" {
  const exp = ctx.ruleset.experimental;
  const { eventBarrierMax, eventDialogueMax } = exp;
  let kind: EventKind;
  if (roll <= eventBarrierMax) kind = "barrier";
  else if (roll <= eventDialogueMax) kind = "dialogue";
  else kind = "treasure";
  if (kind === "barrier" && exp.enableBarrier === false) return "none";
  if (kind === "dialogue" && exp.enableDialogue === false) return "none";
  if (kind === "treasure" && exp.enableTreasure === false) return "none";
  return kind;
}

function finishIfNeeded(state: GameState, ctx: EngineCtx): GameEvent | undefined {
  if (livingPlayers(state).length === 0) {
    state.meta.outcome = "party_down";
    state.meta.phase = "OVER";
    return pushEvent(state, { type: "GAME_OVER", outcome: "party_down" });
  }
  return undefined;
}

function rotateLeader(state: GameState): void {
  const ids = state.players.map((p) => p.id);
  const start = ids.indexOf(state.meta.activePlayerId);
  for (let k = 1; k <= ids.length; k++) {
    const id = ids[(start + k) % ids.length];
    const p = state.players.find((x) => x.id === id);
    if (p && p.health > 0) {
      state.meta.activePlayerId = p.id;
      return;
    }
  }
}

function isMajor(ctx: EngineCtx, card: CardInstance | undefined): boolean {
  return !!card && defOf(ctx.catalog, card).arcana === "major";
}

function committers(state: GameState, ctx: EngineCtx): string[] {
  if (state.flags.lastEvent === "barrier") return [state.meta.activePlayerId];
  if (state.flags.lastEvent === "dialogue") {
    return ctx.ruleset.experimental.dialogueParticipants === "all_living"
      ? livingPlayers(state).map((p) => p.id)
      : [state.meta.activePlayerId];
  }
  return [];
}

function commitsComplete(state: GameState, ctx: EngineCtx): boolean {
  const need = committers(state, ctx);
  return need.length > 0 && need.every((id) => id in state.flags.commits);
}

export function applyAction(state: GameState, action: Action, ctx: EngineCtx): ApplyResult {
  const events: GameEvent[] = [];
  const from = state.meta.phase;
  state.meta.clock += 1;

  if (state.meta.phase === "OVER") return { events, advance: false };

  if (action.type === "SKIP_MANIP" || action.type === "MANIP") {
    events.push(...applyManip(state, action, ctx));
    events.push(goNext(state, ctx, from));
    return { events, advance: true };
  }

  if (action.type === "TAKE_REWARD") {
    events.push(...applyReward(state, action, ctx));
    events.push(goNext(state, ctx, from));
    return { events, advance: true };
  }

  if (action.type === "COMMIT") {
    events.push(...applyCommit(state, action, ctx));
    if (commitsComplete(state, ctx)) {
      events.push(...finishEvent(state, ctx));
      if (state.meta.outcome === "playing") events.push(goNext(state, ctx, from));
    }
    return { events, advance: true };
  }

  events.push(...applyAdvancePhase(state, ctx));
  const hold =
    state.meta.phase === "RESOLVE_EVENT" &&
    (state.flags.lastEvent === "barrier" || state.flags.lastEvent === "dialogue") &&
    !commitsComplete(state, ctx);
  if (state.meta.outcome === "playing" && !hold) {
    events.push(goNext(state, ctx, from));
  }
  return { events, advance: true };
}

function applyAdvancePhase(state: GameState, ctx: EngineCtx): GameEvent[] {
  switch (state.meta.phase) {
    case "SETUP":
      return setup(state, ctx);
    case "TURN_START":
      return turnStart(state, ctx);
    case "PD_RESURFACE":
      return pdResurface(state, ctx);
    case "ADVANCE_ROUND_TABLE":
      return advanceTable(state, ctx);
    case "NORMALIZE_MAJORS":
      return [];
    case "CHECK_NEXUS":
      return checkNexus(state, ctx);
    case "ROLL_EVENT":
      return rollEvent(state, ctx);
    case "RESOLVE_EVENT":
      return enterResolve(state, ctx);
    case "LINEAGE_EVOLUTION":
      return evolve(state, ctx);
    case "ECLIPSE_NEXUS_CHECK":
      return eclipseCheck(state, ctx);
    case "TURN_END":
      return turnEnd(state, ctx);
    default:
      return [];
  }
}

function setup(state: GameState, ctx: EngineCtx): GameEvent[] {
  const events: GameEvent[] = [];
  const limit = ctx.ruleset.experimental.handLimit;
  const n = ctx.ruleset.experimental.startingHandSize;
  state.meta.turn = 1;
  state.meta.round = 1;
  for (const p of state.players) {
    const got = dealToHand(state, p.id, n, limit, ctx);
    events.push(pushEvent(state, { type: "DEAL_HAND", playerId: p.id, count: got.length }));
  }
  events.push(pushEvent(state, { type: "ROUND_BEGAN", round: 1, of: ctx.ruleset.experimental.rounds }));
  return events;
}

function turnStart(state: GameState, ctx: EngineCtx): GameEvent[] {
  state.flags.manipUsedThisTurn = false;
  state.flags.lastEvent = null;
  state.flags.lastEventRoll = null;
  state.flags.commits = {};
  const over = finishIfNeeded(state, ctx);
  if (over) return [over];
  if (activePlayer(state).health <= 0) rotateLeader(state);
  return [
    pushEvent(state, {
      type: "TURN_BEGAN",
      playerId: state.meta.activePlayerId,
      turn: state.meta.turn,
    }),
  ];
}

function pdResurface(state: GameState, ctx: EngineCtx): GameEvent[] {
  const card = top(state.roundTable.pd);
  if (!isMajor(ctx, card) || !card) return [];
  if ((card.arrivedTurn ?? state.meta.turn) >= state.meta.turn) return [];
  takeTop(state.roundTable.pd);
  state.altar.major.push(card);
  overflowAltar(state, "major", ctx.ruleset.experimental.altarMajorCap);
  return [pushEvent(state, { type: "PD_RESURFACED", cardId: card.cardId, dest: "altar.major" })];
}

function advanceTable(state: GameState, ctx: EngineCtx): GameEvent[] {
  const events: GameEvent[] = [];
  const leftover = takeTop(state.roundTable.left);
  if (leftover) {
    state.veil.push(leftover);
    events.push(pushEvent(state, { type: "LEFT_UNCLAIMED", cardId: leftover.cardId, dest: "veil" }));
  }
  const fromMiddle = takeTop(state.roundTable.middle);
  if (fromMiddle) {
    state.roundTable.left = [fromMiddle];
    events.push(pushEvent(state, { type: "MIDDLE_TO_LEFT", cardId: fromMiddle.cardId }));
  }
  const pd = top(state.roundTable.pd);
  if (pd && !isMajor(ctx, pd)) {
    takeTop(state.roundTable.pd);
    state.roundTable.middle = [pd];
    events.push(pushEvent(state, { type: "PD_TO_MIDDLE", cardId: pd.cardId }));
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
        }),
      );
    } else if (!top(state.roundTable.left) && !top(state.roundTable.middle)) {
      state.meta.outcome = "deck_exhausted";
      state.meta.phase = "OVER";
      events.push(pushEvent(state, { type: "GAME_OVER", outcome: "deck_exhausted" }));
    }
  }
  return events;
}

function checkNexus(state: GameState, ctx: EngineCtx): GameEvent[] {
  if (ctx.ruleset.experimental.enableNexus === false) {
    state.flags.nexus = false;
    return [pushEvent(state, { type: "NEXUS_CHECK", nexus: false, skipped: true, turn: state.meta.turn })];
  }
  const els = (["left", "middle", "pd"] as const)
    .map((s) => top(state.roundTable[s]))
    .map((c) => (c ? defOf(ctx.catalog, c).element : undefined));
  const filled = els.filter((e) => e);
  const nexus = filled.length === 3 && filled.every((e) => e === filled[0]);
  state.flags.nexus = nexus;
  return [pushEvent(state, { type: "NEXUS_CHECK", nexus, elements: els, turn: state.meta.turn })];
}

function applyManip(state: GameState, action: Action, ctx: EngineCtx): GameEvent[] {
  if (ctx.ruleset.experimental.enableElementalManipulation === false) {
    state.flags.manipUsedThisTurn = true;
    return [pushEvent(state, { type: "MANIP_SKIPPED", reason: "disabled" })];
  }
  const allowed =
    ctx.ruleset.manipulation.paymentMode === "free" || ctx.ruleset.experimental.manipulationFree;
  if (!allowed) return [pushEvent(state, { type: "MANIP_SKIPPED", reason: "payment_unspecified" })];
  if (action.type === "SKIP_MANIP") {
    state.flags.manipUsedThisTurn = true;
    return [pushEvent(state, { type: "MANIP_SKIPPED", reason: "player" })];
  }
  if (action.type !== "MANIP") return [];
  let ok = false;
  if (action.element === "air") {
    shuffleSlots(state);
    ok = true;
  } else if (action.element === "fire") ok = firePush(state, ctx);
  else if (action.element === "water") ok = waterBring(state);
  else if (action.element === "earth") ok = earthSwap(state);
  state.flags.manipUsedThisTurn = true;
  return [pushEvent(state, { type: "MANIP_USED", element: action.element, ok })];
}

function rollEvent(state: GameState, ctx: EngineCtx): GameEvent[] {
  state.flags.commits = {};
  const roll = rollDie(state, 6, state.meta.activePlayerId);
  const kind = classifyEvent(roll, ctx);
  state.flags.lastEventRoll = roll;
  state.flags.lastEvent = kind === "none" ? null : kind;
  return [pushEvent(state, { type: "EVENT_ROLLED", roll, kind })];
}

function enterResolve(state: GameState, ctx: EngineCtx): GameEvent[] {
  if (state.flags.lastEvent === "treasure") return resolveTreasure(state, ctx);
  if (state.flags.lastEvent === "barrier" || state.flags.lastEvent === "dialogue") {
    return [pushEvent(state, { type: "EVENT_WAITING_COMMITS", kind: state.flags.lastEvent })];
  }
  return [pushEvent(state, { type: "EVENT_NONE" })];
}

function applyCommit(state: GameState, action: Extract<Action, { type: "COMMIT" }>, ctx: EngineCtx): GameEvent[] {
  const p = state.players.find((x) => x.id === action.playerId);
  if (!p) return [];
  if (action.cardId !== "pass") {
    const i = p.hand.findIndex((c) => c.instanceId === action.cardId || c.cardId === action.cardId);
    if (i < 0) return [pushEvent(state, { type: "COMMIT_FAILED", playerId: action.playerId })];
    const card = p.hand.splice(i, 1)[0];
    if (card) state.veil.push(card);
    state.flags.commits[action.playerId] = card?.cardId ?? "pass";
    return [
      pushEvent(state, {
        type: "COMMITTED",
        playerId: action.playerId,
        cardId: card?.cardId ?? null,
        hidden: true,
      }),
    ];
  }
  state.flags.commits[action.playerId] = "pass";
  return [pushEvent(state, { type: "COMMITTED", playerId: action.playerId, cardId: null, hidden: true })];
}

function rankOf(ctx: EngineCtx, cardId: string | "pass"): number {
  if (cardId === "pass") return 0;
  return ctx.catalog.get(cardId)?.rank ?? 0;
}

function finishEvent(state: GameState, ctx: EngineCtx): GameEvent[] {
  const exp = ctx.ruleset.experimental;
  const events: GameEvent[] = [];
  if (state.flags.lastEvent === "barrier") {
    const pid = state.meta.activePlayerId;
    const raw = rankOf(ctx, state.flags.commits[pid] ?? "pass");
    const total = eclipseBonus(state, pid, raw);
    const success = total >= exp.barrierThreshold;
    events.push(pushEvent(state, { type: "BARRIER_RESOLVED", success, total, threshold: exp.barrierThreshold }));
    if (!success) {
      const dmg = hurt(state, pid, exp.barrierDamage);
      events.push(pushEvent(state, { type: "BARRIER_FAIL", playerId: pid, damage: dmg }));
      if (activePlayer(state).health <= 0) rotateLeader(state);
      const over = finishIfNeeded(state, ctx);
      if (over) events.push(over);
    } else {
      events.push(pushEvent(state, { type: "BARRIER_SUCCESS", playerId: pid }));
    }
  } else if (state.flags.lastEvent === "dialogue") {
    const ids = committers(state, ctx);
    let bowl = 0;
    for (const id of ids) {
      bowl += eclipseBonus(state, id, rankOf(ctx, state.flags.commits[id] ?? "pass"));
    }
    const success = bowl >= exp.dialogueThreshold;
    events.push(pushEvent(state, { type: "DIALOGUE_RESOLVED", success, bowl, threshold: exp.dialogueThreshold, participants: ids }));
    if (success) {
      const seats: Array<"left" | "middle" | "pd"> = ["left", "middle", "pd"];
      ids.forEach((id, i) => {
        const slot = seats[i];
        if (!slot) return;
        const card = takeTop(state.roundTable[slot]);
        if (!card) return;
        giveToHand(state, id, card, exp.handLimit, ctx);
        events.push(pushEvent(state, { type: "DIALOGUE_REWARD", playerId: id, cardId: card.cardId, slot }));
      });
    }
  }
  return events;
}

function resolveTreasure(state: GameState, ctx: EngineCtx): GameEvent[] {
  const p = activePlayer(state);
  const got = dealToHand(
    state,
    p.id,
    ctx.ruleset.experimental.treasureDraw,
    ctx.ruleset.experimental.handLimit,
    ctx,
  );
  return [pushEvent(state, { type: "TREASURE", playerId: p.id, count: got.length })];
}

function applyReward(state: GameState, action: Extract<Action, { type: "TAKE_REWARD" }>, ctx: EngineCtx): GameEvent[] {
  const card = takeTop(state.roundTable.left);
  if (!card) return [pushEvent(state, { type: "REWARD_EMPTY" })];
  const p = activePlayer(state);
  const limit = ctx.ruleset.experimental.handLimit;
  if (isMajor(ctx, card) && (action.dest === "hand" || action.dest === "lineage")) {
    divertMajor(state, ctx, card, `reward_${action.dest}`);
    return [pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: "diverted" })];
  }
  if (action.dest === "hand") giveToHand(state, p.id, card, limit, ctx);
  else if (action.dest === "altar") {
    const def = defOf(ctx.catalog, card);
    if (def.arcana === "major") state.altar.major.push(card);
    else state.altar.minors.push(card);
    overflowAltar(state, "minors", ctx.ruleset.experimental.altarMinorCap);
    overflowAltar(state, "major", ctx.ruleset.experimental.altarMajorCap);
  } else if (action.dest === "lineage") {
    if (!canPlaceOnLineage(ctx, p, card)) {
      state.veil.push(card);
      return [
        pushEvent(state, {
          type: "REWARD_TAKEN",
          cardId: card.cardId,
          dest: "veil",
          reason: "lineage_illegal",
        }),
      ];
    }
    p.lineage.push(card);
  } else {
    state.veil.push(card);
  }
  return [pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: action.dest })];
}

function evolve(state: GameState, ctx: EngineCtx): GameEvent[] {
  if (ctx.ruleset.experimental.enableLineage === false) {
    return [pushEvent(state, { type: "LINEAGE_NONE", skipped: true })];
  }
  const events: GameEvent[] = [];
  const p = activePlayer(state);
  const step = ctx.ruleset.experimental.evolutionStep;
  const current = p.lineage.at(-1);
  if (!current && ctx.ruleset.experimental.autoClaimAceLineage) {
    const i = p.hand.findIndex((c) => defOf(ctx.catalog, c).rank === 1);
    if (i >= 0) {
      const ace = p.hand.splice(i, 1)[0];
      if (ace) {
        p.lineage.push(ace);
        events.push(pushEvent(state, { type: "LINEAGE_CLAIMED", playerId: p.id, cardId: ace.cardId, turn: state.meta.turn }));
      }
    }
  }
  const cur = p.lineage.at(-1);
  if (cur) {
    const curDef = defOf(ctx.catalog, cur);
    const i = p.hand.findIndex((c) => {
      const d = defOf(ctx.catalog, c);
      return d.rank === curDef.rank + step && d.lineageId === curDef.lineageId;
    });
    if (i >= 0) {
      const next = p.hand.splice(i, 1)[0];
      if (next) {
        p.lineage.push(next);
        events.push(pushEvent(state, { type: "LINEAGE_EVOLVED", playerId: p.id, cardId: next.cardId, turn: state.meta.turn }));
      }
    }
  }
  if (!events.length) events.push(pushEvent(state, { type: "LINEAGE_NONE" }));
  return events;
}

function eclipseCheck(state: GameState, ctx: EngineCtx): GameEvent[] {
  const p = activePlayer(state);
  if (ctx.ruleset.experimental.enableEclipse === false) {
    return [pushEvent(state, { type: "ECLIPSE_CHECK", playerId: p.id, skipped: true, ready: false })];
  }
  const majors = state.altar.major.filter((c) => defOf(ctx.catalog, c).arcana === "major");
  if (!p.eclipse && majors.length >= 2) {
    p.eclipse = true;
    p.joker.active = true;
    return [
      pushEvent(state, {
        type: "ECLIPSE",
        playerId: p.id,
        bonus: ctx.ruleset.experimental.eclipseBonus,
        turn: state.meta.turn,
      }),
    ];
  }
  return [pushEvent(state, { type: "ECLIPSE_CHECK", playerId: p.id, ready: majors.length >= 2 })];
}

function turnEnd(state: GameState, ctx: EngineCtx): GameEvent[] {
  const events: GameEvent[] = [];
  const maxTurns = ctx.ruleset.experimental.maxTurns;
  const advances = ctx.ruleset.experimental.tableAdvancesPerRound || ADVANCES_PER_ROUND;
  const justFinished = state.meta.turn;
  const roundBoundary = justFinished % advances === 0;
  const closing = justFinished >= maxTurns;
  if (roundBoundary) {
    events.push(
      pushEvent(state, {
        type: "ROUND_ENDED",
        from: state.meta.round,
        to: closing ? state.meta.round : state.meta.round + 1,
        turn: justFinished,
        final: closing,
      }),
    );
  }
  if (closing) {
    state.meta.outcome = "turn_limit";
    state.meta.phase = "OVER";
    events.push(pushEvent(state, { type: "GAME_OVER", outcome: "turn_limit", turn: justFinished }));
    return events;
  }
  rotateLeader(state);
  state.meta.turn += 1;
  if ((state.meta.turn - 1) % advances === 0) {
    state.meta.round += 1;
    events.push(
      pushEvent(state, {
        type: "ROUND_BEGAN",
        round: state.meta.round,
        of: ctx.ruleset.experimental.rounds,
      }),
    );
  }
  events.push(
    pushEvent(state, {
      type: "TURN_ENDED",
      nextPlayerId: state.meta.activePlayerId,
      turn: state.meta.turn,
    }),
  );
  return events;
}
