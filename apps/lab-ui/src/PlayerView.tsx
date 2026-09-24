import {
  eventPrompt,
  proxyCatalog,
  type Action,
  type EngineCtx,
  type GameState,
} from "@nexus/game-core";
import { Card, forceNote, fogCard } from "./Card";
import { CharacterSelect } from "./CharacterSelect";
import { CombatScreen } from "./CombatScreen";
import { storyLines } from "./story";

const catalog = proxyCatalog();

function hearts(hp: number, max = 3): string {
  const n = Math.max(0, Math.min(max, hp));
  return "♥".repeat(n) + "♡".repeat(max - n);
}

function actTone(a: Action): "discover" | "commit" | "take" | "leave" | "other" {
  if (a.type === "COMMIT") return "commit";
  if (a.type === "TAKE_REWARD") return "take";
  if (a.type === "ADVANCE") return "discover";
  if (a.type === "SKIP_MANIP") return "leave";
  return "other";
}

function actLabel(a: Action, state: GameState): string {
  if (a.type === "SKIP_MANIP") return "Continue";
  if (a.type === "MANIP") {
    if (a.element === "air") return "Air · bury LEFT";
    if (a.element === "fire") return "Fire · top-deck LEFT";
    if (a.element === "water") return "Water · from Veil";
    if (a.element === "earth") return "Earth · reorder";
  }
  if (a.type === "TAKE_REWARD") {
    if (a.dest === "hand") return "Take into hand";
    if (a.dest === "altar") return "Place on Altar";
    if (a.dest === "lineage") return "Grow lineage";
  }
  if (a.type === "COMMIT") {
    if (a.cardId === "pass") return "Add 0";
    return "Commit";
  }
  if (a.type === "CHOOSE_CHARACTER") {
    return catalog.get(a.cardId)?.name ?? a.cardId;
  }
  if (a.type === "ADVANCE") {
    if (state.meta.phase === "ROLL_EVENT") return "Roll event";
    if (state.meta.phase === "ELEMENTAL_MANIPULATION") return "Continue";
    if (state.meta.phase === "REWARD") return "Leave LEFT";
    if (state.meta.phase === "TURN_END" || state.meta.phase === "ECLIPSE_NEXUS_CHECK") return "End turn";
    return "Continue";
  }
  return a.type;
}

function promptLine(state: GameState, ctx: EngineCtx): string {
  const prompt = eventPrompt(state, ctx);
  if (state.meta.outcome !== "playing") return state.meta.outcome;
  if (prompt.kind === "barrier") return `Barrier · challenge ${prompt.challenge}`;
  if (prompt.kind === "dialogue") return `Dialogue · challenge ${prompt.challenge}`;
  if (prompt.kind === "treasure") return "Treasure — claim LEFT";
  if (state.meta.phase === "ROLL_EVENT") return "Your turn — roll the event die";
  if (state.meta.phase === "ELEMENTAL_MANIPULATION") return "Optional elemental, or continue";
  if (state.meta.phase === "REWARD") return "Choose where LEFT goes";
  return `${state.meta.phase.replaceAll("_", " ")}`;
}

/**
 * Experimental seat chrome (parked).
 * App currently uses PlayerTable for both Seat and God so fog/actions stay aligned.
 * Re-wire from App if you want this layout again.
 */
