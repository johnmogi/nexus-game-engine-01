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
import { batch, printBatch, type BatchResult } from "@nexus/sim";

const catalog = proxyCatalog();
const RULE_FILES = ["l0.rules.json", "l1.rules.json"] as const;

function compiled(doc: L0LabDocument) {
  return compileLabDocument(doc);
}

function boot(seed: string, doc: L0LabDocument) {
  const { ruleset, playerCount } = compiled(doc);
  const ctx: EngineCtx = { ruleset, catalog };
  return { state: createGame({ seed, playerCount, ruleset, catalog }), ctx, playerCount };
}

function actionLabel(a: Action, state: GameState): string {
  if (a.type === "ADVANCE") return `${a.playerId}: Advance / ${state.meta.phase}`;
  if (a.type === "SKIP_MANIP") return `${a.playerId}: Pass`;
  if (a.type === "MANIP") return `${a.playerId}: ${a.element}`;
  if (a.type === "TAKE_REWARD") return `${a.playerId}: Reward → ${a.dest}`;
  if (a.type === "COMMIT") {
    if (a.cardId === "pass") return `${a.playerId}: Pass commit`;
    const card = state.players.find((p) => p.id === a.playerId)?.hand.find((c) => c.instanceId === a.cardId);
    return `${a.playerId}: Commit ${card ? labelCard(catalog, card) : a.cardId}`;
  }
  return JSON.stringify(a);
}

function collectLegal(state: GameState, ctx: EngineCtx): Action[] {
  return state.players.flatMap((p) => getLegalActions(state, p.id, ctx));
}

