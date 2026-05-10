/* SCENE D — GTD Pulse (full page)
   Standalone view rendered inside Scene B via window.PulseView,
   and also mountable as its own scene for direct comparison.

   Layout (top → bottom):
     1. Masthead  — score ring, trend sparkline, weekly stats, last review, streak
     2. Signals   — warnings + praise with concrete fix-actions
     3. Buckets   — Inbox / Next / Waiting / Someday flow
     4. Flows     — Weekly Review · Process Inbox · Stale Sweep · Sharpen Vague · Nudge Waiting-For
     5. History   — 12w score trend, 84-day processing heatmap, streaks
*/

const PulseView = ({ onBack, onOpenInbox }) => {
  const p = window.APP_DATA.GTD_PULSE;
  const [flow, setFlow] = useState(null); // 'review' | 'process' | 'stale' | 'nudge' | 'sharpen' | null
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 56px 96px' }}>

        {/* Breadcrumb / back */}
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--text-3)', marginBottom: 16,
        }}>
          <Icon name="arrow-l" size={12} /> Back to Today
        </button>

        {/* Masthead */}
        <PulseMasthead pulse={p} onToggleBreakdown={() => setBreakdownOpen(v => !v)} breakdownOpen={breakdownOpen} />
        {breakdownOpen && <ScoreBreakdown pulse={p} />}

        {/* Signals */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="Signals" title="What needs your attention" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {p.warnings.map((w, i) => (
              <SignalCard key={'w'+i} kind="warn" text={w.text}
                fix={signalFix(w.text)} onFix={(kind) => setFlow(kind)} />
            ))}
            {p.praise.map((pr, i) => (
              <SignalCard key={'p'+i} kind="ok" text={pr.text} />
            ))}
          </div>
        </section>

        {/* Buckets */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="Buckets" title="Flow of work" />
          <BucketFlow pulse={p} onOpenInbox={onOpenInbox} />
        </section>

        {/* Improvement flows */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="Improvement" title="Sharpen your system" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <FlowCard
              icon="check" tone="ok"
              title="Weekly Review" badge={p.lastReview}
              desc="The canonical GTD ritual. 5 steps, guided."
              cta="Start review" onClick={() => setFlow('review')}
            />
            <FlowCard
              icon="inbox" tone="accent"
              title="Process Inbox" badge={`${p.counts.inbox} items`}
              desc="One at a time. Y/W/S/D/E keyboard."
              cta="Enter zero mode" onClick={() => setFlow('process')}
            />
            <FlowCard
              icon="clock" tone="warn"
              title="Stale Sweep" badge={`${p.stale.length} items`}
              desc="Untouched > 14 days. Demote or sharpen."
              cta="Sweep now" onClick={() => setFlow('stale')}
            />
            <FlowCard
              icon="sparkle" tone="ai"
              title="Sharpen Vague" badge="AI"
              desc="Rewrite vague task titles as concrete actions."
              cta="Open wizard" onClick={() => setFlow('sharpen')}
            />
            <FlowCard
              icon="users" tone="violet"
              title="Nudge Waiting-For" badge={`${p.waitingFor.length} people`}
              desc="Follow up on things you're blocked on."
              cta="Review nudges" onClick={() => setFlow('nudge')}
            />
            <FlowCard
              icon="focus" tone="muted"
              title="Focus mode" badge="Coming soon"
              desc="25-min timer, Next list only, silence everything."
              cta="Not yet" disabled
            />
          </div>
        </section>

        {/* History */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="History" title="Where you've been" />
          <HistoryGrid pulse={p} />
        </section>
      </div>

      {/* Flow overlays */}
      {flow === 'review'  && <WeeklyReviewWizard pulse={p} onClose={() => setFlow(null)} />}
      {flow === 'process' && <ProcessInboxMode  pulse={p} onClose={() => setFlow(null)} />}
      {flow === 'stale'   && <StaleSweep        pulse={p} onClose={() => setFlow(null)} />}
      {flow === 'nudge'   && <NudgeWaitingFor   pulse={p} onClose={() => setFlow(null)} />}
      {flow === 'sharpen' && <SharpenVague      pulse={p} onClose={() => setFlow(null)} />}
    </div>
  );
};

/* ---------- Masthead ---------- */
const PulseMasthead = ({ pulse, onToggleBreakdown, breakdownOpen }) => {
  const scoreColor = pulse.score >= 80 ? 'var(--ok)'
                   : pulse.score >= 60 ? 'var(--accent)'
                   : pulse.score >= 40 ? 'var(--warn)'
                                       : 'var(--danger)';
  const label = pulse.score >= 80 ? 'Healthy'
              : pulse.score >= 60 ? 'Holding steady'
              : pulse.score >= 40 ? 'Needs attention'
                                  : 'Overloaded';
  return (
    <header>
      <div className="mono" style={{
        fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'var(--text-3)', marginBottom: 10,
      }}>GTD Pulse · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <h1 style={{
        margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em',
        lineHeight: 1.05, maxWidth: 760,
      }}>
        <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--text-2)' }}>Your system is </span>
        <span style={{ color: scoreColor }}>{label.toLowerCase()}</span>.
      </h1>

      <div style={{
        marginTop: 28, display: 'grid', gridTemplateColumns: '220px 1fr',
        gap: 32, paddingTop: 24, borderTop: '1px solid var(--line)',
      }}>
        {/* Score ring + sparkline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <ScoreRing score={pulse.score} trend={pulse.trend} color={scoreColor} size={140} />
          <button onClick={onToggleBreakdown} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11.5, color: 'var(--text-2)',
            padding: '5px 9px', border: '1px solid var(--line)', borderRadius: 6,
          }}>
            <Icon name={breakdownOpen ? 'chev-d' : 'chev-r'} size={11} />
            {breakdownOpen ? 'Hide' : 'Show'} breakdown
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sparkline */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              Score · last 12 weeks
            </div>
            <Sparkline values={pulse.scoreHistory} color={scoreColor} />
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <MiniStat k="Processed" v={pulse.processedThisWeek} hint="this week" accent="var(--ok)" />
            <MiniStat k="Streak"    v={`${pulse.currentStreak}d`} hint={`best ${pulse.longestStreak}d`} />
            <MiniStat k="Last review" v={pulse.lastReview} hint="weekly ritual" />
            <MiniStat k="Overdue"   v="0" hint="none" accent="var(--ok)" />
          </div>
        </div>
      </div>
    </header>
  );
};

const ScoreRing = ({ score, trend, color, size = 140 }) => {
  const r = size * 0.38;
  const cx = size / 2, cy = size / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <div style={{ fontSize: 40, fontWeight: 500, letterSpacing: '-0.03em', color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: 'var(--text-4)', letterSpacing: '0.08em' }}>/ 100</div>
        <div style={{ fontSize: 10.5, color: trend >= 0 ? 'var(--ok)' : 'var(--warn)', marginTop: 4, fontWeight: 500 }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} vs last wk
        </div>
      </div>
    </div>
  );
};

const Sparkline = ({ values, color, height = 36 }) => {
  const width = 360;
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <div style={{
      padding: '8px 10px', background: 'var(--surface)',
      border: '1px solid var(--line-soft)', borderRadius: 10,
    }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height + 4}`} preserveAspectRatio="none" style={{ display: 'block', height: height + 4 }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * width;
          const y = height - ((v - min) / range) * height;
          const isLast = i === values.length - 1;
          return <circle key={i} cx={x} cy={y} r={isLast ? 3 : 1.5} fill={isLast ? color : 'var(--text-4)'} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-4)', marginTop: 4 }}>
        <span>12w ago</span><span>now · {values[values.length - 1]}</span>
      </div>
    </div>
  );
};

const MiniStat = ({ k, v, hint, accent }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>{k}</div>
    <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: accent || 'var(--text)', lineHeight: 1 }}>{v}</div>
    <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>{hint}</div>
  </div>
);

const ScoreBreakdown = ({ pulse }) => (
  <div style={{
    marginTop: 16, padding: 18,
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 12,
  }}>
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 14 }}>
      Score breakdown
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 28px' }}>
      {pulse.scoreBreakdown.map((row, i) => {
        const pct = row.earned / row.max;
        return (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{row.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.earned}/{row.max}</span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${pct * 100}%`, height: '100%',
                background: pct >= 0.85 ? 'var(--ok)' : pct >= 0.6 ? 'var(--accent)' : 'var(--warn)',
                transition: 'width .4s',
              }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>{row.hint}</div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ---------- Signal cards ---------- */
const signalFix = (text) => {
  const t = text.toLowerCase();
  if (t.includes('inbox')) return { kind: 'process', label: 'Process inbox' };
  if (t.includes('stale')) return { kind: 'stale', label: 'Sweep stale' };
  if (t.includes('waiting') || t.includes('nudge')) return { kind: 'nudge', label: 'Review nudges' };
  return null;
};

const SignalCard = ({ kind, text, fix, onFix }) => {
  const color = kind === 'warn' ? 'var(--warn)' : 'var(--ok)';
  return (
    <div style={{
      padding: 14, background: 'var(--surface)',
      border: '1px solid var(--line-soft)', borderRadius: 10,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{
        width: 24, height: 24, flexShrink: 0, borderRadius: 12,
        background: `color-mix(in oklch, ${color} 18%, transparent)`,
        color, fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }}>{kind === 'warn' ? '!' : '✓'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
        {fix && (
          <button onClick={() => onFix(fix.kind)} style={{
            marginTop: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
            background: `color-mix(in oklch, ${color} 14%, transparent)`,
            color, border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
            borderRadius: 6,
          }}>{fix.label} →</button>
        )}
      </div>
    </div>
  );
};

/* ---------- Buckets ---------- */
const BucketFlow = ({ pulse, onOpenInbox }) => {
  const buckets = [
    { id: 'inbox', label: 'Inbox',    v: pulse.counts.inbox, hint: 'to process',    tone: 'var(--text-3)', onClick: onOpenInbox },
    { id: 'next',  label: 'Next',     v: pulse.counts.next,  hint: 'ready to do',   tone: 'var(--accent)' },
    { id: 'wait',  label: 'Waiting',  v: pulse.counts.wait,  hint: 'blocked',       tone: 'var(--warn)' },
    { id: 'some',  label: 'Someday',  v: pulse.counts.some,  hint: 'parking lot',   tone: 'var(--violet)' },
    { id: 'done',  label: 'Completed',v: pulse.processedThisWeek, hint: 'this wk',  tone: 'var(--ok)' },
  ];
  return (
    <div style={{
      padding: 20, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 14,
      display: 'flex', alignItems: 'stretch', gap: 0,
    }}>
      {buckets.map((b, i) => (
        <React.Fragment key={b.id}>
          <button onClick={b.onClick} style={{
            flex: 1, padding: '4px 8px', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
            textAlign: 'left', cursor: b.onClick ? 'pointer' : 'default',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{b.label}</div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', color: b.tone, lineHeight: 1 }}>{b.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{b.hint}</div>
          </button>
          {i < buckets.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-4)', paddingTop: 28 }}>
              <Icon name="arrow-r" size={14} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ---------- Flow cards ---------- */
const FlowCard = ({ icon, title, badge, desc, cta, tone = 'accent', onClick, disabled }) => {
  const toneMap = {
    accent: 'var(--accent)', ok: 'var(--ok)', warn: 'var(--warn)',
    ai: 'var(--accent-ai)', violet: 'var(--violet)', muted: 'var(--text-3)',
  };
  const color = toneMap[tone];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      textAlign: 'left', padding: 18,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 12, opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'border-color .14s, transform .14s',
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 128,
    }}
    onMouseEnter={(e) => !disabled && (e.currentTarget.style.borderColor = color)}
    onMouseLeave={(e) => !disabled && (e.currentTarget.style.borderColor = 'var(--line)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: `color-mix(in oklch, ${color} 16%, transparent)`,
          color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={15} /></span>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em', flex: 1 }}>{title}</span>
        <span style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 4,
          color: 'var(--text-3)', background: 'var(--surface-2)',
          fontWeight: 500,
        }}>{badge}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45, flex: 1 }}>{desc}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color }}>{cta} →</div>
    </button>
  );
};

/* ---------- History grid ---------- */
const HistoryGrid = ({ pulse }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
    <Heatmap values={pulse.processingHeatmap} />
    <div style={{
      padding: 18, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Current streak</div>
        <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ok)', marginTop: 4 }}>
          {pulse.currentStreak}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 4 }}>days</span>
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--line-soft)' }} />
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Longest</div>
        <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 4 }}>
          {pulse.longestStreak} days
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 'auto' }}>
        A streak is any day you process &gt; 0 inbox items.
      </div>
    </div>
  </div>
);