export function PlayerView(props: {
  state: GameState;
  ctx: EngineCtx;
  viewerId: string;
  legal: Action[];
  canPlay: boolean;
  fog?: boolean;
  onAct: (a: Action) => void;
}) {
  const { state, ctx, viewerId, legal, canPlay, fog, onAct } = props;
  const me = state.players.find((p) => p.id === viewerId) ?? state.players[0]!;
  const prompt = eventPrompt(state, ctx);
  const characterPicks = legal.filter((a) => a.type === "CHOOSE_CHARACTER");
  const inCombat =
    (prompt.kind === "barrier" || prompt.kind === "dialogue") &&
    state.meta.phase === "RESOLVE_EVENT" &&
    legal.some((a) => a.type === "COMMIT");
  const dialOn = Boolean(ctx.ruleset.experimental.enableDayDial);
  const whisper = storyLines(state, 4);

  const handCommits = legal.filter(
    (a): a is Extract<Action, { type: "COMMIT" }> =>
      a.type === "COMMIT" && a.playerId === me.id && a.cardId !== "pass",
  );
  const passCommit = legal.find(
    (a): a is Extract<Action, { type: "COMMIT" }> =>
      a.type === "COMMIT" && a.playerId === me.id && a.cardId === "pass",
  );
  const nonCommit = legal.filter((a) => a.type !== "COMMIT" && a.type !== "CHOOSE_CHARACTER");

  if (characterPicks.length) {
    return (
      <section className="player-view player-view-character">
        <CharacterSelect legal={legal} canPlay={canPlay} onAct={onAct} />
      </section>
    );
  }

  return (
    <section className="player-view">
      <header className="pv-top">
        <div className="pv-brand">
          <strong>NEXUS</strong>
          <span>Mesahara</span>
        </div>
        <div className="pv-dial" data-dial={state.meta.dial}>
          <span className="pv-dial-sun">☀</span>
          <span className="pv-dial-moon">☾</span>
        </div>
        <div className="pv-status">
          <b>
            Round {state.meta.round} · Turn {state.meta.turn}/{state.meta.maxTurns}
          </b>
          <span>
            {dialOn ? `${state.meta.dial} · ` : ""}
            {promptLine(state, ctx)}
          </span>
        </div>
      </header>

      <div className="pv-party">
        {state.players.map((p) => (
          <div
            key={p.id}
            className={`pv-seat${p.id === state.meta.activePlayerId ? " active" : ""}${p.id === me.id ? " you" : ""}${p.health <= 0 ? " down" : ""}`}
          >
            <div className="pv-seat-name">
              {p.id}
              {p.id === me.id ? " · you" : ""}
              {p.eclipse ? " · Eclipse" : ""}
            </div>
            <div className="pv-hearts" title={`HP ${p.health}`}>
              {hearts(p.health)}
            </div>
            {p.aspect ? <div className="pv-aspect">{catalog.get(p.aspect)?.name ?? p.aspect}</div> : null}
            <div className="pv-lineage">
              {p.lineage.length
                ? p.lineage.map((c) => (
                    <Card key={c.instanceId} title="pip" card={fogCard(c, fog && p.id !== me.id)} size="sm" />
                  ))
                : null}
            </div>
          </div>
        ))}
      </div>

      {inCombat ? (
        <CombatScreen
          state={state}
          ctx={ctx}
          legal={legal}
          canPlay={canPlay}
          fog={fog}
          viewerId={viewerId}
          onAct={onAct}
        />
      ) : (
        <div className="pv-table">
          <div className="pv-pile">
            <div className="pv-pile-face draw">Draw</div>
            <span>{state.drawDeck.length}</span>
          </div>

          <div className="pv-seats-row">
            <Card
              title="LEFT"
              card={fogCard(state.roundTable.left[0], fog)}
              note={forceNote(ctx, state.roundTable.left[0], fog)}
              hot={Boolean(prompt.kind)}
              size="xl"
            />
            <Card
              title="MIDDLE"
              card={fogCard(state.roundTable.middle[0], fog)}
              note={forceNote(ctx, state.roundTable.middle[0], fog)}
              hot={prompt.kind === "dialogue"}
              size="xl"
            />
            <div className="pv-pd">
              <Card
                title="PD"
                card={fogCard(state.roundTable.pd[0], fog)}
                note={forceNote(ctx, state.roundTable.pd[0], fog)}
                size="lg"
              />
            </div>
          </div>

          <div className="pv-pile">
            <div className="pv-pile-face veil">Veil</div>
            <span>{state.veil.length}</span>
          </div>
        </div>
      )}

      {!inCombat ? (
        <div className="pv-altar">
          <div className="pv-altar-label">Altar</div>
          <div className="pv-altar-row">
            {state.altar.minors.map((c) => (
              <Card key={c.instanceId} title="minor" card={c} size="md" />
            ))}
            {state.altar.major.map((c) => (
              <Card key={c.instanceId} title="major" card={c} size="md" />
            ))}
            {!state.altar.minors.length && !state.altar.major.length ? (
              <span className="pv-empty">empty</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pv-bottom">
        <div className="pv-log">
          <div className="pv-log-title">Log</div>
          <ol>
            {whisper.length ? whisper.map((line, i) => <li key={i}>{line}</li>) : <li>The table waits.</li>}
          </ol>
        </div>

        <div className="pv-hand">
          <div className="pv-hand-title">Your hand · {me.hand.length}</div>
          <div className="pv-hand-row">
            {me.hand.length === 0 ? <span className="pv-empty">empty</span> : null}
            {me.hand.map((c) => {
              const commit = handCommits.find((a) => a.cardId === c.instanceId);
              return (
                <Card
                  key={c.instanceId}
                  title="hand"
                  card={c}
                  note={forceNote(ctx, c, false)}
                  size="xl"
                  selectable={Boolean(commit && canPlay)}
                  onClick={commit && canPlay ? () => onAct(commit) : undefined}
                />
              );
            })}
          </div>
        </div>

        <div className="pv-actions">
          {!canPlay ? (
            <p className="advisor-hint">Watching history — Fwd to play.</p>
          ) : (
            <>
              {passCommit ? (
                <button type="button" className="pv-act commit" onClick={() => onAct(passCommit)}>
                  Add 0
                </button>
              ) : null}
              {nonCommit.map((a, i) => (
                <button key={i} type="button" className={`pv-act ${actTone(a)}`} onClick={() => onAct(a)}>
                  {actLabel(a, state)}
                </button>
              ))}
              {!nonCommit.length && !passCommit && !handCommits.length ? (
                <p className="pv-empty">
                  {state.meta.activePlayerId !== me.id
                    ? `Waiting on ${state.meta.activePlayerId}…`
                    : "No moves for this seat."}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