export function App() {
  const [rulesName, setRulesName] = useState<(typeof RULE_FILES)[number]>("l0.rules.json");
  const [fileDoc, setFileDoc] = useState<L0LabDocument | null>(null);
  const [doc, setDoc] = useState<L0LabDocument | null>(null);
  const [seed, setSeed] = useState("nexus-test");
  const [view, setView] = useState<"admin" | "player">("admin");
  const [viewer, setViewer] = useState("P1");
  const [loadErr, setLoadErr] = useState("");
  const [state, setState] = useState<GameState | null>(null);
  const ctxRef = useRef<EngineCtx | null>(null);
  const [msg, setMsg] = useState("load rules file");
  const [batchOut, setBatchOut] = useState("");
  const lastExport = useRef<BatchResult["exportFiles"] | null>(null);
  const [customGames, setCustomGames] = useState(25);

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
    ctxRef.current = next.ctx;
    setState(next.state);
    setMsg(`loaded config/${name}`);
    setBatchOut("");
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

  function restart() {
    if (!doc) return;
    const next = boot(seed, doc);
    ctxRef.current = next.ctx;
    setState(next.state);
    setMsg("restarted from in-memory ruleset");
  }

  function resetToFile() {
    if (!fileDoc) return;
    setDoc(fileDoc);
    const next = boot(seed, fileDoc);
    ctxRef.current = next.ctx;
    setState(next.state);
    setMsg(`reset to config/${rulesName}`);
    setBatchOut("");
  }

  function apply(action: Action) {
    if (!ctxRef.current) return;
    const result = dispatch(state, action, ctxRef.current);
    if (!result.ok) {
      setMsg(result.error.message);
      return;
    }
    setState(result.state);
    setMsg(result.events.map((e) => e.type).join(" · ") || "ok");
  }

  function stepOnce() {
    if (!ctxRef.current) return;
    const id = nextActor(state, ctxRef.current);
    const legal = id ? getLegalActions(state, id, ctxRef.current) : collectLegal(state, ctxRef.current);
    if (!legal[0]) {
      setMsg("no legal actions");
      return;
    }
    apply(legal[0]);
  }

  function autoTurn() {
    if (!ctxRef.current) return;
    let s = state;
    const startTurn = s.meta.turn;
    for (let i = 0; i < 400; i++) {
      if (s.meta.outcome !== "playing") break;
      const legal = collectLegal(s, ctxRef.current);
      if (!legal[0]) break;
      const result = dispatch(s, legal[0], ctxRef.current);
      if (!result.ok) break;
      s = result.state;
      if (s.meta.turn > startTurn) break;
    }
    setState(s);
    setMsg("auto turn");
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
      setMsg(`batch ${games} · ${result.rows[0]?.seed ?? ""} … ${result.rows.at(-1)?.seed ?? ""}`);
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

  const allLegal = collectLegal(state, ctxRef.current);
  const warnings = view === "admin" ? evaluateInvariants(state, ctxRef.current) : [];
  const maxTurns = shown.meta.maxTurns;
  const ticks = Array.from({ length: maxTurns }, (_, i) => i + 1);

  function patch<K extends keyof L0LabDocument>(key: K, value: L0LabDocument[K]) {
    setDoc({ ...doc, [key]: value });
  }

  return (
    <div className="lab">
      <header>
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
        <strong>
          Round {shown.meta.round}/{shown.meta.rounds} · Turn {shown.meta.turn}/{shown.meta.maxTurns} · Active{" "}
          {shown.meta.activePlayerId}
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
        <button type="button" onClick={stepOnce} disabled={shown.meta.outcome !== "playing"}>
          Step
        </button>
        <button type="button" onClick={autoTurn} disabled={shown.meta.outcome !== "playing"}>
          Auto Turn
        </button>
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
        <label>
          View{" "}
          <select value={view} onChange={(e) => setView(e.target.value as "admin" | "player")}>
            <option value="admin">Admin</option>
            <option value="player">Player</option>
          </select>
        </label>
        {view === "player" ? (
          <select value={viewer} onChange={(e) => setViewer(e.target.value)}>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        ) : null}
        <span className="msg">{msg}</span>
      </header>

      <p>
        Ruleset file: config/{rulesName} · {doc.version} · turn limit {doc.rounds}×{doc.tableAdvancesPerRound}=
        {live.ruleset.experimental.maxTurns} · Restart to apply in-memory edits
      </p>

      <div className="timeline" aria-label="turn timeline">
        {ticks.map((t) => (
          <span key={t} className={t === shown.meta.turn ? "tick now" : "tick"}>
            T{t}
            {t % advances === 0 && t !== maxTurns ? " |" : ""}
          </span>
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
      ) : (
        <section className="warnings ok">INVARIANTS ok</section>
      )}

      <section className="board">
        <div className="zone">
          <h2>DRAW DECK</h2>
          <p>{shown.drawDeck.length} cards</p>
          <h2>VEIL</h2>
          <p>{shown.veil.length} cards</p>
        </div>
        <div className="zone table">
          <h2>ROUND TABLE</h2>
          <div className="slots">
            {(["left", "middle", "pd"] as const).map((which) => (
              <div key={which}>
                <b>{which.toUpperCase()}</b>
                <div>{labelCard(catalog, shown.roundTable[which][0])}</div>
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
          <p>Minor: {shown.altar.minors.map((c) => labelCard(catalog, c)).join(", ") || "—"}</p>
          <p>Major: {shown.altar.major.map((c) => labelCard(catalog, c)).join(", ") || "—"}</p>
        </div>
      </section>

      <section className="players">
        {shown.players.map((p) => (
          <div key={p.id} className={p.id === shown.meta.activePlayerId ? "seat active" : "seat"}>
            <h2>
              {p.id} · HP {p.health} · {p.joker.active || p.eclipse ? "Joker/Eclipse ON" : "Joker off"}
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
        <h2>LEGAL ACTIONS</h2>
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

      <section className="bottom">
        <div className="toggles">
          <h2>IN-MEMORY TOGGLES (Restart / Run to apply)</h2>
          <label>
            rounds{" "}
            <input type="number" min={1} value={doc.rounds} onChange={(e) => patch("rounds", Number(e.target.value) || 1)} />
            × {doc.tableAdvancesPerRound} = {doc.rounds * doc.tableAdvancesPerRound} turns
          </label>
          <label>
            handLimit{" "}
            <input type="number" value={doc.handLimit} onChange={(e) => patch("handLimit", Number(e.target.value) || 1)} />
          </label>
          <label>
            startHand{" "}
            <input
              type="number"
              value={doc.startingHandSize}
              onChange={(e) => patch("startingHandSize", Number(e.target.value) || 0)}
            />
          </label>
          <label>
            barrierThr{" "}
            <input
              type="number"
              value={doc.barrierThreshold}
              onChange={(e) => patch("barrierThreshold", Number(e.target.value) || 0)}
            />
          </label>
          <label>
            dialogueThr{" "}
            <input
              type="number"
              value={doc.dialogueThreshold}
              onChange={(e) => patch("dialogueThreshold", Number(e.target.value) || 0)}
            />
          </label>
          <label>
            barrierDmg{" "}
            <input
              type="number"
              value={doc.barrierDamage}
              onChange={(e) => patch("barrierDamage", Number(e.target.value) || 0)}
            />
          </label>
          <label>
            enableMajors{" "}
            <input type="checkbox" checked={doc.enableMajors} onChange={(e) => patch("enableMajors", e.target.checked)} />
          </label>
          <label>
            enableElemental{" "}
            <input
              type="checkbox"
              checked={doc.enableElementalManipulation}
              onChange={(e) => patch("enableElementalManipulation", e.target.checked)}
            />
          </label>
          <label>
            dialogue all living{" "}
            <input
              type="checkbox"
              checked={doc.dialogueParticipants === "all_living"}
              onChange={(e) => patch("dialogueParticipants", e.target.checked ? "all_living" : "active_only")}
            />
          </label>
          <label>
            manipFree{" "}
            <input
              type="checkbox"
              checked={doc.manipulationFree}
              onChange={(e) => patch("manipulationFree", e.target.checked)}
            />
          </label>
          <label>
            exportFullTrace{" "}
            <input
              type="checkbox"
              checked={doc.simulation.exportFullTrace}
              onChange={(e) => patch("simulation", { ...doc.simulation, exportFullTrace: e.target.checked })}
            />
          </label>
          <p>unimplemented: {Object.keys(doc.unimplemented).join("; ")}</p>
          {batchOut ? (
            <>
              <h2>BATCH SUMMARY</h2>
              <pre>{batchOut}</pre>
            </>
          ) : null}
        </div>
        <div className="log">
          <h2>STRUCTURED EVENT LOG</h2>
          <pre>
            {shown.log
              .slice()
              .reverse()
              .map((e) => {
                const { seq, clock, type, ...rest } = e;
                return `#${seq} ${type} ${JSON.stringify(rest)}`;
              })
              .join("\n")}
          </pre>
        </div>
      </section>
    </div>
  );
}