const Heatmap = ({ values }) => {
  // 84 cells = 12 weeks × 7 days. Render as columns (weeks).
  const weeks = 12;
  const cellSize = 14, gap = 3;
  const max = Math.max(...values, 1);
  const colorAt = (v) => {
    if (v === 0) return 'var(--surface-3)';
    const p = v / max;
    return `color-mix(in oklch, var(--ok) ${Math.round(20 + p * 70)}%, var(--surface-3))`;
  };
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div style={{
      padding: 18, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Processing · last 12 weeks
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
          less
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
            <span key={i} style={{
              width: 10, height: 10, borderRadius: 2,
              background: p === 0 ? 'var(--surface-3)' : `color-mix(in oklch, var(--ok) ${Math.round(20 + p * 70)}%, var(--surface-3))`,
            }} />
          ))}
          more
        </div>
      </div>
      <div style={{ display: 'flex', gap }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 6 }}>
          {dayLabels.map((d, i) => (
            <div key={i} style={{ height: cellSize, fontSize: 9, color: 'var(--text-4)', lineHeight: `${cellSize}px` }}>
              {i % 2 === 1 ? d : ''}
            </div>
          ))}
        </div>
        {/* Columns = weeks */}
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} style={{ display: 'flex', flexDirection: 'column', gap }}>
            {Array.from({ length: 7 }).map((_, d) => {
              const idx = w * 7 + d;
              const v = values[idx] ?? 0;
              return (
                <div key={d} title={`${v} processed`} style={{
                  width: cellSize, height: cellSize, borderRadius: 2,
                  background: colorAt(v),
                }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- Generic modal shell for flows ---------- */
const FlowModal = ({ title, kicker, tone, onClose, children, footer }) => (
  <div onClick={onClose} style={{
    position: 'absolute', inset: 0, zIndex: 40,
    background: 'rgba(0,0,0,.45)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: '8vh',
  }}>
    <div onClick={(e) => e.stopPropagation()} style={{
      width: 620, maxHeight: '80vh',
      background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 14,
      boxShadow: 'var(--shadow)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '14px 20px 12px',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          {kicker && (
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: tone || 'var(--text-3)', marginBottom: 3 }}>
              {kicker}
            </div>
          )}
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
      </header>
      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
      {footer && (
        <footer style={{ padding: '10px 20px', borderTop: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
          {footer}
        </footer>
      )}
    </div>
  </div>
);

/* ---------- Weekly Review ---------- */
const REVIEW_STEPS = [
  { id: 'inbox',  title: 'Clear your inbox',      hint: 'Every item should be trashed, done, delegated, or moved to a list.', list: 'inbox' },
  { id: 'next',   title: 'Review Next Actions',   hint: 'Are these still the right next steps? Delete stale ones.', list: 'next' },
  { id: 'wait',   title: 'Review Waiting-For',    hint: 'Nudge anything older than 7 days. Remove if no longer relevant.', list: 'wait' },
  { id: 'some',   title: 'Review Someday',        hint: 'Promote things you\'re ready to act on. Delete dead weight.', list: 'some' },
  { id: 'done',   title: 'Reflect on Completed',  hint: 'Acknowledge what you shipped. Celebrate briefly.', list: 'done' },
];

const WeeklyReviewWizard = ({ pulse, onClose }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [checked, setChecked] = useState({});
  const step = REVIEW_STEPS[stepIdx];
  const done = stepIdx >= REVIEW_STEPS.length;

  return (
    <FlowModal
      kicker="Weekly Review" tone="var(--ok)"
      title={done ? 'Review complete' : step.title}
      onClose={onClose}
      footer={!done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Step {stepIdx + 1} of {REVIEW_STEPS.length}</span>
          <div style={{ flex: 1, height: 3, background: 'var(--surface-3)', borderRadius: 2, margin: '0 12px' }}>
            <div style={{ width: `${((stepIdx) / REVIEW_STEPS.length) * 100}%`, height: '100%', background: 'var(--ok)', borderRadius: 2, transition: 'width .3s' }} />
          </div>
          <button onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0} style={{
            padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
            border: '1px solid var(--line)', borderRadius: 6, opacity: stepIdx === 0 ? 0.5 : 1,
          }}>Back</button>
          <button onClick={() => setStepIdx(i => i + 1)} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            background: 'var(--ok)', color: 'var(--bg)', borderRadius: 6,
          }}>{stepIdx === REVIEW_STEPS.length - 1 ? 'Finish' : 'Next'} →</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'var(--ok)', color: 'var(--bg)', borderRadius: 6 }}>Close</button>
        </div>
      )}
    >
      {done ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 14px',
            background: 'color-mix(in oklch, var(--ok) 18%, transparent)',
            color: 'var(--ok)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="check" size={28} stroke={2.25} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Weekly review complete</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Your system is clear. See you next week.
          </p>
        </div>
      ) : (
        <div style={{ padding: '20px 22px 18px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{step.hint}</p>

          {step.list === 'inbox' && (
            <ReviewList items={pulse.inboxToProcess} empty="Inbox is already clear." />
          )}
          {step.list === 'wait' && (
            <ReviewList items={pulse.waitingFor.map(w => ({ id: w.id, title: `${w.title} · ${w.who} (${w.sinceDays}d)` }))} />
          )}
          {step.list === 'some' && (
            <ReviewList items={pulse.stale.filter(s => s.list === 'some').map(s => ({ id: s.id, title: `${s.title} · ${s.ageDays}d old` }))} />
          )}
          {step.list === 'next' && (
            <ReviewList items={pulse.stale.filter(s => s.list === 'next').map(s => ({ id: s.id, title: `${s.title} · ${s.ageDays}d old` }))} empty="All Next Actions are fresh." />
          )}
          {step.list === 'done' && (
            <div style={{
              padding: 18, background: 'var(--surface-2)', borderRadius: 10,
              textAlign: 'center', fontSize: 14,
            }}>
              You completed <b style={{ color: 'var(--ok)' }}>{pulse.processedThisWeek}</b> tasks this week.
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>Nice work.</div>
            </div>
          )}

          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 18,
            padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8,
            fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer',
          }}>
            <input type="checkbox" checked={!!checked[step.id]}
              onChange={(e) => setChecked(c => ({ ...c, [step.id]: e.target.checked }))} />
            I've reviewed this list
          </label>
        </div>
      )}
    </FlowModal>
  );
};

