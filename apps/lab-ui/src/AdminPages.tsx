import { useState } from "react";
import type { GameState, L0LabDocument } from "@nexus/game-core";
import { proseDocument } from "./story";

export function SettingsPage(props: {
  doc: L0LabDocument;
  patch: <K extends keyof L0LabDocument>(key: K, value: L0LabDocument[K]) => void;
}) {
  const { doc, patch } = props;
  return (
    <section className="admin-page">
      <h2>Settings</h2>
      <p>In-memory. Restart or Run to compile into the engine.</p>
      <div className="settings-grid">
        <label>
          rounds
          <input type="number" min={1} value={doc.rounds} onChange={(e) => patch("rounds", Number(e.target.value) || 1)} />
        </label>
        <label>
          tableAdvancesPerRound
          <input
            type="number"
            min={1}
            value={doc.tableAdvancesPerRound}
            onChange={(e) => patch("tableAdvancesPerRound", Number(e.target.value) || 1)}
          />
        </label>
        <label>
          handLimit
          <input type="number" value={doc.handLimit} onChange={(e) => patch("handLimit", Number(e.target.value) || 1)} />
        </label>
        <label>
          startHand
          <input
            type="number"
            value={doc.startingHandSize}
            onChange={(e) => patch("startingHandSize", Number(e.target.value) || 0)}
          />
        </label>
        <label>
          barrierThr (fallback)
          <input
            type="number"
            value={doc.barrierThreshold}
            onChange={(e) => patch("barrierThreshold", Number(e.target.value) || 0)}
          />
        </label>
        <label>
          dialogueThr (fallback)
          <input
            type="number"
            value={doc.dialogueThreshold}
            onChange={(e) => patch("dialogueThreshold", Number(e.target.value) || 0)}
          />
        </label>
        <label>
          barrierDmg
          <input
            type="number"
            value={doc.barrierDamage}
            onChange={(e) => patch("barrierDamage", Number(e.target.value) || 0)}
          />
        </label>
        <label>
          <input type="checkbox" checked={doc.enableMajors} onChange={(e) => patch("enableMajors", e.target.checked)} />
          enableMajors (20-arcana table cards)
        </label>
        <label>
          <input type="checkbox" checked={doc.enableCourts} onChange={(e) => patch("enableCourts", e.target.checked)} />
          enableCourts (L0 Jack/Queen/King)
        </label>
        <label>
          <input type="checkbox" checked={doc.enableEclipse} onChange={(e) => patch("enableEclipse", e.target.checked)} />
          enableEclipse
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.eclipseOnTable}
            onChange={(e) => patch("eclipseOnTable", e.target.checked)}
          />
          eclipseOnTable (matching J/Q/K, or Sun/Moon pair, on the round table)
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.eclipseOnAltar}
            onChange={(e) => patch("eclipseOnAltar", e.target.checked)}
          />
          eclipseOnAltar (two Majors on the Altar)
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.keepRoundTableFilled}
            onChange={(e) => patch("keepRoundTableFilled", e.target.checked)}
          />
          keepRoundTableFilled (always pack PD → MIDDLE → LEFT)
        </label>
        <label>
          eventCombatRounds
          <select
            value={doc.eventCombatRounds}
            onChange={(e) => patch("eventCombatRounds", Number(e.target.value) === 2 ? 2 : 1)}
          >
            <option value={1}>1 (one-shot)</option>
            <option value={2}>2 (then stalemate = fail)</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.enableElementalDice}
            onChange={(e) => patch("enableElementalDice", e.target.checked)}
          />
          enableElementalDice (L2 slot — off until pamphlet locks)
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.dealStartingAce}
            onChange={(e) => patch("dealStartingAce", e.target.checked)}
          />
          dealStartingAce (random Ace into lineage at SETUP)
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.evolveByColor}
            onChange={(e) => patch("evolveByColor", e.target.checked)}
          />
          evolveByColor — L1 secondary elemental: Ace may grow with any color at +2. L0 leave off (same lineage only).
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.autoClaimAceLineage}
            onChange={(e) => patch("autoClaimAceLineage", e.target.checked)}
          />
          autoClaimAceLineage (fallback: steal Ace from hand)
        </label>
        <label>
          <input type="checkbox" checked={doc.enableDayDial} onChange={(e) => patch("enableDayDial", e.target.checked)} />
          enableDayDial — L0 leave off. L1: Sun +1 by day, Moon +1 by night. 2p is DDNN so turns 1–2 are both day; night starts turn 3.
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.enableElementalManipulation}
            onChange={(e) => patch("enableElementalManipulation", e.target.checked)}
          />
          enableElemental
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.dialogueParticipants === "all_living"}
            onChange={(e) => patch("dialogueParticipants", e.target.checked ? "all_living" : "active_only")}
          />
          dialogue all living
        </label>
        <label>
          <input type="checkbox" checked={doc.manipulationFree} onChange={(e) => patch("manipulationFree", e.target.checked)} />
          manipFree
        </label>
        <label>
          <input
            type="checkbox"
            checked={doc.simulation.exportFullTrace}
            onChange={(e) => patch("simulation", { ...doc.simulation, exportFullTrace: e.target.checked })}
          />
          exportFullTrace
        </label>
      </div>
      <p>playableLineageIds: {doc.playableLineageIds.length ? doc.playableLineageIds.join(", ") : "(all eight)"}</p>
      <p>unimplemented: {Object.keys(doc.unimplemented).join("; ")}</p>
      <pre className="json-preview">{JSON.stringify(doc, null, 2)}</pre>
    </section>
  );
}

