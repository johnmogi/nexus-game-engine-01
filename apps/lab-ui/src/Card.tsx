import {
  cardArcana,
  cardInk,
  isHiddenCardId,
  labelCard,
  proxyCatalog,
  type CardInstance,
  type EngineCtx,
} from "@nexus/game-core";

const catalog = proxyCatalog();

export function face(card: CardInstance | undefined): string {
  if (!card) return "—";
  return labelCard(catalog, card);
}

export function fogCard(card: CardInstance | undefined, fog?: boolean): CardInstance | undefined {
  if (!card || !fog || isHiddenCardId(card.cardId)) return card;
  return {
    instanceId: card.instanceId,
    cardId: cardArcana(catalog, card) === "major" ? "?-major" : "?-minor",
    arrivedTurn: card.arrivedTurn,
  };
}

export function forceNote(ctx: EngineCtx, card: CardInstance | undefined, fog?: boolean): string {
  if (!card || fog || isHiddenCardId(card.cardId)) return "";
  const def = catalog.get(card.cardId);
  if (!def) return "";
  if (def.arcana === "major") return "Major";
  const band = def.rank <= 3 ? 1 : def.rank <= 6 ? 3 : 6;
  return `Minor · ${band} force`;
}

export function Card(props: {
  title: string;
  card?: CardInstance;
  note?: string;
  hot?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const size = props.size ?? "md";
  const hidden = Boolean(props.card && isHiddenCardId(props.card.cardId));
  const kind = props.card ? cardArcana(catalog, props.card) : null;
  const ink = props.card ? cardInk(catalog, props.card) : null;
  const cls = [
    "card",
    `card-${size}`,
    props.hot ? "hot" : "",
    !props.card ? "empty" : "",
    hidden ? "facedown" : "faceup",
    kind ?? "",
    ink ? `ink-${ink}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <div className="card-kicker">{props.title}</div>
      {hidden ? (
        <>
          <div className="card-back-kind">{kind === "major" ? "Major" : "Minor"}</div>
          <div className="card-back-mark">{kind === "major" ? "★" : "◆"}</div>
        </>
      ) : (
        <>
          <div className="card-face">
            {kind === "major" ? "★ " : ""}
            {face(props.card)}
          </div>
          {kind && props.card ? <div className="card-kind">{kind === "major" ? "MAJOR" : "minor"}</div> : null}
          {props.note ? <div className="card-note">{props.note}</div> : null}
        </>
      )}
    </div>
  );
}

/** Every card in the pile. God mode splits Majors onto their own row. */
export function DeckPile(props: { title: string; cards: CardInstance[]; fog?: boolean }) {
  const n = props.cards.length;
  const majors = props.cards.filter((c) => cardArcana(catalog, c) === "major");
  const minors = props.cards.filter((c) => cardArcana(catalog, c) !== "major");
  function tile(c: CardInstance) {
    const i = props.cards.indexOf(c);
    return (
      <Card
        key={c.instanceId}
        title={i === 0 ? "next" : String(i + 1)}
        card={fogCard(c, props.fog)}
        size="sm"
      />
    );
  }
  return (
    <div className="deck-pile">
      <div className="deck-pile-head">
        <b>{props.title}</b>
        <span>
          {n} cards · {majors.length} major / {minors.length} minor
        </span>
      </div>
      {n === 0 ? <div className="stack-empty">empty</div> : null}
      {props.fog ? (
        <div className="card-grid">{props.cards.map(tile)}</div>
      ) : (
        <>
          {majors.length ? (
            <>
              <div className="pile-label">Majors</div>
              <div className="card-grid major-row">{majors.map(tile)}</div>
            </>
          ) : null}
          {minors.length ? (
            <>
              <div className="pile-label">Minors</div>
              <div className="card-grid">{minors.map(tile)}</div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
