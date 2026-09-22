import { CHARACTER_IDS, proxyCatalog, type Action } from "@nexus/game-core";
import { characterBannerUrl } from "./art";
import { Card } from "./Card";

const catalog = proxyCatalog();

export function CharacterSelect(props: {
  legal: Action[];
  canPlay: boolean;
  onAct: (a: Action) => void;
}) {
  const picks = props.legal.filter((a): a is Extract<Action, { type: "CHOOSE_CHARACTER" }> => a.type === "CHOOSE_CHARACTER");
  if (!picks.length) return null;

  return (
    <section className="character-select">
      <header className="character-select-head">
        <p className="character-kicker">Eclipse opened the hold</p>
        <h2>Choose your aspect</h2>
        <p>Impacts are pending in the engine — pick the face that will ride with you.</p>
      </header>

      <div className="character-banner" style={{ backgroundImage: `url(${characterBannerUrl()})` }} aria-hidden />

      <div className="character-grid">
        {CHARACTER_IDS.map((id) => {
          const act = picks.find((a) => a.cardId === id);
          const def = catalog.get(id);
          return (
            <button
              key={id}
              type="button"
              className={`character-pick ${act && props.canPlay ? "" : "disabled"}`}
              disabled={!act || !props.canPlay}
              onClick={() => act && props.onAct(act)}
            >
              <Card
                title={def?.deck === "moonlight" ? "Moon" : "Sun"}
                card={act ? { instanceId: `pick-${id}`, cardId: id } : undefined}
                size="xl"
                note={def?.blurb?.slice(0, 110) ?? "Aspect"}
              />
              <span className="character-name">{def?.name ?? id}</span>
            </button>
          );
        })}
      </div>

      {!props.canPlay ? <p className="advisor-hint">Watching history — Fwd to the last frame to choose.</p> : null}
    </section>
  );
}
