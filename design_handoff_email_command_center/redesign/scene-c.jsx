/* SCENE C — GTD Tasks (Vikunja)
   Kanban board, standalone. 5 columns: Inbox · Next Action · Waiting For · Someday · Completed
   Three variations (V1/V2/V3) toggle column layout, card style, and density/color treatment.
   Drag & drop between columns. Completed auto-archives after 7d (only recent shown). */

/* ---------- SEED DATA ---------- */
const TASK_CONTEXTS = [
  { id: 'home',   label: '@home',   color: 'oklch(0.72 0.13 155)' },
  { id: 'work',   label: '@work',   color: 'oklch(0.72 0.14 250)' },
  { id: 'calls',  label: '@calls',  color: 'oklch(0.78 0.14 75)'  },
  { id: 'errand', label: '@errand', color: 'oklch(0.72 0.14 300)' },
  { id: 'read',   label: '@read',   color: 'oklch(0.68 0.08 80)'  },
];

const TASK_SEED = [
  // Inbox
  { id: 't1',  col: 'inbox',  title: 'Figure out Q3 OKR template',               notes: 'Marcus mentioned a new format in the leadership offsite. Find it and decide if we adopt.' },
  { id: 't2',  col: 'inbox',  title: 'Dentist — overdue 6 months',                notes: '' },
  { id: 't3',  col: 'inbox',  title: 'Research standing desk mats',               notes: 'The rubber one is splitting.' },
  { id: 't4',  col: 'inbox',  title: 'Review AWS bill anomaly',                   notes: '$340 spike in us-west-2 last week. EC2 or data transfer?' },

  // Next Action
  { id: 't5',  col: 'next',   title: 'Counter Orbital SLA clause',                notes: 'Priya sent redline. Push back on 99.5% uptime — legal wants 99.9%.', due: '2026-04-22', ctx: 'work' },
  { id: 't6',  col: 'next',   title: 'Call insurance about the claim',            notes: 'Reference #4402-11. They said call Thursday.',                      due: '2026-04-23', ctx: 'calls' },
  { id: 't7',  col: 'next',   title: 'Draft intro for Dana → Jordan',             notes: 'Two sentences max. Jordan prefers short.',                          due: '2026-04-21', ctx: 'work' },
  { id: 't8',  col: 'next',   title: 'Pick up dry cleaning',                      notes: '',                                                                    due: '2026-04-20', ctx: 'errand' },
  { id: 't9',  col: 'next',   title: 'Review PR #2481 (billing refactor)',        notes: 'Rin blocked on this.',                                               due: '2026-04-21', ctx: 'work' },

  // Waiting For
  { id: 't10', col: 'wait',   title: 'Priya — redline v3',                        notes: 'Sent Mon. She promised EOW.',   due: '2026-04-24', ctx: 'work' },
  { id: 't11', col: 'wait',   title: 'Apartment deposit refund',                  notes: 'Landlord said 30 days. Day 12.', due: '2026-05-08', ctx: 'home' },
  { id: 't12', col: 'wait',   title: 'Recruiter — loop feedback on Sam',          notes: '',                              due: '2026-04-22', ctx: 'work' },

  // Someday (parking lot — more cards, smaller)
  { id: 't13', col: 'some',   title: 'Learn Rust' },
  { id: 't14', col: 'some',   title: 'Japan trip — 2 weeks, Nov?' },
  { id: 't15', col: 'some',   title: 'Read: Seeing Like a State' },
  { id: 't16', col: 'some',   title: 'Side project: focus timer that shames you' },
  { id: 't17', col: 'some',   title: 'Refinance mortgage if rates drop' },
  { id: 't18', col: 'some',   title: 'Pottery class — Thursdays?' },
  { id: 't19', col: 'some',   title: 'Find a better coffee grinder' },
  { id: 't20', col: 'some',   title: 'Try neovim again' },
  { id: 't21', col: 'some',   title: 'Sort photos 2019-2021' },

  // Completed (recent 7d only)
  { id: 't22', col: 'done',   title: 'Ship v4.2 release notes',                   notes: '', completedAt: '2026-04-19', ctx: 'work' },
  { id: 't23', col: 'done',   title: 'Renew passport',                            notes: '', completedAt: '2026-04-18', ctx: 'errand' },
  { id: 't24', col: 'done',   title: 'Call mom',                                  notes: '', completedAt: '2026-04-17', ctx: 'calls' },
  { id: 't25', col: 'done',   title: 'Submit expense report Q1',                  notes: '', completedAt: '2026-04-15', ctx: 'work' },
];

