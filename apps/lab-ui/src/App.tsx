import { useEffect, useRef, useState } from "react";
import {
  compileLabDocument,
  createGame,
  dispatch,
  evaluateInvariants,
  getLegalActions,
  labelCard,
  nextActor,
  parseLabDocument,
  projectView,
  proxyCatalog,
  type Action,
  type EngineCtx,
  type GameState,
  type L0LabDocument,
  type PlayerCount,
} from "@nexus/game-core";
import { batch, playGameFrames, printBatch, type BatchResult } from "@nexus/sim";
import { PlayerTable } from "./PlayerTable";
import { LogsPage, SettingsPage, StatsPage } from "./AdminPages";

const catalog = proxyCatalog();
const RULE_FILES = ["l0.rules.json", "l1.rules.json"] as const;

function compiled(doc: L0LabDocument) {
  return compileLabDocument(doc);
}

function boot(seed: string, doc: L0LabDocument) {
  const { ruleset, playerCount } = compiled(doc);
  const ctx: EngineCtx = { ruleset, catalog };
  let state = createGame({ seed, playerCount, ruleset, catalog });
  state = dealOpening(state, ctx);
  return { state, ctx, playerCount };
}

/** Run SETUP automatically so the table opens already dealt. */
function dealOpening(state: GameState, ctx: EngineCtx): GameState {
  let s = state;
  for (let i = 0; i < 8 && s.meta.phase === "SETUP" && s.meta.outcome === "playing"; i++) {
    const legal = getLegalActions(s, s.meta.activePlayerId, ctx);
    const advance = legal.find((a) => a.type === "ADVANCE");
    if (!advance) break;
    const r = dispatch(s, advance, ctx);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

function actionLabel(a: Action, state: GameState): string {
  if (a.type === "ADVANCE") return `${a.playerId}: Advance / ${state.meta.phase}`;
  if (a.type === "SKIP_MANIP") return `${a.playerId}: Pass`;
  if (a.type === "MANIP") {
    if (a.element === "earth" && a.order) {
      return `${a.playerId}: earth ${a.order.join("→")}`;
    }
    return `${a.playerId}: ${a.element}`;
  }
  if (a.type === "TAKE_REWARD") return `${a.playerId}: Reward → ${a.dest}`;
  if (a.type === "COMMIT") {
    if (a.cardId === "pass") return `${a.playerId}: Pass commit`;
    const card = state.players.find((p) => p.id === a.playerId)?.hand.find((c) => c.instanceId === a.cardId);
    return `${a.playerId}: Commit ${card ? labelCard(catalog, card) : a.cardId}`;
  }
  if (a.type === "CHOOSE_CHARACTER") {
    return `${a.playerId}: Aspect → ${catalog.get(a.cardId)?.name ?? a.cardId}`;
  }
  return JSON.stringify(a);
}

function pile(cards: GameState["drawDeck"]): string {
  if (!cards.length) return "—";
  return cards.map((c) => labelCard(catalog, c)).join(" · ");
}

function collectLegal(state: GameState, ctx: EngineCtx): Action[] {
  return state.players.flatMap((p) => getLegalActions(state, p.id, ctx));
}

export function App() {
  const [rulesName, setRulesName] = useState<(typeof RULE_FILES)[number]>("l0.rules.json");
  const [fileDoc, setFileDoc] = useState<L0LabDocument | null>(null);
  const [doc, setDoc] = useState<L0LabDocument | null>(null);
  const [seed, setSeed] = useState("nexus-test");
  const [view, setView] = useState<"admin" | "player">("player");
  const [page, setPage] = useState<"table" | "settings" | "logs" | "stats">("table");
  const [viewer, setViewer] = useState("P1");
  const [loadErr, setLoadErr] = useState("");
  const [frames, setFrames] = useState<GameState[]>([]);
  const [cursor, setCursor] = useState(0);
  const [played, setPlayed] = useState<Action[]>([]);
  const [batchSeeds, setBatchSeeds] = useState<string[]>([]);
  const ctxRef = useRef<EngineCtx | null>(null);
  const [msg, setMsg] = useState("load rules file");
  const [batchOut, setBatchOut] = useState("");
  const lastExport = useRef<BatchResult["exportFiles"] | null>(null);
  const [customGames, setCustomGames] = useState(25);

  const state = frames[cursor] ?? null;

  function install(next: GameState, ctx: EngineCtx, history?: { frames: GameState[]; actions: Action[]; at?: number }) {
    ctxRef.current = ctx;
    if (history) {
      setFrames(history.frames);
      setPlayed(history.actions);
      setCursor(history.at ?? history.frames.length - 1);
    } else {
      setFrames([next]);
      setPlayed([]);
      setCursor(0);
    }
  }

  async function loadRules(name: (typeof RULE_FILES)[number]) {
    const raw = await fetch(`/${name}`).then((r) => {
      if (!r.ok) throw new Error(`failed to load config/${name}`);
      return r.json();
    });
    const parsed = parseLabDocument(raw);
    setRulesName(name);
    setFileDoc(parsed);
    setDoc(parsed);
    const next = boot(seed, parsed);
    install(next.state, next.ctx);
    setMsg(`loaded config/${name} — opening dealt`);
    setBatchOut("");
    setBatchSeeds([]);
  }

  useEffect(() => {
    void loadRules("l0.rules.json").catch((e) => setLoadErr(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!doc || !state || !ctxRef.current) {
    return (
      <div className="lab">
        <p>{loadErr || "loading rules…"}</p>
      </div>
    );
  }

  const shown = view === "admin" ? state : projectView(state, { mode: "player", viewerId: viewer });
  const live = compiled(doc);
  const advances = doc.tableAdvancesPerRound;
  const atLiveEnd = cursor === frames.length - 1;
  const canPlay = atLiveEnd && shown.meta.outcome === "playing";

  function restart() {
    if (!doc) return;
    const next = boot(seed, doc);
    install(next.state, next.ctx);
    setMsg("restarted — opening dealt");
  }

  function resetToFile() {
    if (!fileDoc) return;
    setDoc(fileDoc);
    const next = boot(seed, fileDoc);
    install(next.state, next.ctx);
    setMsg(`reset to config/${rulesName}`);
    setBatchOut("");
  }

  function apply(action: Action) {
    if (!ctxRef.current || !state) return;
    const ctx = ctxRef.current;
    let s = state;
    const extraFrames: GameState[] = [];
    const extraActs: Action[] = [];
    const first = dispatch(s, action, ctx);
    if (!first.ok) {
      setMsg(first.error.message);
      return;
    }
    extraActs.push(action);
    s = first.state;
    extraFrames.push(s);
    for (let i = 0; i < 80; i++) {
      if (s.meta.outcome !== "playing") break;
      const legal = collectLegal(s, ctx);
      if (!legal.length || legal.some((a) => a.type !== "ADVANCE")) break;
      const next = dispatch(s, legal[0]!, ctx);
      if (!next.ok) break;
      extraActs.push(legal[0]!);
      s = next.state;
      extraFrames.push(s);
    }
    const nextFrames = [...frames.slice(0, cursor + 1), ...extraFrames];
    setFrames(nextFrames);
    setPlayed([...played.slice(0, cursor), ...extraActs]);
    setCursor(nextFrames.length - 1);
    setMsg(s.log.slice(state.log.length).map((e) => e.type).join(" · ") || "ok");
  }

  function stepOnce() {
    if (!ctxRef.current || !state) return;
    const id = nextActor(state, ctxRef.current);
    const legal = id ? getLegalActions(state, id, ctxRef.current) : collectLegal(state, ctxRef.current);
    if (!legal[0]) {
      setMsg("no legal actions");
      return;
    }
    apply(legal[0]);
  }

  function autoTurn() {
    if (!ctxRef.current || !state) return;
    let s = state;
    const startTurn = s.meta.turn;
    const extraFrames: GameState[] = [];
    const extraActs: Action[] = [];
    for (let i = 0; i < 400; i++) {
      if (s.meta.outcome !== "playing") break;
      const legal = collectLegal(s, ctxRef.current);
      if (!legal[0]) break;
      const result = dispatch(s, legal[0], ctxRef.current);
      if (!result.ok) break;
      extraActs.push(legal[0]);
      s = result.state;
      extraFrames.push(s);
      if (s.meta.turn > startTurn) break;
    }
    const nextFrames = [...frames.slice(0, cursor + 1), ...extraFrames];
    setFrames(nextFrames);
    setPlayed([...played.slice(0, cursor), ...extraActs]);
    setCursor(nextFrames.length - 1);
    setMsg("auto turn");
  }

  function loadReplay(runSeed: string) {
    if (!doc) return;
    const { ruleset, playerCount } = compiled(doc);
    const ctx: EngineCtx = { ruleset, catalog };
    const rec = playGameFrames({ seed: runSeed, playerCount, ruleset });
    install(rec.frames[0]!, ctx, { frames: rec.frames, actions: rec.actions });
    setSeed(runSeed);
    setMsg(`replay ${runSeed} · ${rec.frames.length} frames · ${rec.frames.at(-1)?.meta.outcome}`);
  }

  function runN(games: number) {
    try {
      const result = batch({
        seed,
        playerCount: live.playerCount,
        games,
        ruleset: live.ruleset,
        labDocument: doc,
        simulation: doc.simulation,
      });
      lastExport.current = result.exportFiles;
      setBatchOut(printBatch(result.rows));
      const seeds = result.rows.map((r) => r.seed);
      setBatchSeeds(seeds);
      const first = seeds[0];
      if (first) loadReplay(first);
      setPage("stats");
      setMsg(`batch ${games} · stats open · showing ${first ?? ""}`);
    } catch (e) {
      setMsg(String(e));
    }
  }

  async function exportLatest() {
    const built = lastExport.current;
    if (!built) {
      setMsg("run a batch first");
      return;
    }
    try {
      const res = await fetch("/__nexus_export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(built),
      });
      const data = (await res.json()) as { dest?: string };
      setMsg(data.dest ? `exported ${data.dest}` : "export failed");
    } catch (e) {
      setMsg(String(e));
    }
  }

  function seekTurn(turn: number) {
    if (turn <= 0) {
      setCursor(0);
      return;
    }
    let last = -1;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i]!.meta.turn === turn) last = i;
    }
    if (last >= 0) setCursor(last);
  }

  const allLegal = canPlay ? collectLegal(state, ctxRef.current) : [];
  const warnings = view === "admin" ? evaluateInvariants(state, ctxRef.current) : [];
  const maxTurns = shown.meta.maxTurns;
  const ticks = Array.from({ length: maxTurns }, (_, i) => i + 1);
  const lastAct = cursor > 0 ? played[cursor - 1] : undefined;
  const lastActState = cursor > 0 ? frames[cursor - 1] : undefined;

  function patch<K extends keyof L0LabDocument>(key: K, value: L0LabDocument[K]) {
    setDoc({ ...doc, [key]: value });
  }

  return (
    <div className={`lab${view === "player" ? " lab-player" : ""}`}>
      <header className="toolbar">
        <div className="toolbar-main">
        <label>
          Rules{" "}
          <select
            value={rulesName}
            onChange={(e) => void loadRules(e.target.value as (typeof RULE_FILES)[number])}
          >
            {RULE_FILES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          Players{" "}
          <select
            value={doc.playerCount}
            onChange={(e) => patch("playerCount", Number(e.target.value) as PlayerCount)}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label>
          seed{" "}
          <input value={seed} onChange={(e) => setSeed(e.target.value)} size={18} />
        </label>
        <strong>
          Round {shown.meta.round}/{shown.meta.rounds} · Turn {shown.meta.turn}/{shown.meta.maxTurns} · Dial{" "}
          {shown.meta.dial} · Active {shown.meta.activePlayerId}
        </strong>
        <span>
          Phase: {shown.meta.phase} · {shown.meta.outcome}
        </span>
        <button type="button" onClick={restart}>
          Restart
        </button>
        <button type="button" onClick={resetToFile}>
          Reset to file
        </button>
        <button type="button" onClick={stepOnce} disabled={!canPlay}>
          Step
        </button>
        <button type="button" onClick={autoTurn} disabled={!canPlay}>
          Auto Turn
        </button>
        <label>
          View{" "}
          <select value={view} onChange={(e) => setView(e.target.value as "admin" | "player")}>
            <option value="admin">God (see all)</option>
            <option value="player">Seat (hidden table)</option>
          </select>
        </label>
        <select value={viewer} onChange={(e) => setViewer(e.target.value)} aria-label="Seat">
          {state.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
        <span className="msg">{msg}</span>
        </div>
        <details className="toolbar-batch" open={view === "admin"}>
          <summary>Batch / export</summary>
          <button type="button" onClick={() => runN(1)}>
            Run 1
          </button>
          <button type="button" onClick={() => runN(10)}>
            Run 10
          </button>
          <button type="button" onClick={() => runN(50)}>
            Run 50
          </button>
          <button type="button" onClick={() => runN(100)}>
            Run 100
          </button>
          <label>
            custom{" "}
            <input type="number" min={1} value={customGames} onChange={(e) => setCustomGames(Number(e.target.value) || 1)} />
          </label>
          <button type="button" onClick={() => runN(customGames)}>
            Run N
          </button>
          <button type="button" onClick={() => void exportLatest()}>
            Export latest batch
          </button>
        </details>
      </header>

      <nav className="pages">
        {(["table", "settings", "logs", "stats"] as const).map((p) => (
          <button key={p} type="button" className={page === p ? "on" : ""} onClick={() => setPage(p)}>
            {p[0]!.toUpperCase() + p.slice(1)}
          </button>
        ))}
      </nav>

      {view === "admin" ? (
        <p className="ruleset-line">
          Ruleset file: config/{rulesName} · {doc.version} · turn limit {doc.rounds}×{doc.tableAdvancesPerRound}=
          {live.ruleset.experimental.maxTurns} · lineages{" "}
          {doc.playableLineageIds.length
            ? `Sun only (${doc.playableLineageIds.join(", ")})`
            : "all 8 (Sun + Moon)"}{" "}
          · Restart to apply in-memory edits
        </p>
      ) : null}

      <div className="replay">
        <button type="button" disabled={cursor <= 0} onClick={() => setCursor(cursor - 1)}>
          Back
        </button>
        <button type="button" disabled={cursor >= frames.length - 1} onClick={() => setCursor(cursor + 1)}>
          Fwd
        </button>
        <label>
          frame{" "}
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={cursor}
            onChange={(e) => setCursor(Number(e.target.value))}
          />{" "}
          {cursor}/{Math.max(0, frames.length - 1)}
        </label>
        {batchSeeds.length ? (
          <label>
            run{" "}
            <select value={seed} onChange={(e) => loadReplay(e.target.value)}>
              {batchSeeds.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <button type="button" onClick={() => loadReplay(seed)}>
            Replay this seed
          </button>
        )}
        <span>
          {lastAct && lastActState
            ? `last: ${actionLabel(lastAct, lastActState)}`
            : "SETUP — no cards dealt yet. Step, Replay this seed, or Run 1."}
        </span>
      </div>

      <div className="timeline" aria-label="turn timeline">
        <button type="button" className={shown.meta.turn === 0 ? "tick now" : "tick"} onClick={() => seekTurn(0)}>
          T0
        </button>
        {ticks.map((t) => (
          <button
            key={t}
            type="button"
            className={t === shown.meta.turn ? "tick now" : "tick"}
            onClick={() => seekTurn(t)}
          >
            T{t}
            {t % advances === 0 && t !== maxTurns ? " |" : ""}
          </button>
        ))}
        <div className="timeline-rounds">
          {Array.from({ length: shown.meta.rounds }, (_, i) => (
            <span key={i} className={shown.meta.round === i + 1 ? "now" : ""}>
              R{i + 1}
            </span>
          ))}
        </div>
      </div>

      {warnings.length ? (
        <section className="warnings">
          <h2>INVARIANT WARNINGS</h2>
          {warnings.map((w, i) => (
            <div key={i}>
              {w.code}: {w.detail}
            </div>
          ))}
        </section>
      ) : view === "admin" ? (
        <section className="warnings ok">INVARIANTS ok</section>
      ) : null}

      {page === "table" && ctxRef.current ? (
        <PlayerTable
          state={state}
          ctx={ctxRef.current}
          viewerId={viewer}
          legal={allLegal}
          canPlay={canPlay}
          fog={view === "player"}
          revealHands={view === "admin"}
          onAct={apply}
        />
      ) : null}

      {view === "admin" && page === "table" ? (
      <details className="admin-dump">
        <summary>Admin dump (zones / legal)</summary>
      <section className="board">
        <div className="zone">
          <h2>DRAW DECK</h2>
          <p>{shown.drawDeck.length} cards</p>
          <p className="pile">{view === "admin" ? pile(shown.drawDeck.slice(0, 8)) + (shown.drawDeck.length > 8 ? " …" : "") : "(hidden)"}</p>
          <h2>VEIL</h2>
          <p>{shown.veil.length} cards</p>
          <p className="pile">{pile(shown.veil)}</p>
          <h2>HOLD</h2>
          <p>Nexus: {pile(shown.hold?.nexus ?? [])}</p>
          <p>Characters: {pile(shown.hold?.characters ?? [])}</p>
        </div>
        <div className="zone table">
          <h2>ROUND TABLE</h2>
          <div className="slots">
            {(["left", "middle", "pd"] as const).map((which) => (
              <div key={which}>
                <b>
                  {which.toUpperCase()} ({shown.roundTable[which].length})
                </b>
                <div className="pile">{pile(shown.roundTable[which])}</div>
              </div>
            ))}
          </div>
          <p>
            nexus={String(shown.flags.nexus)} event={shown.flags.lastEvent ?? "—"} roll=
            {shown.flags.lastEventRoll ?? "—"}
          </p>
        </div>
        <div className="zone">
          <h2>ALTAR</h2>
          <p>Minor: {pile(shown.altar.minors)}</p>
          <p>Major: {pile(shown.altar.major)}</p>
        </div>
      </section>

      <section className="players">
        {shown.players.map((p) => (
          <div key={p.id} className={p.id === shown.meta.activePlayerId ? "seat active" : "seat"}>
            <h2>
              {p.id} · HP {p.health} · {p.joker.active || p.eclipse ? "Joker/Eclipse ON" : "Joker off"}
              {p.aspect ? ` · ${catalog.get(p.aspect)?.name ?? p.aspect}` : ""}
            </h2>
            <p>lineage: {p.lineage.length ? p.lineage.map((c) => labelCard(catalog, c)).join(" → ") : "—"}</p>
            <p>
              hand ({p.hand.length}/{doc.handLimit}):{" "}
              {p.hand.map((c) => labelCard(catalog, c)).join(", ") || "empty"}
            </p>
          </div>
        ))}
      </section>

      <section className="actions">
        <h2>
          LEGAL ACTIONS{" "}
          {!atLiveEnd ? "(history — Fwd to the last frame to act)" : shown.meta.outcome !== "playing" ? "(game over)" : ""}
        </h2>
        {allLegal.length === 0 ? (
          <p>none</p>
        ) : (
          allLegal.map((a, i) => (
            <button key={i} type="button" onClick={() => apply(a)}>
              {actionLabel(a, state)}
            </button>
          ))
        )}
      </section>
      </details>
      ) : null}

      {page === "settings" ? <SettingsPage doc={doc} patch={patch} /> : null}
      {page === "logs" ? (
        <LogsPage
          state={shown}
          onDownload={() => {
            const blob = new Blob([JSON.stringify(shown.log, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${shown.meta.seed}-log.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            setMsg("downloaded log");
          }}
        />
      ) : null}
      {page === "stats" ? <StatsPage state={shown} batchOut={batchOut} /> : null}
    </div>
  );
}
