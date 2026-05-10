/* SCENE B — Today-first rethink
   Rethinks information architecture around "what needs attention today"
   rather than "which folder am I in". The daily digest IS the home.
   Inbox exists but is secondary. Reading is a full-width sheet. */

const SceneB = () => {
  const { EMAILS, TODAY_DIGEST, CATEGORIES, ACCOUNTS } = window.APP_DATA;
  const [mode, setMode] = useState('today'); // today | inbox | archive | reading
  const [readingId, setReadingId] = useState(null);
  const [listStyle, setListStyle] = useState(
    document.documentElement.getAttribute('data-liststyle') || 'rows'
  );

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setListStyle(document.documentElement.getAttribute('data-liststyle') || 'rows');
    });
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);

  const openEmail = (id) => { setReadingId(id); setMode('reading'); };
  const reading = readingId ? EMAILS.find(e => e.id === readingId) : null;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: '72px 1fr',
      background: 'var(--bg)',
    }}>
      {/* ---------- NARROW RAIL ---------- */}
      <aside style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 0',
        borderRight: '1px solid var(--line)',
        background: 'var(--surface)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14,
          marginBottom: 20,
        }}>C</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RailBtn icon="flame"    label="Today"    active={mode==='today'}    onClick={() => setMode('today')} />
          <RailBtn icon="inbox"    label="Inbox"    active={mode==='inbox'}    onClick={() => setMode('inbox')} badge={EMAILS.filter(e=>e.unread).length} />
          <RailBtn icon="archive"  label="Digest archive" active={mode==='archive'} onClick={() => setMode('archive')} />
          <RailBtn icon="bookmark" label="Reading"  />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RailBtn icon="sliders"  label="Rules" />
          <RailBtn icon="settings" label="Settings" />
          <div style={{ width: 32, height: 1, background: 'var(--line)', margin: '8px 0' }} />
          <Avatar name="Rin Takeda" size={32} />
        </div>
      </aside>

      {/* ---------- CONTENT ---------- */}
      <main style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {mode === 'today'    && <TodayView openEmail={openEmail} onOpenArchive={() => setMode('archive')} />}
        {mode === 'inbox'    && <InboxView openEmail={openEmail} listStyle={listStyle} />}
        {mode === 'archive'  && <ArchiveView openEmail={openEmail} />}
        {mode === 'reading'  && reading && <ReadingView email={reading} onBack={() => setMode('today')} />}
      </main>
    </div>
  );
};

