import { useEffect, useId, useState } from "react";
import {
  cardArcana,
  cardInk,
  isHiddenCardId,
  labelCard,
  proxyCatalog,
  type CardInstance,
  type EngineCtx,
} from "@nexus/game-core";
import { artCandidates, rankGlyph } from "./art";

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

function useResolvedArt(cardId: string | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!cardId || cardId.startsWith("?")) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    const candidates = artCandidates(cardId);
    let i = 0;
    function tryNext() {
      if (cancelled || i >= candidates.length) {
        if (!cancelled) setSrc(null);
        return;
      }
      const url = candidates[i++]!;
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setSrc(url);
      };
      img.onerror = () => tryNext();
      img.src = url;
    }
    tryNext();
    return () => {
      cancelled = true;
    };
  }, [cardId]);
  return src;
}

/** Transparent SVG chrome: rank + title over plain illustration art. */
function CardFrameSvg(props: {
  rank: string;
  name: string;
  sub: string;
  ink: "red" | "black" | "gold" | null;
  major: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const glowId = `frameGlow-${uid}`;
  const stroke =
    props.ink === "red" ? "#e8a090" : props.ink === "black" ? "#9eb0c8" : props.ink === "gold" ? "#f0d78c" : "#d4af37";
  const navy = "#0a162b";
  const fill = props.major ? "rgba(20,16,8,0.72)" : "rgba(8,12,20,0.68)";
  const title = props.name.length > 20 ? `${props.name.slice(0, 18)}…` : props.name;
  return (
    <svg className="card-frame-svg" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={glowId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="28%" stopColor={navy} stopOpacity="0" />
          <stop offset="72%" stopColor={navy} stopOpacity="0" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {/* Outer navy plate + gold rim */}
      <rect x="2" y="2" width="196" height="296" rx="12" fill="none" stroke={navy} strokeWidth="6" />
      <rect x="5" y="5" width="190" height="290" rx="10" fill="none" stroke={stroke} strokeWidth="2.2" />
      <rect x="10" y="10" width="180" height="280" rx="7" fill={`url(#${glowId})`} />
      {/* Corner brackets */}
      <path d="M14 34 V18 H30" fill="none" stroke={stroke} strokeWidth="2" />
      <path d="M186 34 V18 H170" fill="none" stroke={stroke} strokeWidth="2" />
      <path d="M14 266 V282 H30" fill="none" stroke={stroke} strokeWidth="2" />
      <path d="M186 266 V282 H170" fill="none" stroke={stroke} strokeWidth="2" />
      {/* Rank gem */}
      <rect x="14" y="14" width="40" height="34" rx="5" fill={fill} stroke={stroke} strokeWidth="1.4" />
      <text x="34" y="38" textAnchor="middle" fill="#f7f0d8" fontSize="20" fontFamily="Georgia, Cinzel, serif" fontWeight="700">
        {props.rank}
      </text>
      {/* Title plate */}
      <rect x="14" y="240" width="172" height="44" rx="5" fill={fill} stroke={stroke} strokeWidth="1.4" />
      <text x="100" y="260" textAnchor="middle" fill="#f7f0d8" fontSize="12" fontFamily="Georgia, Cinzel, serif">
        {title}
      </text>
      <text x="100" y="276" textAnchor="middle" fill="#d4af37" fontSize="9" fontFamily="Segoe UI, sans-serif" letterSpacing="0.06em">
        {props.sub}
      </text>
    </svg>
  );
}

export function Card(props: {
  title: string;
  card?: CardInstance;
  note?: string;
  hot?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const size = props.size ?? "md";
  const hidden = Boolean(props.card && isHiddenCardId(props.card.cardId));
  const def = props.card && !hidden ? catalog.get(props.card.cardId) : undefined;
  const kind = props.card ? cardArcana(catalog, props.card) : null;
  const ink = props.card ? cardInk(catalog, props.card) : null;
  const art = useResolvedArt(hidden ? undefined : props.card?.cardId);
  const cls = [
    "card",
    "card-framed",
    `card-${size}`,
    props.hot ? "hot" : "",
    !props.card ? "empty" : "",
    hidden ? "facedown" : "faceup",
    kind ?? "",
    ink ? `ink-${ink}` : "",
    props.selectable ? "selectable" : "",
    props.selected ? "selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rank = rankGlyph(def);
  const name = def?.name || (def ? labelCard(catalog, props.card!) : "—");
  const sub = def
    ? def.arcana === "major" && !def.tags.includes("court")
      ? def.deck === "moonlight"
        ? "Moon Major"
        : "Sun Major"
      : `${def.deck === "moonlight" ? "Moon" : "Sun"} · ${def.lineageId ?? ""}`
    : "";

  return (
    <div
      className={cls}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onClick={props.onClick}
      onKeyDown={
        props.onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                props.onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="card-kicker">{props.title}</div>
      {hidden ? (
        <div className="card-art-shell facedown-shell">
          <div className="card-back-kind">{kind === "major" ? "Major" : "Minor"}</div>
          <div className="card-back-mark">{kind === "major" ? "★" : "◆"}</div>
        </div>
      ) : (
        <div className={`card-art-shell ${art ? "has-art" : "no-art"} ${ink ? `tone-${ink}` : ""}`}>
          {art ? <img className="card-art" src={art} alt="" draggable={false} /> : <div className="card-art-placeholder" />}
          {def ? (
            <CardFrameSvg
              rank={rank}
              name={name}
              sub={sub}
              ink={ink}
              major={kind === "major"}
            />
          ) : null}
        </div>
      )}
      {props.note ? <div className="card-note">{props.note}</div> : null}
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
