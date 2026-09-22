import {
  eventPrompt,
  nextLineageNeed,
  proxyCatalog,
  summarizeMatch,
  type Action,
  type EngineCtx,
  type GameState,
  type PlayerState,
} from "@nexus/game-core";
import { Card, DeckPile, face, forceNote, fogCard } from "./Card";
import { storyLines } from "./story";

const catalog = proxyCatalog();

function playerAct(a: Action, state: GameState): string {
  if (a.type === "SKIP_MANIP") return "Pass";
  if (a.type === "MANIP") {
    if (a.element === "air") return "Air — bury LEFT under the deck";
    if (a.element === "fire") return "Fire — send LEFT to the top of the deck";
    if (a.element === "water") return "Water — return a card from the Veil";
    if (a.element === "earth") {
      const order = a.order?.map((s) => s.toUpperCase()).join(" → ") ?? "reorder";
      return `Earth — order ${order}`;
    }
  }
  if (a.type === "TAKE_REWARD") {
    if (a.dest === "hand") return "Take LEFT into hand";
    if (a.dest === "altar") return "Place LEFT on the Altar";
    if (a.dest === "lineage") return "Grow lineage with LEFT";
  }
  if (a.type === "COMMIT") {
    if (a.cardId === "pass") return `${a.playerId} pass (0)`;
    const card = state.players.find((p) => p.id === a.playerId)?.hand.find((c) => c.instanceId === a.cardId);
    return `${a.playerId} play ${card ? face(card) : a.cardId}`;
  }
  if (a.type === "CHOOSE_CHARACTER") {
    return `Aspect → ${catalog.get(a.cardId)?.name ?? a.cardId}`;
  }
  if (a.type === "ADVANCE") {
    if (state.meta.phase === "ROLL_EVENT") return "Roll the event die";
    return `Continue (${state.meta.phase})`;
  }
  return a.type;
}

const EVENT_COPY: Record<string, string> = {
  dialogue: "Dialogue — beat LEFT + MIDDLE together.",
  barrier: "Barrier — beat LEFT alone. You have +1.",
  treasure: "Treasure — LEFT is yours.",
};

function growthNeed(ctx: EngineCtx, p: PlayerState): string {
  const n = nextLineageNeed(ctx, p);
  if (!n) return "Lineage has no further pip rank.";
  const color = ctx.ruleset.experimental.evolveByColor
    ? "of any color (secondary elemental)"
    : "of this lineage only";
  if (n.inHand) return `Next form is ${n.rank} ${color} — sitting in hand, auto-evolves.`;
  return `Next form is ${n.rank} ${color} — none in this hand.`;
}

function advisorCopy(state: GameState, ctx: EngineCtx, prompt: ReturnType<typeof eventPrompt>): string {
  if (state.meta.phase === "ELEMENTAL_MANIPULATION") {
    return "Optional: use one element on the table, or Pass.";
  }
  if (prompt.kind === "barrier") {
    return `Barrier combat · round ${prompt.combatRound}/${prompt.combatRounds}. Challenge ${prompt.challenge}. Bowl so far ${prompt.combatBowl}. Your +1 applies at the end. Play a hand card or pass.`;
  }
  if (prompt.kind === "dialogue") {
    return `Dialogue combat · round ${prompt.combatRound}/${prompt.combatRounds}. Challenge ${prompt.challenge} (LEFT+MIDDLE). Bowl ${prompt.combatBowl}. Each living seat commits.`;
  }
  if (prompt.kind === "treasure") {
    return "Treasure — take LEFT into hand, altar, or lineage if legal.";
  }
  if (state.meta.phase === "REWARD") {
    return "Choose where LEFT goes.";
  }
  if (state.meta.phase.includes("ECLIPSE") || state.players.some((p) => p.eclipse && !p.aspect && ctx.ruleset.experimental.enableCharacterEvolution)) {
    return "Eclipse opened the character hold — pick an aspect if offered.";
  }
  return "Advance the table, optionally use one element, then roll the event die.";
}