const RailBtn = ({ icon, label, active, onClick, badge }) => (
  <button onClick={onClick} title={label} style={{
    position: 'relative',
    width: 40, height: 40, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'var(--surface-3)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-3)',
    transition: 'all .14s',
  }}>
    <Icon name={icon} size={17} stroke={active ? 2 : 1.75} />
    {badge > 0 && (
      <span style={{
        position: 'absolute', top: 6, right: 6,
        minWidth: 14, height: 14, padding: '0 4px',
        borderRadius: 7, background: 'var(--accent)',
        color: 'var(--accent-ink)', fontSize: 9, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}>{badge}</span>
    )}
  </button>
);

/* ---------- TODAY VIEW ---------- */
const TodayView = ({ openEmail, onOpenArchive }) => {
  const { TODAY_DIGEST, EMAILS } = window.APP_DATA;
  const d = TODAY_DIGEST;

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 56px 80px' }}>

        {/* Masthead */}
        <header style={{ marginBottom: 40 }}>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--text-3)', marginBottom: 10,
          }}>{d.date} · morning briefing</div>
          <h1 style={{
            margin: 0, fontSize: 42, fontWeight: 500, letterSpacing: '-0.035em',
            lineHeight: 1.05, maxWidth: 760,
          }}>
            <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--text-2)', fontSize: 42 }}>Good morning, Rin.</span>
            <br/>
            You have <span style={{ color: 'var(--accent)' }}>{d.remaining} items</span> that need a decision.
          </h1>

          {/* Stats row */}
          <div style={{
            marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24, paddingTop: 24, borderTop: '1px solid var(--line)',
          }}>
            <Stat k="Arrived"  v={d.arrived}   hint="since 6 am" />
            <Stat k="Auto-handled" v={d.handled} hint="filed by rules" accent="var(--ok)" />
            <Stat k="For you"  v={d.remaining} hint="needs decision" accent="var(--accent)" />
            <Stat k="Next sync" v="in 4m"     hint="every 5 min" mono />
          </div>
        </header>

        {/* Decision queue */}
        <section style={{ marginBottom: 48 }}>
          <SectionTitle kicker="01 · Decision queue" title="Waiting on you" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {d.highlights.filter(h => h.kind === 'decision').map((h, i) => (
              <DecisionCard key={i} h={h} onOpen={() => openEmail(h.emailId)} />
            ))}
          </div>
        </section>

        {/* FYI */}
        <section style={{ marginBottom: 48 }}>
          <SectionTitle kicker="02 · Quietly handled" title="FYI — no action needed" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {d.fyi.map((f, i) => (
              <div key={i} style={{
                padding: 16, background: 'var(--surface)', border: '1px solid var(--line-soft)',
                borderRadius: 12,
              }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {f.kind === 'auto' ? 'AUTOMATED' : 'LIGHT'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{f.title}</div>
                {f.count && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                    {f.count} items · <span style={{ color: 'var(--accent)' }}>review</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Peek at the rest */}
        <section>
          <SectionTitle kicker="03 · Also arrived today" title="The rest of your inbox" />
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12,
            overflow: 'hidden',
          }}>
            {EMAILS.slice(0, 4).map(e => (
              <button key={e.id} onClick={() => openEmail(e.id)} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 80px auto',
                gap: 12, alignItems: 'center', width: '100%', textAlign: 'left',
                padding: '12px 18px',
                borderBottom: '1px solid var(--line-soft)',
                background: 'transparent',
              }}>
                <Avatar name={e.from} size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.from} · <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{e.subject}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.snippet}</div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>{e.time}</span>
                <Icon name="chev-r" size={14} style={{ color: 'var(--text-4)' }} />
              </button>
            ))}
            <button style={{
              width: '100%', padding: '12px', fontSize: 12, color: 'var(--text-3)',
              background: 'transparent', textAlign: 'center',
            }}>View all {EMAILS.length} · <span className="mono">I</span></button>
          </div>
        </section>
      </div>
    </div>
  );
};

const Stat = ({ k, v, hint, accent, mono }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>{k}</div>
    <div className={mono ? 'mono' : ''} style={{
      fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em',
      color: accent || 'var(--text)', marginBottom: 4, lineHeight: 1,
    }}>{v}</div>
    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{hint}</div>
  </div>
);

const SectionTitle = ({ kicker, title }) => (
  <div style={{ marginBottom: 16 }}>
    <div className="mono" style={{
      fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
      color: 'var(--text-3)', marginBottom: 4,
    }}>{kicker}</div>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h2>
  </div>
);