export function LogsPage(props: { state: GameState; onDownload: () => void }) {
  const [copyMsg, setCopyMsg] = useState("");
  const [newestFirst, setNewestFirst] = useState(false);
  const [mode, setMode] = useState<"technical" | "prose">("prose");
  const ordered = newestFirst ? props.state.log.slice().reverse() : props.state.log;
  const technical = ordered
    .map((e) => {
      const { seq, clock, type, ...rest } = e;
      return `#${seq} ${type} ${JSON.stringify(rest)}`;
    })
    .join("\n");
  const prose = proseDocument(props.state);
  const body = mode === "technical" ? technical : prose;

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(body || "");
      setCopyMsg("copied");
    } catch {
      setCopyMsg("copy failed");
    }
  }

  function downloadProse() {
    const blob = new Blob([prose], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-prose-${props.state.meta.seed ?? "match"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-page">
      <h2>Logs</h2>
      <p className="log-split-note">
        <b>Prose</b> is for story / image prompts. <b>Technical</b> is the engine JSON event stream.
      </p>
      <div className="log-modes">
        <button type="button" className={mode === "prose" ? "on" : ""} onClick={() => setMode("prose")}>
          Prose
        </button>
        <button type="button" className={mode === "technical" ? "on" : ""} onClick={() => setMode("technical")}>
          Technical
        </button>
      </div>
      {mode === "technical" ? (
        <button type="button" onClick={props.onDownload}>
          Download technical JSON
        </button>
      ) : (
        <button type="button" onClick={downloadProse}>
          Download prose
        </button>
      )}
      {mode === "technical" ? (
        <button type="button" onClick={() => setNewestFirst((v) => !v)}>
          {newestFirst ? "Show oldest first" : "Show newest first"}
        </button>
      ) : null}
      <button type="button" onClick={() => void copyLog()}>
        Copy {mode}
      </button>
      {copyMsg ? <span> {copyMsg}</span> : null}
      <pre className={mode === "prose" ? "prose-log" : undefined}>{body || "no events yet"}</pre>
    </section>
  );
}

type BatchSummary = {
  gamesCompleted?: number;
  outcomePct?: Record<string, number>;
  outcomes?: Record<string, number>;
  events?: {
    barrier?: { pct?: number; count?: number };
    dialogue?: { pct?: number; count?: number };
    treasure?: { pct?: number; count?: number };
  };
  barrier?: { successPct?: number; failurePct?: number };
  dialogue?: { successPct?: number; failurePct?: number };
  eclipseNexus?: {
    gamesWithEclipsePct?: number;
    averageEclipseCount?: number;
    gamesWithNexusPct?: number;
    gamesWithCharacterPct?: number;
    averageFirstEclipseTurn?: number | null;
    note?: string;
  };
  lineage?: { gamesWithEvolutionPct?: number; gamesWithClaimPct?: number; averageFinalRank?: number };
  pressure?: { deaths?: number; averageHpLost?: number };
  engineHealth?: { gamesWithInvariantFailures?: number };
};

export function StatsPage(props: { state: GameState; batchOut: string }) {
  const log = props.state.log;
  const count = (t: string) => log.filter((e) => e.type === t).length;
  const kind = (k: string) => log.filter((e) => e.type === "EVENT_ROLLED" && e.kind === k).length;
  const eclipses = log.filter((e) => e.type === "ECLIPSE");
  const seatsEclipsed = props.state.players.filter((p) => p.eclipse).length;
  const seatN = props.state.players.length;
  const batch = parseBatch(props.batchOut);
  const n = batch?.gamesCompleted ?? 0;
  const eclipseGamesPct = batch?.eclipseNexus?.gamesWithEclipsePct;
  const seatsPerGame = batch?.eclipseNexus?.averageEclipseCount;
  const seatsMax = seatN;

  return (
    <section className="admin-page stats-page">
      <h2>Stats</h2>

      {batch && n > 0 ? (
        <div className="baseline">
          <header className="baseline-head">
            <h3>Batch baseline</h3>
            <span className="baseline-pill">{n} games</span>
          </header>
          <p className="baseline-sub">
            Rates across the whole batch — not the single seed open on the table below.
          </p>

          <div className="stat-cards">
            <StatCard
              value={fmtPct(eclipseGamesPct)}
              label="Games with Eclipse"
              hint={
                eclipseGamesPct == null
                  ? undefined
                  : eclipseGamesPct >= 99
                    ? "At least one seat Eclipsed in almost every game."
                    : `${Math.round(eclipseGamesPct)}% of matches saw Eclipse fire.`
              }
              tone={eclipseGamesPct != null && eclipseGamesPct >= 80 ? "good" : eclipseGamesPct != null && eclipseGamesPct < 40 ? "warn" : "neutral"}
            />
            <StatCard
              value={
                seatsPerGame == null
                  ? "—"
                  : `${fmtNum(seatsPerGame)} / ${seatsMax}`
              }
              label="Seats eclipsed per game"
              hint={`Each seat Eclipses at most once. In ${seatsMax}p, ${seatsMax}.0 means everyone got Eclipse.`}
              tone={
                seatsPerGame != null && seatsPerGame >= seatsMax * 0.9
                  ? "good"
                  : seatsPerGame != null && seatsPerGame < 0.5
                    ? "warn"
                    : "neutral"
              }
            />
            <StatCard
              value={fmtPct(batch.eclipseNexus?.gamesWithNexusPct)}
              label="Games with Nexus"
              hint="Three table seats same element at least once."
            />
            <StatCard
              value={fmtPct(batch.lineage?.gamesWithEvolutionPct)}
              label="Games with lineage growth"
              hint="Ace evolved at least once (deal or later)."
            />
            <StatCard
              value={String(batch.pressure?.deaths ?? 0)}
              label="Total deaths"
              hint={`Avg HP lost per game: ${fmtNum(batch.pressure?.averageHpLost)}`}
              tone={(batch.pressure?.deaths ?? 0) > 0 ? "warn" : "good"}
            />
            <StatCard
              value={String(batch.engineHealth?.gamesWithInvariantFailures ?? 0)}
              label="Broken games"
              hint="Matches that raised invariant warnings."
              tone={(batch.engineHealth?.gamesWithInvariantFailures ?? 0) > 0 ? "bad" : "good"}
            />
          </div>

          <div className="baseline-grid">
            <div className="baseline-panel">
              <h4>Combat</h4>
              <dl className="stat-dl">
                <div>
                  <dt>Barrier win rate</dt>
                  <dd>{fmtPct(batch.barrier?.successPct)}</dd>
                </div>
                <div>
                  <dt>Dialogue win rate</dt>
                  <dd>{fmtPct(batch.dialogue?.successPct)}</dd>
                </div>
                <div>
                  <dt>First Eclipse (avg turn)</dt>
                  <dd>{fmtNum(batch.eclipseNexus?.averageFirstEclipseTurn ?? undefined)}</dd>
                </div>
                <div>
                  <dt>Characters claimed</dt>
                  <dd>{fmtPct(batch.eclipseNexus?.gamesWithCharacterPct)} of games</dd>
                </div>
              </dl>
            </div>
            <div className="baseline-panel">
              <h4>How games end</h4>
              <OutcomeList outcomes={batch.outcomes} pct={batch.outcomePct} n={n} />
            </div>
            <div className="baseline-panel">
              <h4>Event die mix</h4>
              <OutcomeList
                outcomes={{
                  barrier: batch.events?.barrier?.count,
                  dialogue: batch.events?.dialogue?.count,
                  treasure: batch.events?.treasure?.count,
                }}
                pct={{
                  barrier: batch.events?.barrier?.pct,
                  dialogue: batch.events?.dialogue?.pct,
                  treasure: batch.events?.treasure?.pct,
                }}
                n={
                  (batch.events?.barrier?.count ?? 0) +
                  (batch.events?.dialogue?.count ?? 0) +
                  (batch.events?.treasure?.count ?? 0)
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <p className="batch-charts-empty">Run 1 / 10 / 50 / 100 to build a batch baseline here.</p>
      )}

      <h3>This open game</h3>
      <div className="stat-cards this-game">
        <StatCard
          value={`${seatsEclipsed} / ${seatN}`}
          label="Seats eclipsed"
          hint={eclipses.length ? `${eclipses.length} Eclipse event(s) in the log.` : "No Eclipse yet."}
          tone={seatsEclipsed > 0 ? "good" : "neutral"}
        />
        <StatCard value={props.state.meta.outcome} label="Outcome" />
        <StatCard value={`${props.state.meta.turn}/${props.state.meta.maxTurns}`} label="Turn clock" />
        <StatCard
          value={`${kind("barrier")} / ${kind("dialogue")} / ${kind("treasure")}`}
          label="Barrier / Dialogue / Treasure rolls"
        />
      </div>
      <table className="stats-table">
        <tbody>
          <tr>
            <th>Barrier resolved</th>
            <td>{count("BARRIER_RESOLVED")}</td>
          </tr>
          <tr>
            <th>Dialogue resolved</th>
            <td>{count("DIALOGUE_RESOLVED")}</td>
          </tr>
          <tr>
            <th>Altar overflows</th>
            <td>{count("ALTAR_OVERFLOW")}</td>
          </tr>
          <tr>
            <th>Major fill diverts</th>
            <td>{log.filter((e) => e.type === "MAJOR_DIVERTED" && String(e.reason).startsWith("fill_")).length}</td>
          </tr>
          <tr>
            <th>Element uses (A/F/W/E)</th>
            <td>
              {countEl(log, "air")} / {countEl(log, "fire")} / {countEl(log, "water")} / {countEl(log, "earth")}
            </td>
          </tr>
        </tbody>
      </table>
      {props.batchOut ? (
        <details className="batch-raw">
          <summary>Raw batch JSON</summary>
          <pre>{props.batchOut}</pre>
        </details>
      ) : null}
    </section>
  );
}

function StatCard(props: {
  value: string;
  label: string;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={`stat-card tone-${props.tone ?? "neutral"}`}>
      <div className="stat-card-value">{props.value}</div>
      <div className="stat-card-label">{props.label}</div>
      {props.hint ? <p className="stat-card-hint">{props.hint}</p> : null}
    </div>
  );
}

function OutcomeList(props: {
  outcomes?: Record<string, number | undefined>;
  pct?: Record<string, number | undefined>;
  n: number;
}) {
  const keys = Object.keys(props.pct ?? props.outcomes ?? {});
  if (!keys.length) return <p className="muted">—</p>;
  return (
    <ul className="outcome-list">
      {keys.map((k) => {
        const count = props.outcomes?.[k];
        const p = props.pct?.[k];
        return (
          <li key={k}>
            <span className="outcome-name">{k}</span>
            <span className="outcome-nums">
              {count != null ? <b>{count}</b> : null}
              {count != null && props.n > 0 ? <span> / {props.n}</span> : null}
              {p != null ? <span className="outcome-pct"> ({fmtPct(p)})</span> : null}
            </span>
            <div className="pct-bar-track slim-inline" aria-hidden>
              <div className="pct-bar-fill" style={{ width: p == null ? "0%" : `${Math.min(100, p)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function parseBatch(raw: string): BatchSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BatchSummary;
  } catch {
    return null;
  }
}

function fmtPct(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}

function fmtNum(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

function countEl(log: GameState["log"], el: string): number {
  return log.filter((e) => e.type === "MANIP_USED" && e.element === el).length;
}
