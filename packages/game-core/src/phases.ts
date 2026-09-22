import { defOf } from "./cards.js";
import { dialForTurn } from "./dial.js";
import {
  activePlayer,
  airBury,
  altarHasRedBlackPair,
  dealStartingAces,
  divertMajor,
  dealToHand,
  drawOne,
  earthOrder,
  earthMovableSeats,
  fillRoundTable,
  firePush,
  giveToHand,
  grantEclipse,
  hurt,
  livingPlayers,
  matchingTableRoyals,
  overflowAltar,
  permutations,
  pushEvent,
  rollDie,
  seedLeftoverAcesToVeil,
  takeTop,
  top,
  waterBring,
} from "./ops.js";
import { autoEvolveFromHand, canPlaceOnLineage, nextLineageNeed } from "./lineage.js";
import { barrierChallenge, barrierOpportunity, commitPower, dialogueChallenge, eventKindFromDie } from "./score.js";
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
  const kind = eventKindFromDie(roll, exp.eventDialogueMax, exp.eventBarrierMax);
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

  if (action.type === "CHOOSE_CHARACTER") {
    events.push(...applyCharacter(state, action));
    return { events, advance: true };
  }

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
      const done = resolveOrContinueCombat(state, ctx);
      events.push(...done.events);
      if (done.finished && state.meta.outcome === "playing") events.push(goNext(state, ctx, from));
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

function applyCharacter(
  state: GameState,
  action: Extract<Action, { type: "CHOOSE_CHARACTER" }>,
): GameEvent[] {
  const p = activePlayer(state);
  if (!state.hold) state.hold = { nexus: [], characters: [] };
  const i = state.hold.characters.findIndex((c) => c.cardId === action.cardId);
  const card = i >= 0 ? state.hold.characters.splice(i, 1)[0] : undefined;
  if (!card || p.aspect) {
    return [pushEvent(state, { type: "CHARACTER_REJECTED", playerId: p.id, cardId: action.cardId })];
  }
  p.aspect = card.cardId;
  p.lineage.push(card);
  return [
    pushEvent(state, {
      type: "CHARACTER_CLAIMED",
      playerId: p.id,
      cardId: card.cardId,
      impact: "pending",
    }),
  ];
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
    case "LINEAGE_EVOLUTION": {
      const filled = fillRoundTable(state, ctx);
      return [...filled, ...evolve(state, ctx)];
    }
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
  events.push(...dealStartingAces(state, ctx));
  events.push(...seedLeftoverAcesToVeil(state, ctx));
  for (const p of state.players) {
    const dealt = dealToHand(state, p.id, n, limit, ctx);
    events.push(pushEvent(state, { type: "DEAL_HAND", playerId: p.id, count: dealt.length }));
  }
  for (const p of state.players) {
    const grown = autoEvolveFromHand(ctx, p);
    if (grown.length) {
      for (const card of grown) {
        events.push(
          pushEvent(state, {
            type: "LINEAGE_EVOLVED",
            playerId: p.id,
            cardId: card.cardId,
            turn: 0,
            source: "deal",
          }),
        );
      }
    } else {
      const need = nextLineageNeed(ctx, p);
      events.push(
        pushEvent(state, {
          type: "LINEAGE_NONE",
          playerId: p.id,
          source: "deal",
          neededRank: need?.rank ?? null,
        }),
      );
    }
  }
  events.push(pushEvent(state, { type: "ROUND_BEGAN", round: 1, of: ctx.ruleset.experimental.rounds }));
  return events;
}

function turnStart(state: GameState, ctx: EngineCtx): GameEvent[] {
  state.flags.manipUsedThisTurn = false;
  state.flags.lastEvent = null;
  state.flags.lastEventRoll = null;
  state.flags.commits = {};
  state.flags.combatRound = 0;
  state.flags.combatBowl = 0;
  const over = finishIfNeeded(state, ctx);
  if (over) return [over];
  if (activePlayer(state).health <= 0) rotateLeader(state);
  const events: GameEvent[] = [
    pushEvent(state, {
      type: "TURN_BEGAN",
      playerId: state.meta.activePlayerId,
      turn: state.meta.turn,
    }),
  ];
  if (ctx.ruleset.experimental.enableDayDial) {
    const dial = dialForTurn(state.meta.turn, state.meta.playerCount, state.meta.round);
    state.meta.dial = dial;
    events.push(pushEvent(state, { type: "DIAL_SET", dial, turn: state.meta.turn, round: state.meta.round }));
  } else {
    state.meta.dial = "none";
  }
  return events;
}