const TASK_COLUMNS = [
  { id: 'inbox', label: 'Inbox',       kicker: 'capture',   hint: 'Process me'       },
  { id: 'next',  label: 'Next Action', kicker: 'do',        hint: 'Concrete · doable' },
  { id: 'wait',  label: 'Waiting For', kicker: 'track',     hint: 'Blocked on others' },
  { id: 'some',  label: 'Someday',     kicker: 'parking',   hint: 'Maybe · not now'   },
  { id: 'done',  label: 'Completed',   kicker: 'archive',   hint: 'Last 7 days'       },
];

/* ---------- MAIN ---------- */
/* ---------- VAGUENESS HEURISTIC (ported from GAP) ---------- */
const WEAK_VERBS = /^(follow up|look at|look into|check|check on|think about|review|handle|deal with|figure out|research|explore)\b/i;
const isVague = (task) => {
  if (!task || !task.title) return null;
  if (task.col === 'done' || task.col === 'some') return null;
  const t = task.title.trim();
  const words = t.split(/\s+/);
  if (words.length < 3) return { why: 'Too short — name the outcome' };
  if (WEAK_VERBS.test(t)) return { why: 'Weak verb — start with a concrete action' };
  if (!/^(draft|send|call|email|write|ship|read|book|schedule|pay|buy|fix|review|reply|pick|counter|sign|submit|file|cancel|renew|decide|choose|block|prepare|update|delete|upload|download|test|deploy|merge|close|open|post|publish|record|watch|finish|create|build|plan|meet|ask|confirm|order|request)\b/i.test(t) &&
      words.length < 6) {
    return { why: 'Missing a verb — what\'s the action?' };
  }
  return null;
};

const SceneC = () => {
  const [variant, setVariant] = useState('v1'); // v1 = 5-col kanban, v2 = 4-col + overflow tray, v3 = color-coded swim
  const [tasks, setTasks] = useState(TASK_SEED);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [selected, setSelected] = useState(null); // task id for detail
  const [showCompleted, setShowCompleted] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [improveMode, setImproveMode] = useState(false);

  const vague = useMemo(
    () => tasks.map(t => ({ t, v: isVague(t) })).filter(x => x.v),
    [tasks]
  );

  const addTask = (title) => {
    const id = 't' + (Math.floor(Math.random() * 90000) + 10000);
    setTasks(prev => [{ id, col: 'inbox', title, notes: '' }, ...prev]);
  };
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  // listen to tweak attrs for variant
  useEffect(() => {
    const sync = () => {
      const v = document.documentElement.getAttribute('data-tasksvariant');
      if (v) setVariant(v);
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tasksvariant'] });
    return () => obs.disconnect();
  }, []);

  const moveTask = (taskId, toCol) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const next = { ...t, col: toCol };
      if (toCol === 'done' && !t.completedAt) next.completedAt = '2026-04-20';
      if (toCol !== 'done' && t.completedAt) delete next.completedAt;
      return next;
    }));
  };

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch (err) {}
  };
  const onDragEnd = () => { setDragId(null); setDragOverCol(null); };
  const onDragOver = (e, colId) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(colId); };
  const onDrop = (e, colId) => { e.preventDefault(); if (dragId) moveTask(dragId, colId); onDragEnd(); };

  const tasksByCol = useMemo(() => {
    const map = {};
    TASK_COLUMNS.forEach(c => map[c.id] = []);
    tasks.forEach(t => { if (map[t.col]) map[t.col].push(t); });
    return map;
  }, [tasks]);

  const selectedTask = selected && tasks.find(t => t.id === selected);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: '72px 1fr',
      background: 'var(--bg)',
    }}>
      {/* Narrow rail, same as SceneB */}
      <aside style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 0', borderRight: '1px solid var(--line)', background: 'var(--surface)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, marginBottom: 20,
        }}>C</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RailBtnC icon="flame" label="Today" />
          <RailBtnC icon="inbox" label="Inbox" />
          <RailBtnC icon="archive" label="Archive" />
          <RailBtnC icon="check" label="Tasks" active />
          <RailBtnC icon="bookmark" label="Reading" />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <RailBtnC icon="sliders" label="Rules" />
          <RailBtnC icon="settings" label="Settings" />
          <div style={{ width: 32, height: 1, background: 'var(--line)', margin: '8px 0' }} />
          <Avatar name="Rin Takeda" size={32} />
        </div>
      </aside>

      {/* Board */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <TasksHeader
          variant={variant}
          onVariantChange={setVariant}
          total={tasks.length}
          showCompleted={showCompleted}
          setShowCompleted={setShowCompleted}
          vagueCount={vague.length}
          onFixVague={() => setImproveMode(true)}
          onNewTask={() => setShowNewModal(true)}
        />
        <TasksBoard
          variant={variant}
          tasksByCol={tasksByCol}
          columns={TASK_COLUMNS.filter(c => c.id !== 'done' || showCompleted)}
          dragId={dragId}
          dragOverCol={dragOverCol}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onSelect={setSelected}
          selected={selected}
        />

        {selectedTask && (
          <TaskDetailSheet task={selectedTask} onClose={() => setSelected(null)}
            onMove={(col) => { moveTask(selectedTask.id, col); setSelected(null); }} />
        )}

        {showNewModal && (
          <NewTaskModal
            onClose={() => setShowNewModal(false)}
            onCreate={(title) => { addTask(title); setShowNewModal(false); }}
          />
        )}

        {improveMode && vague.length > 0 && (
          <ImprovementModal
            items={vague}
            onClose={() => setImproveMode(false)}
            onApply={(id, newTitle) => updateTask(id, { title: newTitle })}
          />
        )}
      </main>
    </div>
  );
};