const DecisionCard = ({ h, onOpen }) => {
  const email = window.APP_DATA.EMAILS.find(e => e.id === h.emailId);
  return (
    <div style={{
      padding: 20, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 14,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="sparkle" size={12} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, letterSpacing: '0.03em' }}>DECISION</span>
          {email && (
            <>
              <span style={{ color: 'var(--text-4)', fontSize: 11 }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>from {email.from}</span>
            </>
          )}
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{h.title}</h3>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)', maxWidth: 620 }}>{h.body}</p>

        {email?.actions && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {email.actions.slice(0, 3).map((a, i) => (
              <button key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                background: i === 0 ? 'var(--accent)' : 'var(--surface-2)',
                color: i === 0 ? 'var(--accent-ink)' : 'var(--text-2)',
                border: i === 0 ? 'none' : '1px solid var(--line)',
              }}>
                <Icon name={a.icon} size={12} />
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onOpen} style={{
        padding: 8, borderRadius: 8, color: 'var(--text-3)',
        border: '1px solid var(--line)',
      }} title="Open email">
        <Icon name="arrow-r" size={14} />
      </button>
    </div>
  );
};

/* ---------- INBOX VIEW ---------- */
const InboxView = ({ openEmail, listStyle }) => {
  const { EMAILS, CATEGORIES } = window.APP_DATA;
  const [cat, setCat] = useState('all');
  const list = cat === 'all' ? EMAILS : EMAILS.filter(e => e.category === cat);

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '400px 1fr', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--line)' }}>
          <h1 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Inbox</h1>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            <FilterPill active={cat==='all'} onClick={() => setCat('all')}>All <span style={{ opacity: .5, marginLeft: 4 }}>{EMAILS.length}</span></FilterPill>
            {CATEGORIES.map(c => (
              <FilterPill key={c.id} active={cat===c.id} onClick={() => setCat(c.id)} color={c.color}>
                {c.label} <span style={{ opacity: .5, marginLeft: 4 }}>{c.count}</span>
              </FilterPill>
            ))}
          </div>
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {list.map(e => (
            <ListRow key={e.id} email={e} onClick={() => openEmail(e.id)} style={listStyle} />
          ))}
        </div>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, color: 'var(--text-3)', textAlign: 'center',
      }}>
        <Icon name="inbox" size={28} style={{ color: 'var(--text-4)', marginBottom: 14 }}/>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Select a message</div>
        <div style={{ fontSize: 12, maxWidth: 260 }}>
          Or press <Kbd>J</Kbd> <Kbd>K</Kbd> to navigate.
        </div>
      </div>
    </div>
  );
};

const FilterPill = ({ children, active, onClick, color }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
    whiteSpace: 'nowrap',
    background: active ? 'var(--text)' : 'var(--surface)',
    color: active ? 'var(--bg)' : 'var(--text-2)',
    border: active ? 'none' : '1px solid var(--line)',
  }}>
    {color && <span className="dot" style={{ background: color }} />}
    {children}
  </button>
);

/* ---------- READING VIEW ---------- */
const ReadingView = ({ email, onBack }) => {
  const cat = window.APP_DATA.CATEGORIES.find(c => c.id === email.category);
  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
      {/* Sticky action bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 2,
        padding: '12px 32px',
        borderBottom: '1px solid var(--line)',
        background: 'color-mix(in oklch, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', fontSize: 12, color: 'var(--text-2)',
          borderRadius: 6,
        }}>
          <Icon name="arrow-l" size={13} /> Back to Today
        </button>
        <div style={{ flex: 1 }} />
        <ActionBtn icon="archive" label="Archive" shortcut="E" />
        <ActionBtn icon="snooze"  label="Snooze"  shortcut="H" />
        <ActionBtn icon="tag"     label="Label"   shortcut="L" />
        <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 6px' }} />
        <button style={{
          padding: '7px 14px', fontSize: 12, fontWeight: 500,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          borderRadius: 7, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="reply" size={12} />Reply <Kbd style={{ color: 'var(--accent-ink)', opacity: .6 }}>R</Kbd>
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '44px 40px 80px' }}>
        {/* AI summary pinned at top */}
        <div style={{
          padding: 18, marginBottom: 32,
          border: '1px solid var(--line)', borderRadius: 12,
          background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="sparkle" size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>TL;DR</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>{email.summary}</p>
          {email.actions && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {email.actions.map((a, i) => (
                <button key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: i===0 ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: i===0 ? 'var(--accent)' : 'var(--text-2)',
                  border: '1px solid var(--line-soft)',
                }}>
                  <Icon name={a.icon} size={12} />
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {cat && (
            <span className="chip" style={{
              color: cat.color, background: `color-mix(in oklch, ${cat.color} 14%, transparent)`, borderColor: 'transparent',
            }}>{cat.label}</span>
          )}
        </div>
        <h1 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
          {email.subject}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Avatar name={email.from} size={36} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>
              {email.from} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>&lt;{email.fromEmail}&gt;</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{email.date} · {email.time}</div>
          </div>
        </div>

        <article style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-2)' }}>
          <p>Hi there,</p>
          <p>{email.snippet} {email.snippet}</p>
          <p>I've attached the redlined document. The two material changes worth flagging before we counter are captured in comments. Happy to jump on a call Thursday morning to align before sending back — I blocked 10:30 on your calendar as a hold.</p>
          <p>Let me know how you'd like to handle the SLA piece specifically. If 99.5% is a non-starter I can push, but I'd want your read first.</p>
          <p style={{ marginTop: 28 }}>Best,<br/>Priya</p>
        </article>
      </div>
    </div>
  );
};

const ActionBtn = ({ icon, label, shortcut }) => (
  <button title={`${label}${shortcut ? ` (${shortcut})` : ''}`} style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', borderRadius: 6,
    fontSize: 12, color: 'var(--text-2)',
  }}>
    <Icon name={icon} size={13} />
    <span>{label}</span>
  </button>
);