function pdResurface(state: GameState, ctx: EngineCtx): GameEvent[] {
  const card = top(state.roundTable.pd);
  if (!isMajor(ctx, card) || !card) return [];
  if ((card.arrivedTurn ?? state.meta.turn) >= state.meta.turn) return [];
  takeTop(state.roundTable.pd);
  state.altar.major.push(card);
  const spilled = overflowAltar(state, "major", ctx.ruleset.experimental.altarMajorCap);
  const events: GameEvent[] = [
    pushEvent(state, { type: "PD_RESURFACED", cardId: card.cardId, dest: "altar.major" }),
  ];
  for (const c of spilled) {
    events.push(pushEvent(state, { type: "ALTAR_OVERFLOW", pile: "major", cardId: c.cardId, dest: "veil" }));
  }
  return events;
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
  events.push(...fillRoundTable(state, ctx));
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
    return [pushEvent(state, { type: "MANIP_PASSED", reason: "player" })];
  }
  if (action.type !== "MANIP") return [];
  let ok = false;
  if (action.element === "air") ok = airBury(state);
  else if (action.element === "fire") ok = firePush(state, ctx);
  else if (action.element === "water") ok = waterBring(state);
  else if (action.element === "earth") {
    ok = Boolean(action.order && earthOrder(state, ctx, action.order));
  }
  state.flags.manipUsedThisTurn = true;
  const events: GameEvent[] = [
    pushEvent(state, {
      type: "MANIP_USED",
      element: action.element,
      ok,
      order: action.element === "earth" ? action.order : undefined,
    }),
  ];
  if (ok) events.push(...fillRoundTable(state, ctx));
  return events;
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
    state.flags.combatRound = 1;
    state.flags.combatBowl = 0;
    state.flags.commits = {};
    return [
      pushEvent(state, {
        type: "EVENT_WAITING_COMMITS",
        kind: state.flags.lastEvent,
        round: 1,
        of: ctx.ruleset.experimental.eventCombatRounds ?? 1,
      }),
    ];
  }
  return [pushEvent(state, { type: "EVENT_NONE" })];
}

function roundCommitPower(state: GameState, ctx: EngineCtx): number {
  let bowl = 0;
  for (const id of committers(state, ctx)) {
    bowl += commitPower(state, ctx, id, state.flags.commits[id] ?? "pass");
  }
  return bowl;
}

/** After all seats commit: accumulate, maybe start another round, else finish. */
function resolveOrContinueCombat(state: GameState, ctx: EngineCtx): { events: GameEvent[]; finished: boolean } {
  const maxRounds = ctx.ruleset.experimental.eventCombatRounds ?? 1;
  // COMMIT may land before ADVANCE runs enterResolve; treat 0 as round 1.
  const round = state.flags.combatRound || 1;
  state.flags.combatRound = round;
  const roundPower = roundCommitPower(state, ctx);
  state.flags.combatBowl += roundPower;
  const events: GameEvent[] = [
    pushEvent(state, {
      type: "COMBAT_ROUND",
      kind: state.flags.lastEvent,
      round,
      of: maxRounds,
      roundPower,
      bowl: state.flags.combatBowl,
    }),
  ];
  if (round < maxRounds) {
    state.flags.combatRound = round + 1;
    state.flags.commits = {};
    events.push(
      pushEvent(state, {
        type: "EVENT_WAITING_COMMITS",
        kind: state.flags.lastEvent,
        round: state.flags.combatRound,
        of: maxRounds,
      }),
    );
    return { events, finished: false };
  }
  events.push(...finishEvent(state, ctx));
  state.flags.combatRound = 0;
  state.flags.combatBowl = 0;
  return { events, finished: true };
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
        round: state.flags.combatRound || 1,
      }),
    ];
  }
  state.flags.commits[action.playerId] = "pass";
  return [
    pushEvent(state, {
      type: "COMMITTED",
      playerId: action.playerId,
      cardId: null,
      hidden: true,
      round: state.flags.combatRound || 1,
    }),
  ];
}