const RailBtnC = ({ icon, label, active }) => (
  <button title={label} style={{
    width: 40, height: 40, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'var(--surface-3)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-3)',
  }}>
    <Icon name={icon} size={17} stroke={active ? 2 : 1.75} />
  </button>
);

/* ---------- HEADER ---------- */
const TasksHeader = ({ variant, onVariantChange, total, showCompleted, setShowCompleted, vagueCount, onFixVague, onNewTask }) => (
  <header style={{
    padding: '22px 32px 18px',
    borderBottom: '1px solid var(--line)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
    flexShrink: 0,
  }}>
    <div>
      <div className="mono" style={{
        fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'var(--text-3)', marginBottom: 8,
      }}>
        Tasks · Vikunja · <span style={{ color: 'var(--ok)' }}>● connected</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em' }}>
          Getting Things Done
        </h1>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{total} open · 4 completed this week</span>
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Fix vague badge */}
      {vagueCount > 0 && (
        <button onClick={onFixVague} title="Improve vague task titles" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', fontSize: 11.5, fontWeight: 500,
          background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
          border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
          borderRadius: 999,
        }}>
          <Icon name="sparkle" size={11} />
          Fix {vagueCount} vague
        </button>
      )}

      {/* Variation selector */}
      <div style={{
        display: 'inline-flex', padding: 3, gap: 2,
        background: 'var(--surface-2)', borderRadius: 8,
        border: '1px solid var(--line-soft)',
      }}>
        {[
          { id: 'v1', label: '5-col' },
          { id: 'v2', label: '4-col + tray' },
          { id: 'v3', label: 'Swimlanes' },
        ].map(o => (
          <button key={o.id} onClick={() => onVariantChange(o.id)} style={{
            padding: '5px 10px', fontSize: 11, fontWeight: 500,
            borderRadius: 6,
            background: variant === o.id ? 'var(--surface)' : 'transparent',
            color: variant === o.id ? 'var(--text)' : 'var(--text-3)',
            boxShadow: variant === o.id ? '0 1px 2px rgba(0,0,0,.2)' : 'none',
          }}>{o.label}</button>
        ))}
      </div>

      <button onClick={() => setShowCompleted(s => !s)} title="Toggle completed column" style={{
        padding: '6px 10px', fontSize: 11.5, fontWeight: 500,
        border: '1px solid var(--line)', borderRadius: 7, color: 'var(--text-2)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="check" size={12} />
        {showCompleted ? 'Hide done' : 'Show done'}
      </button>

      <button onClick={onNewTask} style={{
        padding: '7px 12px', fontSize: 12, fontWeight: 500,
        background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="plus" size={13} />
        New task <Kbd>N</Kbd>
      </button>
    </div>
  </header>
);

/* ---------- BOARD ---------- */
const TasksBoard = (props) => {
  const { variant } = props;
  if (variant === 'v2') return <BoardOverflowTray {...props} />;
  if (variant === 'v3') return <BoardSwimlanes {...props} />;
  return <BoardKanban {...props} />;
};

/* ---------- V1 · Classic 5-col kanban · minimal rows ---------- */
const BoardKanban = ({ tasksByCol, columns, dragId, dragOverCol, onDragStart, onDragEnd, onDragOver, onDrop, onSelect }) => {
  return (
    <div className="scroll" style={{
      flex: 1, overflow: 'auto',
      padding: '20px 24px 28px',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))`,
        gap: 14,
        minHeight: '100%',
      }}>
        {columns.map(col => (
          <Column key={col.id} col={col}
            count={tasksByCol[col.id]?.length || 0}
            isDropTarget={dragOverCol === col.id}
            onDragOver={(e) => onDragOver(e, col.id)}
            onDrop={(e) => onDrop(e, col.id)}>
            {(tasksByCol[col.id] || []).map(t => (
              col.id === 'some'
                ? <ParkingCard  key={t.id} task={t} dragging={dragId === t.id}
                                 onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                                 onClick={() => onSelect(t.id)} />
                : <MinimalCard  key={t.id} task={t} col={col.id} dragging={dragId === t.id}
                                 onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                                 onClick={() => onSelect(t.id)} />
            ))}
            <AddCardStub colId={col.id} />
          </Column>
        ))}
      </div>
    </div>
  );
};

/* ---------- V2 · 4-col kanban + Inbox as overflow tray at bottom · richer cards ---------- */
const BoardOverflowTray = ({ tasksByCol, columns, dragId, dragOverCol, onDragStart, onDragEnd, onDragOver, onDrop, onSelect }) => {
  const main = columns.filter(c => c.id !== 'inbox');
  const inbox = columns.find(c => c.id === 'inbox');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top: 4 columns */}
      <div className="scroll" style={{ flex: 1, overflow: 'auto', padding: '20px 24px 20px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${main.length}, minmax(260px, 1fr))`,
          gap: 14, minHeight: '100%',
        }}>
          {main.map(col => (
            <Column key={col.id} col={col}
              count={tasksByCol[col.id]?.length || 0}
              isDropTarget={dragOverCol === col.id}
              onDragOver={(e) => onDragOver(e, col.id)}
              onDrop={(e) => onDrop(e, col.id)}>
              {(tasksByCol[col.id] || []).map(t => (
                col.id === 'some'
                  ? <ParkingCard  key={t.id} task={t} dragging={dragId === t.id}
                                   onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                                   onClick={() => onSelect(t.id)} />
                  : <RichCard    key={t.id} task={t} col={col.id} dragging={dragId === t.id}
                                   onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                                   onClick={() => onSelect(t.id)} />
              ))}
              <AddCardStub colId={col.id} />
            </Column>
          ))}
        </div>
      </div>

      {/* Bottom tray: Inbox */}
      {inbox && (
        <div
          onDragOver={(e) => onDragOver(e, 'inbox')}
          onDrop={(e) => onDrop(e, 'inbox')}
          style={{
            borderTop: '1px solid var(--line)',
            background: dragOverCol === 'inbox' ? 'var(--accent-soft)' : 'var(--surface)',
            padding: '14px 24px 16px',
            transition: 'background .14s',
            flexShrink: 0, maxHeight: 200, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
          }}>
            <Icon name="inbox" size={13} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Inbox · {tasksByCol.inbox?.length || 0}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
              Capture now, process later — drag into a column to clarify
            </span>
            <div style={{ flex: 1 }} />
            <button style={{
              fontSize: 11, color: 'var(--text-3)', padding: '4px 8px',
              border: '1px solid var(--line)', borderRadius: 6,
            }}>Process inbox →</button>
          </div>
          <div className="scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {(tasksByCol.inbox || []).map(t => (
              <TrayCard key={t.id} task={t} dragging={dragId === t.id}
                         onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                         onClick={() => onSelect(t.id)} />
            ))}
            <TrayAddStub />
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- V3 · Color swimlanes by context · denser ---------- */
const BoardSwimlanes = ({ tasksByCol, columns, dragId, dragOverCol, onDragStart, onDragEnd, onDragOver, onDrop, onSelect }) => {
  return (
    <div className="scroll" style={{
      flex: 1, overflow: 'auto',
      padding: '20px 24px 28px',
      background:
        'radial-gradient(1200px 400px at 20% 0%, color-mix(in oklch, var(--accent) 4%, transparent), transparent 60%)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
        gap: 12, minHeight: '100%',
      }}>
        {columns.map((col, idx) => (
          <ColumnSwim key={col.id} col={col} idx={idx}
            count={tasksByCol[col.id]?.length || 0}
            isDropTarget={dragOverCol === col.id}
            onDragOver={(e) => onDragOver(e, col.id)}
            onDrop={(e) => onDrop(e, col.id)}>
            {(tasksByCol[col.id] || []).map(t => (
              col.id === 'some'
                ? <ParkingCard  key={t.id} task={t} dragging={dragId === t.id}
                                 onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                                 onClick={() => onSelect(t.id)} />
                : <ColorCard   key={t.id} task={t} col={col.id} dragging={dragId === t.id}
                                 onDragStart={(e) => onDragStart(e, t.id)} onDragEnd={onDragEnd}
                                 onClick={() => onSelect(t.id)} />
            ))}
            <AddCardStub colId={col.id} />
          </ColumnSwim>
        ))}
      </div>
    </div>
  );
};

/* ---------- COLUMN VARIANTS ---------- */
const Column = ({ col, count, isDropTarget, onDragOver, onDrop, children }) => (
  <div
    onDragOver={onDragOver}
    onDrop={onDrop}
    style={{
      display: 'flex', flexDirection: 'column',
      background: isDropTarget ? 'var(--accent-soft)' : 'transparent',
      borderRadius: 12,
      padding: 2,
      transition: 'background .14s',
    }}>
    <div style={{
      padding: '6px 10px 10px', display: 'flex', alignItems: 'baseline', gap: 8,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{col.label}</span>
      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{count}</span>
      <div style={{ flex: 1 }} />
      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-4)' }}>
        {col.kicker}
      </span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
      {children}
    </div>
  </div>
);

const ColumnSwim = ({ col, idx, count, isDropTarget, onDragOver, onDrop, children }) => {
  // pick a tint per column for v3
  const tints = [
    'oklch(0.72 0.06 80)',   // inbox neutral
    'oklch(0.72 0.14 250)',  // next action accent
    'oklch(0.78 0.14 75)',   // waiting warn
    'oklch(0.72 0.14 300)',  // someday violet
    'oklch(0.72 0.13 155)',  // done ok
  ];
  const tint = tints[idx] || 'var(--text-3)';
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 10,
        background: isDropTarget
          ? `color-mix(in oklch, ${tint} 18%, transparent)`
          : `color-mix(in oklch, ${tint} 6%, transparent)`,
        border: `1px solid color-mix(in oklch, ${tint} 24%, transparent)`,
        borderRadius: 12,
        transition: 'background .14s',
      }}>
      <div style={{
        padding: '2px 4px 12px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: `1px dashed color-mix(in oklch, ${tint} 26%, transparent)`,
        marginBottom: 10,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: tint }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{col.label}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{count}</span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: tint, opacity: .75 }}>
          {col.kicker}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60 }}>
        {children}
      </div>
    </div>
  );
};