/* ---------- DIGEST ARCHIVE ---------- */
// Synthetic digest data keyed by YYYY-MM-DD
const DIGEST_ARCHIVE = (() => {
  const map = {};
  const base = new Date(2026, 3, 20); // April 20 (today)
  const snippets = [
    { s: 'Kickoff week. 2 contracts in motion, 1 hire moving to final round.', n: 42, r: 3, st: 'ready' },
    { s: '3 meetings booked via email. Q3 contract thread advanced. No urgent fires.', n: 38, r: 2, st: 'ready' },
    { s: 'Heavy decision day — 5 items needed input. Biggest: SLA clause from Orbital.', n: 51, r: 5, st: 'ready' },
    { s: 'Light inbox. Mostly receipts and newsletters. Cleared in 6 min.', n: 22, r: 0, st: 'ready' },
    { s: '', n: 0, r: 0, st: 'weekend' },
    { s: '', n: 0, r: 0, st: 'weekend' },
    { s: 'Legal returned the redline. Priya wants a call by Thursday. Two interview slots on Tues.', n: 47, r: 3, st: 'today' },
  ];
  for (let i = 0; i < 60; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    if (i === 0) map[key] = { ...snippets[6] };
    else if (dow === 0 || dow === 6) map[key] = { s: '', n: Math.floor(Math.random()*4), r: 0, st: 'weekend' };
    else {
      const pick = snippets[i % 4];
      map[key] = { ...pick, n: pick.n + (i * 7 % 13) - 6 };
      if (i > 20 && Math.random() < 0.15) map[key].st = 'stale'; // older, never generated
      if (i > 35) map[key].st = 'never';
    }
  }
  return map;
})();

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const monthName = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const ArchiveView = ({ openEmail }) => {
  const today = new Date(2026, 3, 20);
  const [cursor, setCursor] = useState(new Date(2026, 3, 1));
  const [selectedKey, setSelectedKey] = useState(fmtDate(today));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  for (let i = 0; i < startWeekday; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);

  const selected = DIGEST_ARCHIVE[selectedKey];
  const [sy, sm, sd] = selectedKey.split('-').map(Number);
  const selDate = new Date(sy, sm - 1, sd);

  const [regenerating, setRegenerating] = useState(false);
  const regenerate = () => {
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 1400);
  };

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.25fr 1fr', overflow: 'hidden' }}>
      {/* Calendar grid */}
      <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Digest archive
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.025em' }}>
              {monthName(cursor)}
            </h1>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setCursor(new Date(year, month - 1, 1))} style={{
                padding: 6, borderRadius: 6, border: '1px solid var(--line)', color: 'var(--text-2)',
              }}><Icon name="arrow-l" size={13} /></button>
              <button onClick={() => setCursor(new Date(year, month + 1, 1))} style={{
                padding: 6, borderRadius: 6, border: '1px solid var(--line)', color: 'var(--text-2)',
              }}><Icon name="arrow-r" size={13} /></button>
              <button onClick={() => { setCursor(new Date(2026, 3, 1)); setSelectedKey(fmtDate(today)); }} style={{
                padding: '6px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--line)', color: 'var(--text-2)', marginLeft: 4,
              }}>Today</button>
            </div>
          </div>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {/* weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="mono" style={{
                fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-4)',
                padding: '4px 8px', textAlign: 'left',
              }}>{d.toUpperCase()}</div>
            ))}
          </div>

          {/* grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = fmtDate(d);
              const rec = DIGEST_ARCHIVE[key];
              const isToday = key === fmtDate(today);
              const isFuture = d > today;
              const isSelected = key === selectedKey;
              const st = rec?.st || (isFuture ? 'future' : 'never');

              return (
                <button key={i} onClick={() => !isFuture && setSelectedKey(key)}
                  disabled={isFuture}
                  style={{
                    textAlign: 'left', padding: 10, minHeight: 82, borderRadius: 10,
                    background: isSelected ? 'var(--surface-2)' : isToday ? 'var(--accent-soft)' : 'var(--surface)',
                    border: isSelected ? '1px solid var(--accent)' :
                            isToday   ? '1px solid var(--accent)' :
                                        '1px solid var(--line-soft)',
                    opacity: isFuture ? 0.35 : 1,
                    cursor: isFuture ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'all .14s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 15, fontWeight: isToday ? 600 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text)',
                      letterSpacing: '-0.01em',
                    }}>{d.getDate()}</span>
                    {rec?.n > 0 && !isFuture && (
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{rec.n}</span>
                    )}
                  </div>
                  {/* status indicator */}
                  {!isFuture && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 3,
                        background: st === 'ready'   ? 'var(--ok)' :
                                    st === 'today'   ? 'var(--accent)' :
                                    st === 'stale'   ? 'var(--warn)' :
                                    st === 'weekend' ? 'var(--text-4)' :
                                                       'transparent',
                        border: st === 'never' ? '1px dashed var(--text-4)' : 'none',
                      }} />
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                        {st === 'ready'   ? 'Digest' :
                         st === 'today'   ? 'Live' :
                         st === 'stale'   ? 'Outdated' :
                         st === 'weekend' ? 'Quiet' :
                                            'Not run'}
                      </span>
                    </div>
                  )}
                  {rec?.r > 0 && !isFuture && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 6, height: 6, borderRadius: 3, background: 'var(--accent)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            marginTop: 20, padding: '14px 16px',
            background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 10,
            display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-3)',
          }}>
            <LegendDot c="var(--accent)" label="Today (live)" />
            <LegendDot c="var(--ok)" label="Digest ready" />
            <LegendDot c="var(--warn)" label="Outdated — rerun" />
            <LegendDot dashed label="Not generated" />
            <LegendDot c="var(--text-4)" label="Quiet day" />
          </div>
        </div>
      </div>

      {/* Right: digest detail */}
      <div className="scroll" style={{ overflowY: 'auto' }}>
        <ArchiveDetail
          date={selDate}
          record={selected}
          isToday={selectedKey === fmtDate(today)}
          regenerating={regenerating}
          onRegenerate={regenerate}
          openEmail={openEmail}
        />
      </div>
    </div>
  );
};