function finishEvent(state: GameState, ctx: EngineCtx): GameEvent[] {
  const exp = ctx.ruleset.experimental;
  const events: GameEvent[] = [];
  const maxRounds = exp.eventCombatRounds ?? 1;
  if (state.flags.lastEvent === "barrier") {
    const pid = state.meta.activePlayerId;
    const challenge = barrierChallenge(state, ctx);
    const total = state.flags.combatBowl + barrierOpportunity();
    let success = challenge <= 0 || total >= challenge;
    if (maxRounds > 1 && total === challenge) success = false;
    events.push(
      pushEvent(state, {
        type: "BARRIER_RESOLVED",
        success,
        total,
        threshold: challenge,
        stalemate: maxRounds > 1 && total === challenge,
      }),
    );
    if (!success) {
      const dmg = hurt(state, pid, exp.barrierDamage);
      events.push(pushEvent(state, { type: "BARRIER_FAIL", playerId: pid, damage: dmg }));
      const obstacle = takeTop(state.roundTable.left);
      if (obstacle) {
        if (isMajor(ctx, obstacle)) state.altar.major.push(obstacle);
        else state.altar.minors.push(obstacle);
        overflowAltar(state, "minors", exp.altarMinorCap);
        overflowAltar(state, "major", exp.altarMajorCap);
        events.push(pushEvent(state, { type: "BARRIER_TO_ALTAR", cardId: obstacle.cardId }));
      }
      if (activePlayer(state).health <= 0) rotateLeader(state);
      const over = finishIfNeeded(state, ctx);
      if (over) events.push(over);
    } else {
      events.push(pushEvent(state, { type: "BARRIER_SUCCESS", playerId: pid }));
    }
  } else if (state.flags.lastEvent === "dialogue") {
    const ids = committers(state, ctx);
    const bowl = state.flags.combatBowl;
    const challenge = dialogueChallenge(state, ctx);
    let success = challenge <= 0 || bowl >= challenge;
    if (maxRounds > 1 && bowl === challenge) success = false;
    events.push(
      pushEvent(state, {
        type: "DIALOGUE_RESOLVED",
        success,
        bowl,
        threshold: challenge,
        participants: ids,
        stalemate: maxRounds > 1 && bowl === challenge,
      }),
    );
    const seats: Array<"left" | "middle"> = ["left", "middle"];
    if (success) {
      const active = state.meta.activePlayerId;
      const ordered = [active, ...ids.filter((id) => id !== active)];
      ordered.forEach((id, i) => {
        const slot = seats[i];
        if (!slot) return;
        const card = takeTop(state.roundTable[slot]);
        if (!card) return;
        if (isMajor(ctx, card)) {
          divertMajor(state, ctx, card, "dialogue_reward");
          events.push(pushEvent(state, { type: "DIALOGUE_REWARD", playerId: id, cardId: card.cardId, slot, dest: "diverted" }));
          return;
        }
        giveToHand(state, id, card, exp.handLimit, ctx);
        events.push(pushEvent(state, { type: "DIALOGUE_REWARD", playerId: id, cardId: card.cardId, slot }));
        const taker = state.players.find((x) => x.id === id);
        if (taker) {
          for (const grown of autoEvolveFromHand(ctx, taker)) {
            events.push(
              pushEvent(state, {
                type: "LINEAGE_EVOLVED",
                playerId: id,
                cardId: grown.cardId,
                turn: state.meta.turn,
                source: "dialogue",
              }),
            );
          }
        }
      });
    } else {
      for (const slot of seats) {
        const card = takeTop(state.roundTable[slot]);
        if (!card) continue;
        state.veil.push(card);
        events.push(pushEvent(state, { type: "DIALOGUE_TO_VEIL", cardId: card.cardId, slot }));
      }
    }
  }
  return events;
}

function resolveTreasure(state: GameState, _ctx: EngineCtx): GameEvent[] {
  const left = top(state.roundTable.left);
  return [
    pushEvent(state, {
      type: "TREASURE",
      playerId: activePlayer(state).id,
      cardId: left?.cardId ?? null,
      dest: "left",
    }),
  ];
}