/* ---------- CARD VARIANTS ---------- */
const MinimalCard = ({ task, col, dragging, onDragStart, onDragEnd, onClick }) => {
  const ctx = TASK_CONTEXTS.find(c => c.id === task.ctx);
  const dueInfo = parseDue(task.due);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 10,
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transition: 'opacity .14s',
      }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: task.notes || task.due || ctx ? 6 : 0, lineHeight: 1.35 }}>
        {col === 'done' && <Icon name="check" size={11} style={{ color: 'var(--ok)', marginRight: 5, verticalAlign: '-1px' }} />}
        {task.title}
      </div>
      {task.notes && (
        <div style={{
          fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.45,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 6,
        }}>{task.notes}</div>
      )}
      {(ctx || task.due || task.completedAt) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {ctx && (
            <span style={{
              fontSize: 10.5, fontWeight: 500, color: ctx.color,
              fontFamily: 'JetBrains Mono, monospace',
            }}>{ctx.label}</span>
          )}
          {task.due && <DueChip info={dueInfo} />}
          {task.completedAt && (
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
              ✓ {relDate(task.completedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const RichCard = ({ task, col, dragging, onDragStart, onDragEnd, onClick }) => {
  const ctx = TASK_CONTEXTS.find(c => c.id === task.ctx);
  const dueInfo = parseDue(task.due);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        padding: 14,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
      }}>
      {/* top meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, minHeight: 16 }}>
        {ctx && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 7px', borderRadius: 999,
            fontSize: 10.5, fontWeight: 500,
            background: `color-mix(in oklch, ${ctx.color} 14%, transparent)`,
            color: ctx.color,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: ctx.color }} />
            {ctx.label}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {task.due && <DueChip info={dueInfo} />}
      </div>

      <div style={{
        fontSize: 13.5, fontWeight: 500, color: 'var(--text)', marginBottom: task.notes ? 6 : 0,
        letterSpacing: '-0.005em', lineHeight: 1.35,
      }}>
        {col === 'done' && <Icon name="check" size={12} style={{ color: 'var(--ok)', marginRight: 6, verticalAlign: '-1px' }} />}
        {task.title}
      </div>

      {task.notes && (
        <div style={{
          fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{task.notes}</div>
      )}
    </div>
  );
};

const ColorCard = ({ task, col, dragging, onDragStart, onDragEnd, onClick }) => {
  const ctx = TASK_CONTEXTS.find(c => c.id === task.ctx);
  const dueInfo = parseDue(task.due);
  const accent = ctx?.color || 'var(--text-3)';
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '3px 1fr', gap: 10,
        padding: '8px 10px 8px 0',
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 8,
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
      }}>
      <span style={{ background: accent, borderRadius: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', lineHeight: 1.35, marginBottom: (task.due || ctx) ? 4 : 0 }}>
          {col === 'done' && <Icon name="check" size={11} style={{ color: 'var(--ok)', marginRight: 5, verticalAlign: '-1px' }} />}
          {task.title}
        </div>
        {(ctx || task.due) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-3)' }}>
            {ctx && <span className="mono" style={{ color: accent }}>{ctx.label}</span>}
            {ctx && task.due && <span style={{ color: 'var(--text-4)' }}>·</span>}
            {task.due && <DueInline info={dueInfo} />}
          </div>
        )}
      </div>
    </div>
  );
};

const ParkingCard = ({ task, dragging, onDragStart, onDragEnd, onClick }) => (
  <div
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onClick}
    style={{
      padding: '6px 10px',
      background: 'var(--surface)',
      border: '1px solid var(--line-soft)',
      borderRadius: 7,
      fontSize: 12, color: 'var(--text-2)',
      cursor: 'grab',
      opacity: dragging ? 0.4 : 1,
      lineHeight: 1.4,
    }}>
    {task.title}
  </div>
);

const TrayCard = ({ task, dragging, onDragStart, onDragEnd, onClick }) => (
  <div
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onClick}
    style={{
      flexShrink: 0, maxWidth: 260,
      padding: '10px 12px',
      background: 'var(--surface-2)',
      border: '1px dashed var(--line)',
      borderRadius: 9,
      cursor: 'grab',
      opacity: dragging ? 0.4 : 1,
    }}>
    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: task.notes ? 4 : 0, lineHeight: 1.35 }}>
      {task.title}
    </div>
    {task.notes && (
      <div style={{
        fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        maxWidth: 240,
      }}>{task.notes}</div>
    )}
  </div>
);

const AddCardStub = ({ colId }) => (
  <button style={{
    padding: '8px 12px',
    background: 'transparent',
    border: '1px dashed var(--line)',
    borderRadius: 9,
    color: 'var(--text-4)',
    fontSize: 12,
    display: 'flex', alignItems: 'center', gap: 6,
    width: '100%', textAlign: 'left',
  }}>
    <Icon name="plus" size={12} />
    Add task
  </button>
);

const TrayAddStub = () => (
  <button style={{
    flexShrink: 0,
    padding: '10px 14px',
    background: 'transparent',
    border: '1px dashed var(--line)',
    borderRadius: 9,
    color: 'var(--text-4)',
    fontSize: 12,
    display: 'flex', alignItems: 'center', gap: 6,
  }}>
    <Icon name="plus" size={12} />
    Capture
  </button>
);

/* ---------- DUE CHIP ---------- */
const parseDue = (d) => {
  if (!d) return null;
  const today = new Date(2026, 3, 20);
  const dt = new Date(d + 'T00:00:00');
  const diff = Math.round((dt - today) / 86400000);
  let label, tone;
  if (diff < 0)       { label = `${-diff}d overdue`; tone = 'danger'; }
  else if (diff === 0){ label = 'Today';             tone = 'accent'; }
  else if (diff === 1){ label = 'Tomorrow';          tone = 'warn';   }
  else if (diff < 7)  { label = `in ${diff}d`;       tone = 'neutral'; }
  else                { label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); tone = 'neutral'; }
  return { label, tone };
};

const relDate = (d) => {
  const today = new Date(2026, 3, 20);
  const dt = new Date(d + 'T00:00:00');
  const diff = Math.round((today - dt) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff}d ago`;
};

const DueChip = ({ info }) => {
  if (!info) return null;
  const toneStyle = {
    danger:  { bg: 'color-mix(in oklch, var(--danger) 14%, transparent)', fg: 'var(--danger)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    warn:    { bg: 'color-mix(in oklch, var(--warn) 14%, transparent)', fg: 'var(--warn)' },
    neutral: { bg: 'var(--surface-2)', fg: 'var(--text-3)' },
  }[info.tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 500,
      background: toneStyle.bg, color: toneStyle.fg,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.01em',
    }}>
      <Icon name="clock" size={10} />
      {info.label}
    </span>
  );
};
const DueInline = ({ info }) => {
  if (!info) return null;
  const color = { danger: 'var(--danger)', accent: 'var(--accent)', warn: 'var(--warn)', neutral: 'var(--text-3)' }[info.tone];
  return <span className="mono" style={{ color }}>{info.label}</span>;
};

/* ---------- TASK DETAIL SHEET ---------- */
const TaskDetailSheet = ({ task, onClose, onMove }) => {
  const ctx = TASK_CONTEXTS.find(c => c.id === task.ctx);
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 20,
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 460, background: 'var(--surface)',
        borderLeft: '1px solid var(--line)', boxShadow: 'var(--shadow)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span className="mono" style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)',
          }}>
            {TASK_COLUMNS.find(c => c.id === task.col)?.label}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 30px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
            {task.title}
          </h2>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {ctx && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                background: `color-mix(in oklch, ${ctx.color} 14%, transparent)`, color: ctx.color,
                fontFamily: 'JetBrains Mono, monospace',
              }}>{ctx.label}</span>
            )}
            {task.due && <DueChip info={parseDue(task.due)} />}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
            Notes
          </div>
          <div style={{
            fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6,
            padding: 12, background: 'var(--surface-2)',
            border: '1px solid var(--line-soft)', borderRadius: 8,
            minHeight: 72, marginBottom: 22,
          }}>
            {task.notes || <span style={{ color: 'var(--text-4)' }}>No notes yet.</span>}
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Move to
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TASK_COLUMNS.filter(c => c.id !== task.col).map(c => (
              <button key={c.id} onClick={() => onMove(c.id)} style={{
                padding: '6px 10px', fontSize: 11.5, fontWeight: 500,
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                borderRadius: 7, color: 'var(--text-2)',
              }}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- NEW TASK MODAL (Smart Capture) ---------- */
const NewTaskModal = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickedIdx, setPickedIdx] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const fetchSuggestions = async () => {
    const t = title.trim();
    if (!t) { setSuggestions(fakeRewrites('')); return; }
    setLoading(true);
    const prompt =
`Rewrite the following task title as 3 concrete, action-oriented alternatives that each start with a strong verb and name a clear outcome. Keep each under 10 words.
Title: "${t}"
Return JSON only: {"rewrites": ["...", "...", "..."]}`;
    const res = await claudeJSON(prompt);
    setLoading(false);
    const rewrites = res?.rewrites;
    setSuggestions(Array.isArray(rewrites) && rewrites.length ? rewrites.slice(0, 3) : fakeRewrites(t));
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); fetchSuggestions(); }
    else if (e.key === 'Enter' && title.trim()) { e.preventDefault(); onCreate(title.trim()); }
  };

  const pick = (s, i) => { setTitle(s); setPickedIdx(i); setTimeout(() => inputRef.current?.focus(), 0); };

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,.38)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '14vh',
    }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onKey} style={{
        width: 520, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 14,
        boxShadow: 'var(--shadow)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px 10px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--line-soft)',
        }}>
          <Icon name="plus" size={13} style={{ color: 'var(--text-3)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            New task · Inbox
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '18px 18px 14px' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setPickedIdx(null); }}
              placeholder="What needs to happen?"
              style={{
                width: '100%', padding: '12px 42px 12px 14px',
                fontSize: 15, fontWeight: 500, letterSpacing: '-0.005em',
                background: 'var(--surface-2)', color: 'var(--text)',
                border: '1px solid var(--line)', borderRadius: 10,
                outline: 'none',
                boxShadow: pickedIdx != null ? '0 0 0 3px var(--accent-ai-soft)' : 'none',
                transition: 'box-shadow .2s',
              }}
            />
            <div style={{ position: 'absolute', right: 8, top: 7 }}>
              <SparkleButton loading={loading} onClick={fetchSuggestions} />
            </div>
          </div>

          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-4)', display: 'flex', gap: 10 }}>
            <span><Kbd>↵</Kbd> create</span>
            <span><Kbd>⌘</Kbd><Kbd>↵</Kbd> rewrite with AI</span>
            <span><Kbd>Esc</Kbd> cancel</span>
          </div>

          {suggestions.length > 0 && (
            <SuggestionChips
              options={suggestions}
              value={pickedIdx != null ? suggestions[pickedIdx] : null}
              onPick={(opt) => { const i = suggestions.indexOf(opt); pick(opt, i); }}
              onDismiss={() => setSuggestions([])}
              label="Rewrites"
            />
          )}
        </div>

        <div style={{
          padding: '12px 18px', display: 'flex', gap: 8, justifyContent: 'flex-end',
          borderTop: '1px solid var(--line-soft)', background: 'var(--surface)',
        }}>
          <button onClick={onClose} style={{
            padding: '7px 12px', fontSize: 12, color: 'var(--text-2)',
            border: '1px solid var(--line)', borderRadius: 7,
          }}>Cancel</button>
          <button onClick={() => title.trim() && onCreate(title.trim())} disabled={!title.trim()} style={{
            padding: '7px 14px', fontSize: 12, fontWeight: 500,
            background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
            opacity: title.trim() ? 1 : 0.5,
          }}>Add to Inbox</button>
        </div>
      </div>
    </div>
  );
};

/* ---------- IMPROVEMENT MODAL (Task Improvement) ---------- */
const ImprovementModal = ({ items, onClose, onApply }) => {
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState('choose'); // choose | ai | manual | done
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState('');

  const total = items.length;
  const current = items[idx];
  const reset = () => { setMode('choose'); setSuggestions([]); setManual(''); };

  const skip = () => {
    if (idx + 1 >= total) { setMode('done'); return; }
    setIdx(i => i + 1); reset();
  };

  const apply = (newTitle) => {
    if (!current) return;
    onApply(current.t.id, newTitle);
    if (idx + 1 >= total) { setMode('done'); return; }
    setIdx(i => i + 1); reset();
  };

  const fetchAI = async () => {
    if (!current) return;
    setLoading(true);
    const prompt =
`This task title is vague: "${current.t.title}". Reason: ${current.v.why}.
Rewrite it as 3 concrete action-oriented alternatives. Each must start with a strong verb, name a clear outcome, and be under 10 words.
Return JSON only: {"rewrites": ["...", "...", "..."]}`;
    const res = await claudeJSON(prompt);
    setLoading(false);
    const rewrites = res?.rewrites;
    setSuggestions(Array.isArray(rewrites) && rewrites.length ? rewrites.slice(0, 3) : fakeRewrites(current.t.title));
    setMode('ai');
  };

  if (!current && mode !== 'done') return null;
  const progress = mode === 'done' ? 100 : Math.round((idx / total) * 100);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,.42)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 540, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 14,
        boxShadow: 'var(--shadow)', overflow: 'hidden',
      }}>
        {/* Header with progress */}
        <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="sparkle" size={13} style={{ color: 'var(--accent-ai)' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-ai)' }}>
              Sharpen vague tasks
            </span>
            <div style={{ flex: 1 }} />
            {mode !== 'done' && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{idx + 1} of {total}</span>
            )}
            <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: 16, lineHeight: 1, marginLeft: 8 }}>×</button>
          </div>
          <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`, height: '100%', background: 'var(--accent-ai)',
              transition: 'width .3s ease',
            }} />
          </div>
        </div>

        {mode === 'done' ? (
          <div style={{ padding: '36px 28px 32px', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 24, margin: '0 auto 14px',
              background: 'color-mix(in oklch, var(--ok) 18%, transparent)',
              color: 'var(--ok)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="check" size={22} stroke={2.25} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
              All clear
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
              {total} {total === 1 ? 'task' : 'tasks'} sharpened. Your list is ready to execute.
            </p>
            <button onClick={onClose} style={{
              marginTop: 20, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
              background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
            }}>Done</button>
          </div>
        ) : (
          <div style={{ padding: '20px 22px 18px' }}>
            {/* Current task */}
            <div style={{
              padding: 14, background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)', borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                "{current.t.title}"
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--warn)' }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--warn)' }} />
                {current.v.why}
              </div>
            </div>

            {mode === 'choose' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={fetchAI} disabled={loading} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: 'var(--accent-ai-soft)',
                  color: 'var(--accent-ai)',
                  border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Icon name="sparkle" size={13} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Get AI suggestions</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>3 action-oriented rewrites</div>
                </button>
                <button onClick={() => setMode('manual')} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: 'var(--surface-2)', color: 'var(--text)',
                  border: '1px solid var(--line)', borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Icon name="edit" size={13} style={{ color: 'var(--text-2)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Write my own</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Rephrase it yourself</div>
                </button>
              </div>
            )}

            {mode === 'ai' && (
              <SuggestionChips
                options={suggestions}
                onPick={apply}
                label="Pick a rewrite"
              />
            )}

            {mode === 'manual' && (
              <div>
                <input
                  autoFocus
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && manual.trim() && apply(manual.trim())}
                  placeholder="Rewrite with a strong verb + clear outcome"
                  style={{
                    width: '100%', padding: '10px 12px',
                    fontSize: 14, background: 'var(--surface-2)', color: 'var(--text)',
                    border: '1px solid var(--line)', borderRadius: 8, outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button onClick={() => setMode('choose')} style={{
                    padding: '6px 10px', fontSize: 12, color: 'var(--text-2)',
                    border: '1px solid var(--line)', borderRadius: 6,
                  }}>Back</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => manual.trim() && apply(manual.trim())} disabled={!manual.trim()} style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 500,
                    background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
                    opacity: manual.trim() ? 1 : 0.5,
                  }}>Apply</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mode !== 'done' && (
          <div style={{
            padding: '10px 18px', display: 'flex', alignItems: 'center',
            borderTop: '1px solid var(--line-soft)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
              Keep your list sharp — specific tasks get done.
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={skip} style={{
              fontSize: 11.5, color: 'var(--text-3)', padding: '5px 10px',
            }}>Skip →</button>
          </div>
        )}
      </div>
    </div>
  );
};

window.SceneC = SceneC;