const ReviewList = ({ items, empty = 'Nothing here.' }) => (
  items.length === 0 ? (
    <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic' }}>{empty}</div>
  ) : (
    <div style={{
      border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden',
    }}>
      {items.map((it, i) => (
        <div key={it.id} style={{
          padding: '10px 12px', fontSize: 13, color: 'var(--text-2)',
          borderBottom: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none',
          background: 'var(--surface-2)',
        }}>• {it.title}</div>
      ))}
    </div>
  )
);

/* ---------- Process Inbox ---------- */
const ProcessInboxMode = ({ pulse, onClose }) => {
  const [items, setItems] = useState(pulse.inboxToProcess);
  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState([]);
  const current = items[idx];
  const done = idx >= items.length;

  const decide = (verb) => {
    if (!current) return;
    setDecisions(d => [...d, { id: current.id, title: current.title, verb }]);
    setIdx(i => i + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (done) { if (e.key === 'Escape') onClose(); return; }
      const k = e.key.toLowerCase();
      if      (k === 'y') decide('next');
      else if (k === 'w') decide('wait');
      else if (k === 's') decide('some');
      else if (k === 'd') decide('done');
      else if (k === 'x') decide('trash');
      else if (k === 'escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, done]);

  return (
    <FlowModal
      kicker="Process Inbox · zero mode" tone="var(--accent)"
      title={done ? 'Inbox zero' : `Item ${idx + 1} of ${items.length}`}
      onClose={onClose}
    >
      {done ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 14px',
            background: 'color-mix(in oklch, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="inbox" size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Inbox zero</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            {decisions.length} {decisions.length === 1 ? 'item' : 'items'} processed.
          </p>
          <div style={{
            marginTop: 20, padding: 12, background: 'var(--surface-2)',
            borderRadius: 10, textAlign: 'left', maxWidth: 360, margin: '20px auto 0',
          }}>
            {['next', 'wait', 'some', 'done', 'trash'].map(v => {
              const count = decisions.filter(d => d.verb === v).length;
              if (!count) return null;
              return (
                <div key={v} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', padding: '3px 0' }}>
                  <span>→ {verbLabel(v)}</span>
                  <span className="mono" style={{ color: 'var(--text-3)' }}>{count}</span>
                </div>
              );
            })}
          </div>
          <button onClick={onClose} style={{
            marginTop: 18, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
            background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
          }}>Done</button>
        </div>
      ) : (
        <div style={{ padding: '28px 24px 22px' }}>
          <div style={{
            padding: '18px 20px', background: 'var(--surface-2)',
            border: '1px solid var(--line-soft)', borderRadius: 12,
            marginBottom: 20,
          }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              {current.src === 'email' ? 'Captured from email' : 'Manual entry'}
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text)' }}>
              {current.title}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
            What is it?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <DecideBtn k="Y" label="Next"    color="var(--accent)" onClick={() => decide('next')} />
            <DecideBtn k="W" label="Waiting" color="var(--warn)"   onClick={() => decide('wait')} />
            <DecideBtn k="S" label="Someday" color="var(--violet)" onClick={() => decide('some')} />
            <DecideBtn k="D" label="Done"    color="var(--ok)"     onClick={() => decide('done')} />
            <DecideBtn k="X" label="Trash"   color="var(--text-3)" onClick={() => decide('trash')} />
          </div>

          <div style={{ marginTop: 16, height: 3, background: 'var(--surface-3)', borderRadius: 2 }}>
            <div style={{ width: `${(idx / items.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width .25s' }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-4)' }}>
            Keyboard: <Kbd>Y</Kbd><Kbd>W</Kbd><Kbd>S</Kbd><Kbd>D</Kbd><Kbd>X</Kbd> · <Kbd>Esc</Kbd> to exit
          </div>
        </div>
      )}
    </FlowModal>
  );
};

const verbLabel = (v) => ({ next: 'Next Action', wait: 'Waiting For', some: 'Someday', done: 'Done', trash: 'Trash' }[v]);

const DecideBtn = ({ k, label, color, onClick }) => (
  <button onClick={onClick} style={{
    padding: '10px 6px', borderRadius: 8,
    background: `color-mix(in oklch, ${color} 10%, var(--surface-2))`,
    border: `1px solid color-mix(in oklch, ${color} 24%, var(--line))`,
    color: 'var(--text)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  }}>
    <span style={{
      width: 22, height: 22, borderRadius: 4,
      background: color, color: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700,
    }}>{k}</span>
    <span style={{ fontSize: 11.5, fontWeight: 500 }}>{label}</span>
  </button>
);

/* ---------- Stale Sweep ---------- */
const StaleSweep = ({ pulse, onClose }) => {
  const [actions, setActions] = useState({}); // id -> 'keep'|'trash'|'some'|'sharpen'
  const items = pulse.stale;
  const handled = Object.keys(actions).length;

  return (
    <FlowModal
      kicker="Stale sweep" tone="var(--warn)"
      title={`${items.length} tasks untouched > 14 days`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{handled} of {items.length} handled</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6 }}>Close</button>
          <button disabled={handled < items.length} onClick={onClose} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            background: 'var(--warn)', color: 'var(--bg)', borderRadius: 6,
            opacity: handled < items.length ? 0.5 : 1,
          }}>Apply all</button>
        </div>
      }
    >
      <div style={{ padding: '12px 16px 18px' }}>
        {items.map(it => {
          const action = actions[it.id];
          return (
            <div key={it.id} style={{
              padding: '12px 14px', marginBottom: 8,
              background: 'var(--surface-2)', borderRadius: 10,
              border: action ? `1px solid color-mix(in oklch, ${actionColor(action)} 32%, transparent)` : '1px solid var(--line-soft)',
              opacity: action === 'trash' ? 0.5 : 1,
              transition: 'opacity .2s, border-color .2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--surface-3)', color: 'var(--text-3)', fontWeight: 500,
                }}>{listLabelShort(it.list)}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, flex: 1 }}>{it.title}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--warn)' }}>{it.ageDays}d</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <SweepBtn label="Keep"    tone="var(--text-3)" active={action==='keep'}    onClick={() => setActions(a => ({ ...a, [it.id]: 'keep' }))} />
                <SweepBtn label="→ Someday" tone="var(--violet)" active={action==='some'}    onClick={() => setActions(a => ({ ...a, [it.id]: 'some' }))} />
                <SweepBtn label="Sharpen" tone="var(--accent-ai)" active={action==='sharpen'} onClick={() => setActions(a => ({ ...a, [it.id]: 'sharpen' }))} />
                <SweepBtn label="Trash"   tone="var(--danger)" active={action==='trash'}   onClick={() => setActions(a => ({ ...a, [it.id]: 'trash' }))} />
              </div>
            </div>
          );
        })}
      </div>
    </FlowModal>
  );
};

const actionColor = (a) => ({ keep: 'var(--text-3)', some: 'var(--violet)', sharpen: 'var(--accent-ai)', trash: 'var(--danger)' }[a] || 'var(--line)');
const listLabelShort = (l) => ({ next: 'Next', wait: 'Wait', some: 'Some', inbox: 'Inbox' }[l] || l);

const SweepBtn = ({ label, tone, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
    borderRadius: 6,
    background: active ? `color-mix(in oklch, ${tone} 18%, transparent)` : 'var(--surface)',
    color: active ? tone : 'var(--text-2)',
    border: `1px solid ${active ? `color-mix(in oklch, ${tone} 32%, transparent)` : 'var(--line)'}`,
  }}>{label}</button>
);

/* ---------- Nudge Waiting-For ---------- */
const NudgeWaitingFor = ({ pulse, onClose }) => {
  const [draft, setDraft] = useState(null); // {item, text}
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState({});

  const openDraft = async (item) => {
    setDraft({ item, text: 'Drafting…' });
    setLoading(true);
    const prompt =
`Write a brief, polite nudge email following up on "${item.title}" from ${item.who}. It's been ${item.sinceDays} days. No greeting or sign-off; 2-3 short sentences. Return JSON only: {"text": "..."}`;
    const res = await window.claudeJSON(prompt);
    const text = res?.text || `Hi ${item.who.split(' ')[0]} — just circling back on ${item.title}. It's been about ${item.sinceDays} days since we last chatted. Any update you can share?`;
    setLoading(false);
    setDraft({ item, text });
  };

  const send = () => {
    if (!draft) return;
    setSent(s => ({ ...s, [draft.item.id]: true }));
    setDraft(null);
  };

  return (
    <FlowModal
      kicker="Nudge Waiting-For" tone="var(--violet)"
      title={draft ? `Nudge ${draft.item.who}` : 'People you\'re blocked on'}
      onClose={onClose}
    >
      {!draft ? (
        <div style={{ padding: '12px 16px 18px' }}>
          {pulse.waitingFor.map(w => {
            const isStale = !w.nudged || w.sinceDays > 7;
            return (
              <div key={w.id} style={{
                padding: 14, marginBottom: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-soft)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: sent[w.id] ? 0.5 : 1,
              }}>
                <Avatar name={w.who} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{w.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                    <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{w.who}</b> · {w.sinceDays}d waiting ·
                    {' '}{w.nudged ? `nudged ${w.nudged}` : 'never nudged'}
                    {isStale && <span style={{ color: 'var(--warn)', marginLeft: 6 }}>· stale</span>}
                  </div>
                </div>
                {sent[w.id] ? (
                  <span style={{ fontSize: 11, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={12} /> Sent
                  </span>
                ) : (
                  <button onClick={() => openDraft(w)} style={{
                    padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
                    background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
                    border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
                    borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name="sparkle" size={11} /> Draft nudge
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            To: <b style={{ color: 'var(--text-2)' }}>{draft.item.email}</b>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Subject: Re: {draft.item.title}
          </div>
          <textarea
            value={draft.text}
            onChange={(e) => setDraft(d => ({ ...d, text: e.target.value }))}
            style={{
              width: '100%', minHeight: 140, padding: 12,
              fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)',
              background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8,
              outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setDraft(null)} style={{
              padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
              border: '1px solid var(--line)', borderRadius: 6,
            }}>Back</button>
            <button onClick={send} disabled={loading} style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--violet)', color: 'var(--bg)', borderRadius: 6,
              opacity: loading ? 0.5 : 1,
            }}>Send nudge</button>
          </div>
        </div>
      )}
    </FlowModal>
  );
};

/* ---------- Sharpen Vague (bridge to existing ImprovementModal idea, page-scoped) ---------- */
const VAGUE_RE = /^(follow up|look at|check|think about|review|handle|deal with|figure out)\b/i;
const SharpenVague = ({ pulse, onClose }) => {
  const vagueFromPulse = pulse.stale
    .filter(s => VAGUE_RE.test(s.title) || s.title.split(/\s+/).length < 4)
    .map(s => ({ t: { id: s.id, title: s.title }, v: { why: VAGUE_RE.test(s.title) ? 'Weak verb — start with a concrete action' : 'Too short — name the outcome' } }));

  const [idx, setIdx] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState([]);
  const current = vagueFromPulse[idx];
  const done = !current;

  const fetchAI = async () => {
    if (!current) return;
    setLoading(true);
    const prompt =
`This task title is vague: "${current.t.title}". Reason: ${current.v.why}.
Rewrite it as 3 concrete action-oriented alternatives. Each must start with a strong verb, name a clear outcome, and be under 10 words.
Return JSON only: {"rewrites": ["...", "...", "..."]}`;
    const res = await window.claudeJSON(prompt);
    setLoading(false);
    const rewrites = res?.rewrites;
    setSuggestions(Array.isArray(rewrites) && rewrites.length ? rewrites.slice(0, 3) : window.fakeRewrites(current.t.title));
  };

  const apply = (newTitle) => {
    setApplied(a => [...a, { id: current.t.id, from: current.t.title, to: newTitle }]);
    setIdx(i => i + 1);
    setSuggestions([]);
  };
  const skip = () => { setIdx(i => i + 1); setSuggestions([]); };

  return (
    <FlowModal
      kicker="Sharpen vague · AI" tone="var(--accent-ai)"
      title={done ? 'All sharpened' : current.t.title}
      onClose={onClose}
      footer={!done ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{idx + 1} of {vagueFromPulse.length} · {applied.length} rewritten</span>
          <div style={{ flex: 1 }} />
          <button onClick={skip} style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6 }}>Skip →</button>
        </div>
      ) : null}
    >
      {done ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 14px',
            background: 'var(--accent-ai-soft)',
            color: 'var(--accent-ai)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="sparkle" size={26} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {applied.length} {applied.length === 1 ? 'task' : 'tasks'} sharpened
          </h3>
          <button onClick={onClose} style={{
            marginTop: 16, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
            background: 'var(--accent-ai)', color: 'var(--accent-ai-ink)', borderRadius: 7,
          }}>Done</button>
        </div>
      ) : (
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--warn)', marginBottom: 14 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--warn)' }} />
            {current.v.why}
          </div>
          {suggestions.length === 0 ? (
            <button onClick={fetchAI} disabled={loading} style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
              border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
              borderRadius: 10, fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Icon name="sparkle" size={13} style={loading ? { animation: 'spin 0.9s linear infinite' } : null} />
              {loading ? 'Thinking…' : 'Get AI rewrites'}
            </button>
          ) : (
            <SuggestionChips options={suggestions} onPick={apply} label="Pick a rewrite" />
          )}
        </div>
      )}
    </FlowModal>
  );
};

/* ---------- Shared: section kicker ---------- */
const SectionKicker = ({ kicker, title }) => (
  <div style={{ marginBottom: 16 }}>
    <div className="mono" style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>{kicker}</div>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h2>
  </div>
);

window.PulseView = PulseView;