function applyReward(state: GameState, action: Extract<Action, { type: "TAKE_REWARD" }>, ctx: EngineCtx): GameEvent[] {
  const card = takeTop(state.roundTable.left);
  if (!card) {
    return [...fillRoundTable(state, ctx), pushEvent(state, { type: "REWARD_EMPTY" })];
  }
  const p = activePlayer(state);
  const limit = ctx.ruleset.experimental.handLimit;
  const events: GameEvent[] = [];
  if (isMajor(ctx, card) && (action.dest === "hand" || action.dest === "lineage")) {
    divertMajor(state, ctx, card, `reward_${action.dest}`);
    events.push(pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: "diverted" }));
  } else if (action.dest === "hand") {
    giveToHand(state, p.id, card, limit, ctx);
    events.push(pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: action.dest }));
  } else if (action.dest === "altar") {
    const def = defOf(ctx.catalog, card);
    if (def.arcana === "major") state.altar.major.push(card);
    else state.altar.minors.push(card);
    overflowAltar(state, "minors", ctx.ruleset.experimental.altarMinorCap);
    overflowAltar(state, "major", ctx.ruleset.experimental.altarMajorCap);
    events.push(pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: action.dest }));
  } else if (action.dest === "lineage") {
    if (!canPlaceOnLineage(ctx, p, card)) {
      state.altar.minors.push(card);
      overflowAltar(state, "minors", ctx.ruleset.experimental.altarMinorCap);
      events.push(
        pushEvent(state, {
          type: "REWARD_TAKEN",
          cardId: card.cardId,
          dest: "altar",
          reason: "lineage_illegal",
        }),
      );
    } else {
      p.lineage.push(card);
      events.push(pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: action.dest }));
    }
  } else {
    giveToHand(state, p.id, card, limit, ctx);
    events.push(pushEvent(state, { type: "REWARD_TAKEN", cardId: card.cardId, dest: "hand", reason: "fallback" }));
  }
  const grower = state.players.find((x) => x.id === p.id);
  if (grower && (action.dest === "hand" || action.dest === "lineage")) {
    for (const grown of autoEvolveFromHand(ctx, grower)) {
      events.push(
        pushEvent(state, {
          type: "LINEAGE_EVOLVED",
          playerId: p.id,
          cardId: grown.cardId,
          turn: state.meta.turn,
          source: "reward",
        }),
      );
    }
  }
  events.push(...fillRoundTable(state, ctx));
  return events;
}

function evolve(state: GameState, ctx: EngineCtx): GameEvent[] {
  if (ctx.ruleset.experimental.enableLineage === false) {
    return [pushEvent(state, { type: "LINEAGE_NONE", skipped: true })];
  }
  const events: GameEvent[] = [];
  const p = activePlayer(state);
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
  for (const card of autoEvolveFromHand(ctx, p)) {
    events.push(
      pushEvent(state, {
        type: "LINEAGE_EVOLVED",
        playerId: p.id,
        cardId: card.cardId,
        turn: state.meta.turn,
      }),
    );
  }
  if (!events.length) {
    const need = nextLineageNeed(ctx, p);
    events.push(
      pushEvent(state, {
        type: "LINEAGE_NONE",
        playerId: p.id,
        neededRank: need?.rank ?? null,
      }),
    );
  }
  return events;
}

function eclipseCheck(state: GameState, ctx: EngineCtx): GameEvent[] {
  const p = activePlayer(state);
  const exp = ctx.ruleset.experimental;
  if (exp.enableEclipse === false) {
    return [pushEvent(state, { type: "ECLIPSE_CHECK", playerId: p.id, skipped: true, ready: false })];
  }
  const altarMajors = state.altar.major.filter((c) => defOf(ctx.catalog, c).arcana === "major");
  const tablePair = exp.eclipseOnTable !== false ? matchingTableRoyals(state, ctx) : null;
  const altarReady =
    exp.eclipseOnAltar !== false && altarHasRedBlackPair(ctx, altarMajors);
  const source = tablePair ? "table" : altarReady ? "altar" : null;
  if (!p.eclipse && source) {
    const events: GameEvent[] = [
      pushEvent(state, {
        type: "ECLIPSE",
        playerId: p.id,
        bonus: exp.eclipseBonus,
        turn: state.meta.turn,
        source,
        pair: tablePair,
      }),
    ];
    events.push(...grantEclipse(state, p.id, ctx));
    return events;
  }
  return [
    pushEvent(state, {
      type: "ECLIPSE_CHECK",
      playerId: p.id,
      ready: Boolean(source),
      altarMajors: altarMajors.length,
      altarRedBlack: altarHasRedBlackPair(ctx, altarMajors),
      tablePair,
    }),
  ];
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
