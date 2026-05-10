/* SCENE A — Refined 3-pane
   Keeps current mental model but fixes: labeled nav, clearer hierarchy,
   persistent action bar, contextual AI drawer, calmer typography. */

const SceneA = () => {
  const { ACCOUNTS, CATEGORIES, EMAILS, UPCOMING } = window.APP_DATA;
  const [listStyle, setListStyle] = useState(
    document.documentElement.getAttribute('data-liststyle') || 'rows'
  );
  const [selectedId, setSelectedId] = useState('e1');
  const [activeCat, setActiveCat] = useState('all');
  const [aiOpen, setAiOpen] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);

  // watch data-liststyle
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setListStyle(document.documentElement.getAttribute('data-liststyle') || 'rows');
    });
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);

  const filtered = useMemo(() => {
    let list = EMAILS;
    if (activeCat !== 'all') list = list.filter(e => e.category === activeCat);
    return list;
  }, [activeCat]);

  const selected = EMAILS.find(e => e.id === selectedId);
  const grouped = groupByDate(filtered);
  const unreadCount = EMAILS.filter(e => e.unread).length;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${navCollapsed ? '56px' : '220px'} 380px 1fr`,
      width: '100%', height: '100%',
      background: 'var(--bg)',
      transition: 'grid-template-columns .2s ease',
    }}>
      {/* ---------- NAV RAIL ---------- */}
      <aside style={{
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--line)',
        background: 'var(--surface)',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--line-soft)', height: 56, flexShrink: 0,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-ink)', fontWeight: 700, fontSize: 13,
            letterSpacing: '-0.03em',
          }}>C</div>
          {!navCollapsed && (
            <>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Command
              </div>
              <button onClick={() => setNavCollapsed(true)} style={{ color: 'var(--text-3)', padding: 4 }}>
                <Icon name="arrow-l" size={14} />
              </button>
            </>
          )}
          {navCollapsed && (
            <button onClick={() => setNavCollapsed(false)} style={{ color: 'var(--text-3)', padding: 4 }}>
              <Icon name="arrow-r" size={14} />
            </button>
          )}
        </div>

        {/* Compose */}
        <div style={{ padding: navCollapsed ? '10px 8px' : '12px' }}>
          <button style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 10, justifyContent: navCollapsed ? 'center' : 'flex-start',
            padding: navCollapsed ? '8px' : '8px 12px',
            background: 'var(--text)', color: 'var(--bg)',
            borderRadius: 8, fontWeight: 500, fontSize: 13,
          }}>
            <Icon name="edit" size={14} stroke={2} />
            {!navCollapsed && <>Compose <span className="mono" style={{ marginLeft: 'auto', opacity: .5, fontSize: 11 }}>C</span></>}
          </button>
        </div>

        {/* Nav sections */}
        <nav className="scroll" style={{ flex: 1, overflowY: 'auto', padding: navCollapsed ? '0 8px' : '0 8px' }}>
          <NavGroup collapsed={navCollapsed} label="Views">
            <NavItem collapsed={navCollapsed} icon="inbox"  label="Inbox"    count={unreadCount} active />
            <NavItem collapsed={navCollapsed} icon="sparkle" label="Digest" />
            <NavItem collapsed={navCollapsed} icon="calendar" label="Calendar" />
            <NavItem collapsed={navCollapsed} icon="bookmark" label="Reading" count={5} />
          </NavGroup>

          {!navCollapsed && (
            <>
              <NavGroup label="Categories">
                <CatItem label="All"         id="all"        active={activeCat==='all'}      onClick={() => setActiveCat('all')} count={EMAILS.length} color="var(--text-3)" />
                {CATEGORIES.map(c => (
                  <CatItem key={c.id} id={c.id} label={c.label} color={c.color}
                    active={activeCat===c.id} onClick={() => setActiveCat(c.id)} count={c.count} />
                ))}
              </NavGroup>

              <NavGroup label="Accounts">
                {ACCOUNTS.map(a => (
                  <button key={a.id} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 6, fontSize: 13, color: 'var(--text-2)',
                    textAlign: 'left',
                  }}>
                    <span className="dot" style={{ background: a.color }} />
                    <span style={{ flex: 1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.label}</span>
                    {a.unread > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.unread}</span>
                    )}
                  </button>
                ))}
              </NavGroup>
            </>
          )}
        </nav>

        {/* Footer utilities */}
        <div style={{
          padding: navCollapsed ? '8px' : '10px 12px',
          borderTop: '1px solid var(--line-soft)',
          display: 'flex', flexDirection: navCollapsed ? 'column' : 'row',
          gap: 6, alignItems: 'center', justifyContent: navCollapsed ? 'center' : 'space-between',
        }}>
          <button style={{ color: 'var(--text-3)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Icon name="rules" size={14} />
            {!navCollapsed && 'Rules'}
          </button>
          <button style={{ color: 'var(--text-3)', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Icon name="settings" size={14} />
            {!navCollapsed && 'Settings'}
          </button>
        </div>
      </aside>

      {/* ---------- LIST PANE ---------- */}
      <section style={{
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--line)',
        background: 'var(--bg)', overflow: 'hidden',
      }}>
        <header style={{
          padding: '14px 20px 12px', borderBottom: '1px solid var(--line)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em',
            }}>
              {activeCat === 'all' ? 'Inbox' : CATEGORIES.find(c => c.id===activeCat)?.label}
              <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 14, marginLeft: 8 }}>
                {filtered.length}
              </span>
            </h1>
            <button style={{ color: 'var(--text-3)', padding: 4, display: 'flex', gap: 4 }}>
              <Icon name="refresh" size={14} />
            </button>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', background: 'var(--surface)',
            border: '1px solid var(--line-soft)', borderRadius: 8,
          }}>
            <Icon name="search" size={14} style={{ color: 'var(--text-3)' }} />
            <input placeholder="Search mail" style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 13,
            }} />
            <Kbd>⌘K</Kbd>
          </div>
        </header>

        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div style={{
                padding: '10px var(--row-px) 6px', position: 'sticky', top: 0,
                background: 'linear-gradient(to bottom, var(--bg) 70%, transparent)',
                zIndex: 1,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--text-4)',
                }}>{date}</span>
              </div>
              {items.map(e => (
                <ListRow key={e.id} email={e} selected={selectedId===e.id}
                  onClick={() => setSelectedId(e.id)} style={listStyle} />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- READING PANE ---------- */}
      <section style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
        {selected && <ReadingPane email={selected} aiOpen={aiOpen} setAiOpen={setAiOpen} />}
      </section>
    </div>
  );
};

const NavGroup = ({ label, children, collapsed }) => (
  <div style={{ marginTop: 10 }}>
    {!collapsed && (
      <div style={{
        padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-4)',
      }}>{label}</div>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>
  </div>
);

const NavItem = ({ icon, label, count, active, collapsed }) => (
  <button style={{
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: collapsed ? '8px' : '7px 10px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: 6,
    background: active ? 'var(--surface-2)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-2)',
    fontSize: 13, fontWeight: active ? 500 : 400,
    position: 'relative',
  }}>
    {active && !collapsed && (
      <span style={{
        position: 'absolute', left: -8, top: 6, bottom: 6, width: 2,
        background: 'var(--accent)', borderRadius: 2,
      }} />
    )}
    <Icon name={icon} size={15} />
    {!collapsed && <>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {count > 0 && (
        <span style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text-3)', fontWeight: 500 }}>{count}</span>
      )}
    </>}
  </button>
);

const CatItem = ({ label, color, active, onClick, count }) => (
  <button onClick={onClick} style={{
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 10px', borderRadius: 6,
    background: active ? 'var(--surface-2)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-2)',
    fontSize: 13, textAlign: 'left',
  }}>
    <span className="dot" style={{ background: color }} />
    <span style={{ flex: 1 }}>{label}</span>
    {count > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{count}</span>}
  </button>
);

/* ---------- READING PANE ---------- */
const ReadingPane = ({ email, aiOpen, setAiOpen }) => {
  const cat = window.APP_DATA.CATEGORIES.find(c => c.id === email.category);
  const [taskState, setTaskState] = useState({}); // email.id -> { status, proposal, linkedId }
  const current = taskState[email.id] || { status: 'idle' };

  const startCreate = async () => {
    setTaskState(s => ({ ...s, [email.id]: { status: 'loading' } }));
    const prompt =
`Classify this email as a GTD task. Produce an action-oriented title (strong verb, <10 words) and pick the best list.
Subject: "${email.subject}"
Summary: "${email.summary || email.snippet}"
Return JSON only: {"actionable": true|false, "list": "next"|"waiting"|"someday"|"inbox", "title": "...", "dueHint": "YYYY-MM-DD or null"}`;
    const res = await window.claudeJSON(prompt);
    const proposal = res && res.title ? {
      actionable: res.actionable !== false,
      list: ['next','waiting','someday','inbox'].includes(res.list) ? res.list : 'next',
      title: res.title,
      dueHint: res.dueHint || null,
    } : {
      actionable: true,
      list: 'next',
      title: window.fakeRewrites(email.subject)[0],
      dueHint: null,
    };
    setTaskState(s => ({ ...s, [email.id]: { status: 'proposing', proposal } }));
  };

  const confirmCreate = () => {
    const id = 'vk' + Math.floor(Math.random() * 90000);
    setTaskState(s => ({ ...s, [email.id]: { status: 'linked', linkedId: id, proposal: current.proposal } }));
  };

  const cancel = () => setTaskState(s => ({ ...s, [email.id]: { status: 'idle' } }));

  return (
    <>
      {/* Top bar w/ actions — fixes "actions hard to find" */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '10px 18px',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
      }}>
        <ActionBtn icon="archive"  label="Archive"  shortcut="E" />
        <ActionBtn icon="trash"    label="Delete"   shortcut="#" />
        <ActionBtn icon="snooze"   label="Snooze"   shortcut="H" />
        <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 6px' }} />
        <ActionBtn icon="reply"    label="Reply"    shortcut="R" />
        <ActionBtn icon="forward"  label="Forward"  shortcut="F" />
        <ActionBtn icon="tag"      label="Label"    shortcut="L" />
        {current.status === 'linked' ? (
          <button title="Open linked task" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 6, fontSize: 12,
            background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
            border: '1px solid color-mix(in oklch, var(--accent-ai) 24%, transparent)',
          }}>
            <Icon name="check" size={12} /> Linked task <Icon name="arrow-r" size={11} />
          </button>
        ) : (
          <button onClick={startCreate} disabled={current.status === 'loading'} title="Create a task from this email" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 6, fontSize: 12, color: 'var(--text-2)',
          }}>
            <Icon name="sparkle" size={13} style={{
              color: 'var(--accent-ai)',
              animation: current.status === 'loading' ? 'spin 0.9s linear infinite' : 'none',
            }} />
            {current.status === 'loading' ? 'Analyzing…' : 'Create task'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <ActionBtn icon="sparkle"  label="Summary"  active={aiOpen} onClick={() => setAiOpen(!aiOpen)} />
        <ActionBtn icon="arrow-l"  label="" />
        <ActionBtn icon="arrow-r"  label="" />
      </div>

      {/* Content */}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', display: 'grid',
        gridTemplateColumns: aiOpen ? '1fr 320px' : '1fr 0',
        transition: 'grid-template-columns .22s ease',
      }}>
        <div style={{ padding: '28px 44px', maxWidth: 820 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {cat && (
              <span className="chip" style={{
                color: cat.color, background: `color-mix(in oklch, ${cat.color} 14%, transparent)`, borderColor: 'transparent',
              }}>{cat.label}</span>
            )}
            {email.important && <span className="chip accent">Priority</span>}
          </div>
          <h1 style={{
            margin: '0 0 18px', fontSize: 24, fontWeight: 600,
            letterSpacing: '-0.02em', lineHeight: 1.2,
          }}>{email.subject}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Avatar name={email.from} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {email.from} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>&lt;{email.fromEmail}&gt;</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                to you · {email.date} at {email.time}
              </div>
            </div>
            <button style={{ color: 'var(--text-3)' }}><Icon name="star" size={16} /></button>
          </div>

          {/* Task proposal panel (between header and body) */}
          {current.status === 'proposing' && current.proposal && (
            <TaskProposal proposal={current.proposal}
              onChange={(patch) => setTaskState(s => ({
                ...s, [email.id]: { ...s[email.id], proposal: { ...s[email.id].proposal, ...patch } }
              }))}
              onCancel={cancel}
              onConfirm={confirmCreate}
            />
          )}

          {current.status === 'linked' && current.proposal && (
            <div style={{
              marginBottom: 20, padding: '12px 14px',
              background: 'color-mix(in oklch, var(--ok) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--ok) 30%, transparent)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="check" size={14} style={{ color: 'var(--ok)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Added to <b style={{ color: 'var(--text)' }}>{listLabel(current.proposal.list)}</b>:
                <span style={{ color: 'var(--text)', marginLeft: 6 }}>"{current.proposal.title}"</span>
              </span>
              <div style={{ flex: 1 }} />
              <button style={{ fontSize: 11.5, color: 'var(--ok)' }}>Open →</button>
            </div>
          )}

          <article style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--text-2)', maxWidth: 680 }}>
            <p>Hi there,</p>
            <p>{email.snippet} {email.snippet}</p>
            <p>I've attached the redlined document. The two material changes worth flagging before we counter are captured in comments. Happy to jump on a call Thursday morning to align before sending back — I blocked 10:30 on your calendar as a hold.</p>
            <p>Let me know how you'd like to handle the SLA piece specifically. If 99.5% is a non-starter I can push, but I'd want your read first.</p>
            <p style={{ marginTop: 28 }}>Best,<br/>Priya</p>
            <div style={{ marginTop: 28, padding: 16, border: '1px solid var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
              <Icon name="paperclip" size={18} style={{ color: 'var(--text-3)' }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Q3_Agreement_v4_redline.pdf</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>284 KB · PDF</div>
              </div>
              <button className="chip">Preview</button>
            </div>
          </article>

          {/* Quick reply */}
          <div style={{
            marginTop: 32, padding: 14,
            border: '1px solid var(--line)', borderRadius: 12,
            background: 'var(--surface)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
              Quick reply
            </div>
            <div style={{
              minHeight: 60, fontSize: 14, color: 'var(--text-3)', padding: '4px 0',
            }}>Write a reply, or use a suggestion…</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <SuggestChip>Align on Thursday 10:30</SuggestChip>
              <SuggestChip>Push back on SLA</SuggestChip>
              <SuggestChip>Loop in legal</SuggestChip>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Reply-all · to priya@orbitalsoftware.com, legal@lumenlabs.co</span>
              <button style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 500,
                background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
              }}>Send <Kbd>⌘↵</Kbd></button>
            </div>
          </div>
        </div>

        {/* AI drawer */}
        {aiOpen && <AIDrawer email={email} />}
      </div>
    </>
  );
};

const listLabel = (l) => ({ next: 'Next Action', waiting: 'Waiting For', someday: 'Someday', inbox: 'Inbox' }[l] || 'Inbox');

const TaskProposal = ({ proposal, onChange, onCancel, onConfirm }) => {
  const lists = [
    { id: 'next',    label: 'Next' },
    { id: 'waiting', label: 'Waiting' },
    { id: 'someday', label: 'Someday' },
    { id: 'inbox',   label: 'Inbox' },
  ];
  return (
    <div style={{
      marginBottom: 22,
      background: 'var(--accent-ai-soft)',
      border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid color-mix(in oklch, var(--accent-ai) 20%, transparent)',
      }}>
        <Icon name="sparkle" size={12} style={{ color: 'var(--accent-ai)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-ai)' }}>
          Proposed task
        </span>
        {!proposal.actionable && (
          <span style={{ fontSize: 11, color: 'var(--warn)' }}>· low confidence this is actionable</span>
        )}
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Title</label>
          <input
            value={proposal.title}
            onChange={(e) => onChange({ title: e.target.value })}
            style={{
              padding: '8px 10px', fontSize: 13.5, fontWeight: 500,
              background: 'var(--surface)', color: 'var(--text)',
              border: '1px solid var(--line)', borderRadius: 7, outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>List</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {lists.map(l => {
              const active = proposal.list === l.id;
              return (
                <button key={l.id} onClick={() => onChange({ list: l.id })} style={{
                  padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
                  background: active ? 'var(--accent-ai)' : 'var(--surface)',
                  color: active ? 'var(--accent-ai-ink)' : 'var(--text-2)',
                  border: `1px solid ${active ? 'var(--accent-ai)' : 'var(--line)'}`,
                  borderRadius: 6,
                }}>{l.label}</button>
              );
            })}
          </div>
        </div>
        {proposal.dueHint && (
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Due</label>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{proposal.dueHint}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, paddingTop: 12, borderTop: '1px solid color-mix(in oklch, var(--accent-ai) 18%, transparent)' }}>
          <button onClick={onCancel} style={{
            padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
            border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            background: 'var(--accent-ai)', color: 'var(--accent-ai-ink)', borderRadius: 6,
          }}>Create in {listLabel(proposal.list)}</button>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ icon, label, shortcut, active, onClick }) => (
  <button onClick={onClick} title={`${label}${shortcut ? ` (${shortcut})` : ''}`} style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: label ? '6px 10px' : 6,
    borderRadius: 6, fontSize: 12,
    background: active ? 'var(--surface-2)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-2)',
    transition: 'background .14s',
  }}>
    <Icon name={icon} size={14} />
    {label && <span>{label}</span>}
  </button>
);

const SuggestChip = ({ children }) => (
  <button style={{
    padding: '4px 10px', fontSize: 12,
    background: 'var(--surface-2)', color: 'var(--text-2)',
    borderRadius: 999, border: '1px solid var(--line-soft)',
  }}>{children}</button>
);

const AIDrawer = ({ email }) => (
  <aside style={{
    borderLeft: '1px solid var(--line)',
    background: 'var(--surface)',
    padding: '24px 18px',
    overflow: 'hidden',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon name="sparkle" size={14} style={{ color: 'var(--accent)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
        Summary
      </span>
    </div>
    <p style={{
      margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-2)',
    }}>{email.summary}</p>

    {email.actions && (
      <>
        <div style={{ marginTop: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Suggested actions
        </div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {email.actions.map((a, i) => (
            <button key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 11px', borderRadius: 8,
              background: a.kind === 'primary' ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: a.kind === 'primary' ? 'var(--accent)' : 'var(--text-2)',
              fontSize: 13, fontWeight: 500,
              textAlign: 'left',
            }}>
              <Icon name={a.icon} size={14} />
              <span style={{ flex: 1 }}>{a.label}</span>
              <Icon name="arrow-r" size={12} style={{ opacity: .6 }} />
            </button>
          ))}
        </div>
      </>
    )}

    {email.extracted && (
      <>
        <div style={{ marginTop: 22, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          Extracted
        </div>
        <dl style={{ margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {email.extracted.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 8, fontSize: 12 }}>
              <dt style={{ color: 'var(--text-3)' }}>{row.k}</dt>
              <dd style={{ margin: 0, color: 'var(--text)' }}>{row.v}</dd>
            </div>
          ))}
        </dl>
      </>
    )}
  </aside>
);

window.SceneA = SceneA;