function ActButtons(props: {
  legal: Action[];
  state: GameState;
  canPlay: boolean;
  onAct: (a: Action) => void;
  filter?: (a: Action) => boolean;
}) {
  const acts = props.filter ? props.legal.filter(props.filter) : props.legal;
  if (!props.canPlay) return <p className="advisor-hint">Watching history — Fwd to the last frame to act.</p>;
  if (!acts.length) return null;
  return (
    <div className="acts">
      {acts.map((a, i) => (
        <button key={i} type="button" className="act" onClick={() => props.onAct(a)}>
          {playerAct(a, props.state)}
        </button>
      ))}
    </div>
  );
}

export function PlayerTable(props: {
  state: GameState;
  ctx: EngineCtx;
  viewerId: string;
  legal: Action[];
  canPlay: boolean;
  revealHands?: boolean;
  fog?: boolean;
  onAct: (a: Action) => void;
}) {
  const { state, ctx, viewerId, legal, canPlay, onAct, revealHands, fog } = props;
  const prompt = eventPrompt(state, ctx);
  const result = summarizeMatch(state, catalog);
  const me = state.players.find((p) => p.id === viewerId) ?? state.players[0]!;
  const inEvent = Boolean(prompt.kind) && (state.meta.phase === "RESOLVE_EVENT" || state.meta.phase === "REWARD");
  const eventActs = (a: Action) => a.type === "COMMIT" || a.type === "TAKE_REWARD";

  return (
    <section className="table tech-view">
      <div className="result">
        <strong>{result.headline}</strong>
        <span>
          {result.clock} · {result.outcome}
          {result.notes.length ? ` · ${result.notes.join(" · ")}` : ""}
        </span>
        <div className="result-seats">
          {result.standings.map((s) => (
            <div key={s.id} className={s.alive ? "" : "down"}>
              <b>
                {s.id} · HP {s.health}
                {s.eclipse ? " · Eclipse" : ""}
                {s.aspect ? ` · ${s.aspect}` : ""}
              </b>
              <p>{s.lineageLabels.join(" → ") || "no lineage"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pane-grid">
        <div className="pane pane-play">
          <h2 className="pane-title">Play area</h2>
          <p className="pane-meta">
            {state.meta.activePlayerId} · {state.meta.phase} · R{state.meta.round} T{state.meta.turn}/
            {state.meta.maxTurns}
            {ctx.ruleset.experimental.enableDayDial ? ` · ${state.meta.dial}` : ""}
          </p>

          <div className="rt">
            <Card
              title="LEFT"
              card={fogCard(state.roundTable.left[0], fog)}
              note={forceNote(ctx, state.roundTable.left[0], fog)}
              hot={Boolean(prompt.kind)}
              size="lg"
            />
            <Card
              title="MIDDLE"
              card={fogCard(state.roundTable.middle[0], fog)}
              note={forceNote(ctx, state.roundTable.middle[0], fog)}
              hot={prompt.kind === "dialogue"}
              size="lg"
            />
            <Card
              title="PD"
              card={fogCard(state.roundTable.pd[0], fog)}
              note={forceNote(ctx, state.roundTable.pd[0], fog)}
              size="lg"
            />
          </div>

          <div className="altar">
            <div>
              <h3>Altar minors</h3>
              <div className="altar-row">
                {state.altar.minors.length
                  ? state.altar.minors.map((c) => <Card key={c.instanceId} title="minor" card={c} />)
                  : <Card title="minor" />}
              </div>
            </div>
            <div>
              <h3>Altar majors · Eclipse needs red + black</h3>
              <div className="altar-row">
                {state.altar.major.length
                  ? state.altar.major.map((c) => <Card key={c.instanceId} title="major" card={c} />)
                  : <Card title="major" />}
              </div>
            </div>
          </div>

          <DeckPile title="Draw" cards={state.drawDeck} fog={fog} />
          <DeckPile title="Veil" cards={state.veil} fog={fog} />

          <div className="heroes">
            {state.players.map((p) => {
              const mine = p.id === me.id;
              const showHand = revealHands || mine;
              return (
                <div key={p.id} className={p.id === state.meta.activePlayerId ? "hero on" : "hero"}>
                  <h3>
                    {p.id} · HP {p.health}
                    {p.eclipse ? " · Eclipse" : ""}
                    {p.joker.active ? " · Joker" : ""}
                    {p.aspect ? ` · ${catalog.get(p.aspect)?.name ?? p.aspect}` : ""}
                  </h3>
                  <div className="hero-cards">
                    {p.lineage.length ? (
                      p.lineage.map((c, i) => (
                        <Card
                          key={c.instanceId}
                          title={i === 0 ? "Starting Ace" : `+${i * 2}`}
                          card={c}
                          note={i === 0 ? "dealt at opening" : "auto from hand"}
                        />
                      ))
                    ) : (
                      <Card title="Starting Ace" note="not dealt yet" />
                    )}
                  </div>
                  <p className="growth-need">{growthNeed(ctx, p)}</p>
                  <div className="hand-row">
                    <span className="hand-label">Hand ({p.hand.length})</span>
                    {p.hand.length === 0 ? (
                      <span>empty</span>
                    ) : showHand ? (
                      p.hand.map((c) => <Card key={c.instanceId} title="hand" card={c} size="sm" />)
                    ) : (
                      p.hand.map((c) => <Card key={c.instanceId} title="hand" card={fogCard(c, true)} size="sm" />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pane pane-visual">
          <h2 className="pane-title">Visual</h2>
          <p className="pane-meta">Stage stub — seats as rooms / events (art later)</p>
          <div className="visual-stage">
            {(
              [
                ["LEFT", state.roundTable.left[0], prompt.kind ? "event" : "room"],
                ["MIDDLE", state.roundTable.middle[0], prompt.kind === "dialogue" ? "event" : "room"],
                ["PD", state.roundTable.pd[0], "threshold"],
              ] as const
            ).map(([label, card, kind]) => (
              <div key={label} className={`visual-slot ${kind} ${card ? "filled" : "empty"}`}>
                <div className="visual-kicker">{label}</div>
                <div className="visual-kind">{kind}</div>
                <div className="visual-face">{fog ? (card ? "…" : "—") : face(card)}</div>
              </div>
            ))}
          </div>
          <div className="visual-altar">
            Altar · {state.altar.minors.length} minor · {state.altar.major.length} major
          </div>
        </div>
      </div>

      {inEvent || prompt.kind ? (
        <div className="pane pane-event">
          <h2 className="pane-title">Event</h2>
          {prompt.kind ? (
            <>
              <div className="event-die">
                <span className="die-face">{prompt.roll ?? "—"}</span>
                <div>
                  <b>{prompt.kind}</b>
                  <p>{EVENT_COPY[prompt.kind]}</p>
                  <p>
                    Challenge <b>{prompt.challenge}</b>
                    {prompt.opportunity ? ` · +${prompt.opportunity} opportunity` : ""} · {prompt.seats}
                  </p>
                  {prompt.combatRounds > 1 ? (
                    <p>
                      Combat round {prompt.combatRound}/{prompt.combatRounds} · bowl {prompt.combatBowl}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="event-obstacles">
                <Card title="LEFT obstacle" card={fogCard(state.roundTable.left[0], fog)} note={forceNote(ctx, state.roundTable.left[0], fog)} hot />
                {prompt.kind === "dialogue" ? (
                  <Card
                    title="MIDDLE obstacle"
                    card={fogCard(state.roundTable.middle[0], fog)}
                    note={forceNote(ctx, state.roundTable.middle[0], fog)}
                    hot
                  />
                ) : null}
              </div>
              <ActButtons legal={legal} state={state} canPlay={canPlay} onAct={onAct} filter={eventActs} />
            </>
          ) : (
            <p>No active event.</p>
          )}
        </div>
      ) : null}

      <div className="pane pane-advisor">
        <h2 className="pane-title">Advisor</h2>
        <p>{advisorCopy(state, ctx, prompt)}</p>
        <ActButtons legal={legal} state={state} canPlay={canPlay} onAct={onAct} />
      </div>

      <div className="pane pane-story">
        <h2 className="pane-title">Story</h2>
        <ol className="story-list">
          {storyLines(state).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
        <p className="pane-meta">Prose + image beats live under Logs. Technical JSON is separate.</p>
      </div>
    </section>
  );
}
