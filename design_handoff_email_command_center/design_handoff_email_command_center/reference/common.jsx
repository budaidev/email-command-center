/* Shared components used by both variations */

const { useState, useEffect, useMemo, useRef } = React;

const Avatar = ({ name, size = 28, color }) => {
  const initials = (name || '?')
    .split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
  // deterministic hue
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const bg = color || `oklch(0.42 0.06 ${h})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: size >= 34 ? 10 : 8,
      background: bg,
      color: 'white',
      fontSize: size * 0.38,
      fontWeight: 600,
      letterSpacing: '-0.02em',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{initials}</div>
  );
};

const CategoryDot = ({ cat }) => {
  const data = window.APP_DATA.CATEGORIES.find(c => c.id === cat);
  if (!data) return null;
  return <span className="dot" style={{ background: data.color }} />;
};

const Kbd = ({ children }) => <span className="kbd">{children}</span>;

const SectionHead = ({ label, hint, style }) => (
  <div style={{
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    padding: '10px var(--pane-px) 6px',
    ...style,
  }}>
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--text-3)',
    }}>{label}</span>
    {hint && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{hint}</span>}
  </div>
);

/* Email list row — default "rows" style */
const ListRow = ({ email, selected, onClick, style = 'rows' }) => {
  const cat = window.APP_DATA.CATEGORIES.find(c => c.id === email.category);
  const acc = window.APP_DATA.ACCOUNTS.find(a => a.id === email.account);

  if (style === 'cards') {
    return (
      <button onClick={onClick} style={{
        display: 'block', textAlign: 'left', width: 'calc(100% - 16px)',
        margin: '6px 8px', padding: 14,
        background: selected ? 'var(--surface-2)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--line-soft)'}`,
        borderRadius: 'var(--radius)',
        transition: 'all .14s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Avatar name={email.from} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{
                fontSize: 13, fontWeight: email.unread ? 600 : 500,
                color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{email.from}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{email.time}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{acc?.label}</div>
          </div>
        </div>
        <div style={{
          fontSize: 13, fontWeight: email.unread ? 600 : 500,
          color: email.unread ? 'var(--text)' : 'var(--text-2)',
          marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{email.subject}</div>
        <div style={{
          fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{email.snippet}</div>
        {cat && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <span className="chip" style={{ color: cat.color, background: `color-mix(in oklch, ${cat.color} 14%, transparent)`, borderColor: 'transparent' }}>
              {cat.label}
            </span>
            {email.important && <span className="chip accent">Priority</span>}
          </div>
        )}
      </button>
    );
  }

  if (style === 'threaded') {
    return (
      <button onClick={onClick} style={{
        display: 'grid', gridTemplateColumns: '4px 28px 1fr auto',
        gap: 10, alignItems: 'start',
        textAlign: 'left', width: '100%',
        padding: 'var(--row-py) var(--row-px)',
        background: selected ? 'var(--surface-2)' : 'transparent',
        borderBottom: '1px solid var(--line-soft)',
        transition: 'background .14s',
        position: 'relative',
      }}>
        <div style={{
          width: 3, borderRadius: 2, alignSelf: 'stretch',
          background: selected ? 'var(--accent)' : email.unread ? cat?.color || 'var(--accent)' : 'transparent',
        }} />
        <Avatar name={email.from} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 13, fontWeight: email.unread ? 600 : 500, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{email.from}</span>
            {email.thread && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {email.thread}</span>
            )}
          </div>
          <div style={{
            fontSize: 12.5, fontWeight: email.unread ? 500 : 400,
            color: email.unread ? 'var(--text)' : 'var(--text-2)',
            marginBottom: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{email.subject}</div>
          <div style={{
            fontSize: 12, color: 'var(--text-3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{email.snippet}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{email.time}</span>
          {cat && <span className="dot" style={{ background: cat.color }} />}
        </div>
      </button>
    );
  }

  // default "rows"
  return (
    <button onClick={onClick} style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr auto',
      gap: 12, alignItems: 'center',
      textAlign: 'left', width: '100%',
      padding: 'var(--row-py) var(--row-px)',
      background: selected ? 'var(--surface-2)' : 'transparent',
      borderLeft: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
      borderBottom: '1px solid var(--line-soft)',
      transition: 'background .14s, border-color .14s',
    }}>
      <Avatar name={email.from} size={28} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize: 13, fontWeight: email.unread ? 600 : 500,
            color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%',
          }}>{email.from}</span>
          {email.unread && <span className="dot" style={{ background: 'var(--accent)' }} />}
          {cat && <span style={{ fontSize: 11, color: cat.color, fontWeight: 500 }}>{cat.label}</span>}
        </div>
        <div style={{
          fontSize: 13, fontWeight: email.unread ? 500 : 400,
          color: email.unread ? 'var(--text)' : 'var(--text-2)',
          marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{email.subject}</div>
        <div style={{
          fontSize: 12, color: 'var(--text-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{email.snippet}</div>
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'start', paddingTop: 2 }}>{email.time}</span>
    </button>
  );
};

/* Group by date helper */
const groupByDate = (emails) => {
  const map = new Map();
  emails.forEach(e => {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  });
  return Array.from(map.entries());
};

Object.assign(window, { Avatar, CategoryDot, Kbd, SectionHead, ListRow, groupByDate });