const LegendDot = ({ c, dashed, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{
      width: 8, height: 8, borderRadius: 4,
      background: c || 'transparent',
      border: dashed ? '1px dashed var(--text-4)' : 'none',
    }} />
    {label}
  </span>
);

const ArchiveDetail = ({ date, record, isToday, regenerating, onRegenerate, openEmail }) => {
  if (!record) return null;
  const niceDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const st = record.st;

  // Empty states
  if (st === 'weekend' && record.n === 0) {
    return (
      <EmptyDigest date={niceDate} label="Quiet day"
        body="No substantial email arrived. We don't generate digests for days with nothing to summarize."
        onGenerate={onRegenerate} regenerating={regenerating} />
    );
  }
  if (st === 'never') {
    return (
      <EmptyDigest date={niceDate} label="No digest yet"
        body={`${record.n} emails arrived this day. Generate a digest to see what happened, decisions you made, and what slipped through.`}
        onGenerate={onRegenerate} regenerating={regenerating} ctaLabel="Generate digest" />
    );
  }

  // Full digest
  const highlights = window.APP_DATA.TODAY_DIGEST.highlights;
  const fyi = window.APP_DATA.TODAY_DIGEST.fyi;

  return (
    <div style={{ padding: '32px 36px 60px', maxWidth: 640 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
          {isToday ? 'Today · live digest' : 'Archived digest'}
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{niceDate}</h2>

        <div style={{
          marginTop: 16, display: 'flex', gap: 20, paddingBottom: 16,
          borderBottom: '1px solid var(--line)',
        }}>
          <MiniStat k="Received" v={record.n} />
          <MiniStat k="Decisions" v={record.r} />
          <MiniStat k="Generated" v={st === 'today' ? 'live' : st === 'stale' ? '6d ago' : '9:02 AM'} mono />
        </div>
      </div>

      {/* Stale banner */}
      {st === 'stale' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px', marginBottom: 20,
          background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
          borderRadius: 10,
        }}>
          <Icon name="clock" size={14} style={{ color: 'var(--warn)', marginTop: 2 }} />
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            This digest was generated before 4 emails arrived later that day. Rerun to include them.
          </div>
          <button onClick={onRegenerate} style={{
            padding: '5px 10px', fontSize: 11, fontWeight: 500,
            background: 'var(--warn)', color: 'var(--bg)', borderRadius: 6,
          }}>Rerun</button>
        </div>
      )}

      {/* Summary */}
      <div style={{
        padding: 18, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="sparkle" size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Summary
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text)' }}>{record.s}</p>
      </div>

      {/* Decisions / highlights */}
      {record.r > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
            Decisions made ({record.r})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highlights.slice(0, record.r).map((h, i) => (
              <button key={i} onClick={() => openEmail?.(h.emailId)} style={{
                display: 'block', textAlign: 'left', width: '100%',
                padding: 12, borderRadius: 10,
                background: 'var(--surface)', border: '1px solid var(--line-soft)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{h.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{h.body}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* FYI roll-up */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
          Auto-handled
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fyi.map((f, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', fontSize: 12.5, color: 'var(--text-2)',
              background: 'var(--surface)', borderRadius: 8,
              border: '1px solid var(--line-soft)',
            }}>
              <span className="dot" style={{ background: 'var(--text-4)' }} />
              {f.title}
            </li>
          ))}
        </ul>
      </section>

      {/* Footer actions */}
      <div style={{
        display: 'flex', gap: 8, paddingTop: 18, borderTop: '1px solid var(--line)',
      }}>
        <button onClick={onRegenerate} disabled={regenerating} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 12px', fontSize: 12, fontWeight: 500,
          background: 'var(--surface-2)', color: 'var(--text)',
          border: '1px solid var(--line)', borderRadius: 7,
          opacity: regenerating ? .6 : 1,
        }}>
          <Icon name="refresh" size={13} style={regenerating ? { animation: 'spin 1s linear infinite' } : null} />
          {regenerating ? 'Regenerating…' : isToday ? 'Refresh now' : 'Rerun digest'}
        </button>
        <button style={{
          padding: '7px 12px', fontSize: 12, color: 'var(--text-2)',
          border: '1px solid var(--line)', borderRadius: 7,
        }}>View all {record.n} emails</button>
        <div style={{ flex: 1 }} />
        <button style={{
          padding: '7px 12px', fontSize: 12, color: 'var(--text-3)',
        }}>Export</button>
      </div>
    </div>
  );
};

const MiniStat = ({ k, v, mono }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>{k}</div>
    <div className={mono ? 'mono' : ''} style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em' }}>{v}</div>
  </div>
);

const EmptyDigest = ({ date, label, body, onGenerate, regenerating, ctaLabel }) => (
  <div style={{ padding: '32px 36px', maxWidth: 520 }}>
    <div className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
      {label}
    </div>
    <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{date}</h2>
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-2)' }}>{body}</p>
    {ctaLabel && (
      <button onClick={onGenerate} disabled={regenerating} style={{
        marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', fontSize: 12.5, fontWeight: 500,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        borderRadius: 8, opacity: regenerating ? .6 : 1,
      }}>
        <Icon name="sparkle" size={13} />
        {regenerating ? 'Generating…' : ctaLabel}
      </button>
    )}
  </div>
);

// keyframes for spin
if (!document.getElementById('spin-kf')) {
  const s = document.createElement('style');
  s.id = 'spin-kf';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(s);
}


window.SceneB = SceneB;
