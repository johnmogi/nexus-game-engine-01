import {
  eventPrompt,
  labelCard,
  proxyCatalog,
  type Action,
  type EngineCtx,
  type GameState,
} from "@nexus/game-core";
import { Card, forceNote, fogCard } from "./Card";

const catalog = proxyCatalog();

/**
 * Functional combat screen for Barrier / Dialogue.
 * Layout is plain on purpose — art chrome comes after playtest.
 */
export function CombatScreen(props: {
  state: GameState;
  ctx: EngineCtx;
  legal: Action[];
  canPlay: boolean;
  fog?: boolean;
  onAct: (a: Action) => void;
}) {
  const { state, ctx, legal, canPlay, fog, onAct } = props;
  const prompt = eventPrompt(state, ctx);
  if (prompt.kind !== "barrier" && prompt.kind !== "dialogue") return null;

  const commits = legal.filter((a): a is Extract<Action, { type: "COMMIT" }> => a.type === "COMMIT");
  const bySeat = new Map<string, Extract<Action, { type: "COMMIT" }>[]>();
  for (const a of commits) {
    const list = bySeat.get(a.playerId) ?? [];
    list.push(a);
    bySeat.set(a.playerId, list);
  }

  const challenge = prompt.challenge;
  const bowl = prompt.combatBowl;
  const pct = challenge > 0 ? Math.min(100, Math.round((bowl / challenge) * 100)) : 0;

  function commitForInstance(playerId: string, instanceId: string): Extract<Action, { type: "COMMIT" }> | undefined {
    return bySeat.get(playerId)?.find((a) => a.cardId === instanceId);
  }

  function passFor(playerId: string): Extract<Action, { type: "COMMIT" }> | undefined {
    return bySeat.get(playerId)?.find((a) => a.cardId === "pass");
  }

  function committedLabel(playerId: string): string {
    const val = state.flags.commits[playerId];
    if (!val) return "waiting";
    if (val === "pass") return "+0";
    return labelCard(catalog, { instanceId: "x", cardId: val });
  }

  return (
    <section className={`combat-screen combat-${prompt.kind}`}>
      <header className="combat-head">
        <div className="combat-die">{prompt.roll ?? "—"}</div>
        <div>
          <h2>{prompt.kind === "barrier" ? "Barrier" : "Dialogue"}</h2>
          <p>
            Die chose the scene only. Challenge <b>{challenge}</b>
            {prompt.opportunity ? ` · +${prompt.opportunity} opportunity` : ""} · {prompt.seats}
          </p>
          {prompt.combatRounds > 1 ? (
            <p>
              Round {prompt.combatRound}/{prompt.combatRounds}
            </p>
          ) : null}
        </div>
        <div className="combat-party">
          {state.players.map((p) => (
            <div
              key={p.id}
              className={`combat-party-seat${p.id === state.meta.activePlayerId ? " active" : ""}${p.health <= 0 ? " down" : ""}`}
            >
              <b>{p.id}</b>
              <span>HP {p.health}</span>
              {p.aspect ? <span>{catalog.get(p.aspect)?.name ?? p.aspect}</span> : null}
            </div>
          ))}
        </div>
      </header>

      <div className="combat-board">
        <div className="combat-obstacles">
          <Card
            title="LEFT · obstacle"
            card={fogCard(state.roundTable.left[0], fog)}
            note={forceNote(ctx, state.roundTable.left[0], fog)}
            hot
            size="xl"
          />
          {prompt.kind === "dialogue" ? (
            <Card
              title="MIDDLE · obstacle"
              card={fogCard(state.roundTable.middle[0], fog)}
              note={forceNote(ctx, state.roundTable.middle[0], fog)}
              hot
              size="xl"
            />
          ) : null}
        </div>

        <div className="combat-bowl-panel">
          <div className="bowl-label">
            Bowl <b>{bowl}</b> / {challenge}
          </div>
          <div className="bowl-meter" role="progressbar" aria-valuenow={bowl} aria-valuemax={challenge}>
            <div className="bowl-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="bowl-hint">
            Commit a hand card into the bowl, or add 0.{" "}
            {prompt.kind === "dialogue" ? "Every living seat must commit." : "Active seat only."}
          </p>

          {!canPlay ? <p className="advisor-hint">Watching history — Fwd to the last frame to act.</p> : null}

          <div className="combat-commits">
            {state.players.map((p) => {
              const seatActs = bySeat.get(p.id);
              const already = p.id in state.flags.commits;
              if (!seatActs && !already && prompt.kind === "barrier" && p.id !== state.meta.activePlayerId) {
                return null;
              }
              return (
                <div key={p.id} className="combat-seat">
                  <div className="combat-seat-label">
                    {p.id}
                    {state.meta.activePlayerId === p.id ? " · active" : ""}
                    {already ? ` · committed ${committedLabel(p.id)}` : seatActs ? " · choose a card" : ""}
                  </div>
                  {already || !seatActs ? null : (
                    <>
                      <div className="combat-hand">
                        {p.hand.map((c) => {
                          const act = commitForInstance(p.id, c.instanceId);
                          if (!act) return null;
                          return (
                            <Card
                              key={c.instanceId}
                              title="hand"
                              card={fogCard(c, fog && p.id !== state.meta.activePlayerId)}
                              note={forceNote(ctx, c, fog)}
                              size="lg"
                              selectable={canPlay}
                              onClick={canPlay ? () => onAct(act) : undefined}
                            />
                          );
                        })}
                      </div>
                      {passFor(p.id) ? (
                        <button
                          type="button"
                          className="act combat-act"
                          disabled={!canPlay}
                          onClick={() => onAct(passFor(p.id)!)}
                        >
                          Add 0 to the bowl
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
