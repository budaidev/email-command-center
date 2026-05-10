/* Shared data — realistic demo content for the redesign */

const ACCOUNTS = [
  { id: 'a1', label: 'Work',     email: 'rin@lumenlabs.co',   color: 'oklch(0.72 0.14 250)', unread: 14 },
  { id: 'a2', label: 'Personal', email: 'rin.takeda@fastmail.com', color: 'oklch(0.72 0.14 300)', unread: 3 },
  { id: 'a3', label: 'Newsletters', email: 'rin+news@fastmail.com', color: 'oklch(0.78 0.14 75)', unread: 28 },
];

const CATEGORIES = [
  { id: 'needs-reply', label: 'Needs reply', color: 'var(--accent)', count: 5 },
  { id: 'meetings',    label: 'Meetings',    color: 'var(--violet)', count: 3 },
  { id: 'receipts',    label: 'Receipts',    color: 'var(--ok)',     count: 12 },
  { id: 'news',        label: 'Reading',     color: 'var(--warn)',   count: 28 },
];

const EMAILS = [
  {
    id: 'e1', account: 'a1', unread: true, important: true, category: 'needs-reply',
    from: 'Priya Shankar', fromEmail: 'priya@orbitalsoftware.com',
    subject: 'Re: Q3 contract — redline ready for review',
    snippet: 'Legal sent back the markup. Two changes worth flagging before we counter: the IP assignment clause now carves out pre-existing work, and the SLA…',
    time: '9:42 AM', date: 'Today',
    thread: 4,
    summary: 'Priya is returning a redlined Q3 contract. Two points need your call: revised IP assignment carve-out, and an SLA change from 99.9% to 99.5%. She asks for a response by EOD Thursday.',
    actions: [
      { label: 'Draft reply', kind: 'primary', icon: 'reply' },
      { label: 'Schedule 30m review', kind: 'ghost', icon: 'calendar' },
      { label: 'Forward to legal', kind: 'ghost', icon: 'forward' },
    ],
    extracted: [
      { k: 'Deadline', v: 'Thu Apr 24, EOD' },
      { k: 'Attachment', v: 'Q3_Agreement_v4_redline.pdf' },
      { k: 'Thread', v: '4 messages · 3 people' },
    ],
  },
  {
    id: 'e2', account: 'a1', unread: true, important: false, category: 'meetings',
    from: 'Calendly', fromEmail: 'notifications@calendly.com',
    subject: 'Marcus Delaney booked — Design review · Tue 2:00 PM',
    snippet: 'A new event has been booked on your calendar. Marcus Delaney (Head of Design, Helix) · 45 minutes · Google Meet…',
    time: '9:18 AM', date: 'Today',
    summary: 'Marcus from Helix booked a 45-min design review for Tue Apr 22 at 2:00 PM. Google Meet link attached. He added one note: "Want to walk through the onboarding flow."',
    actions: [
      { label: 'Add prep doc', kind: 'primary', icon: 'plus' },
      { label: 'Reschedule', kind: 'ghost', icon: 'calendar' },
    ],
  },
  {
    id: 'e3', account: 'a1', unread: true, important: false, category: 'needs-reply',
    from: 'Elena Park', fromEmail: 'elena@lumenlabs.co',
    subject: 'Hiring loop — can you interview Tues afternoon?',
    snippet: 'We\'ve got two strong finalists coming through for the Senior PM role. Would you be able to take the "product sense" round with both of them?',
    time: '8:57 AM', date: 'Today',
    summary: 'Elena wants you on the product-sense round for 2 Sr. PM finalists Tuesday afternoon. Slots: 1:30 and 3:15.',
    actions: [
      { label: 'Accept both', kind: 'primary', icon: 'check' },
      { label: 'Propose other time', kind: 'ghost', icon: 'calendar' },
    ],
  },
  {
    id: 'e4', account: 'a3', unread: false, important: false, category: 'news',
    from: 'Stratechery', fromEmail: 'ben@stratechery.com',
    subject: 'The Compounding of Compute',
    snippet: 'A weekly note on platform shifts. This week: how inference-time compute reshapes the economics of model providers…',
    time: '7:30 AM', date: 'Today',
    summary: '7-min read on how inference-time compute shifts model-provider economics. Key claim: margin structure is moving from training capex to runtime opex.',
    actions: [{ label: 'Save to Reading', kind: 'primary', icon: 'bookmark' }],
  },
  {
    id: 'e5', account: 'a2', unread: false, important: false, category: 'receipts',
    from: 'Brex', fromEmail: 'no-reply@brex.com',
    subject: 'Receipt · $247.10 at Blue Bottle Coffee',
    snippet: 'Charge approved on your Brex card ending 4421. Merchant: Blue Bottle Coffee, San Francisco CA…',
    time: '7:02 AM', date: 'Today',
    summary: 'Brex charge $247.10 · Blue Bottle Coffee · Apr 20. Likely needs receipt upload for team offsite expense report.',
    actions: [{ label: 'Attach receipt', kind: 'primary', icon: 'paperclip' }],
  },
  {
    id: 'e6', account: 'a1', unread: false, important: false, category: 'needs-reply',
    from: 'Jordan Wei', fromEmail: 'jordan@northfield.vc',
    subject: 'Intro: Dana (ex-Figma) — product eng, looking',
    snippet: 'Wanted to fire this one your way. Dana led the prototyping tools team at Figma for 3 years. She\'s exploring what\'s next and specifically interested…',
    time: 'Yesterday', date: 'Yesterday',
    summary: 'Jordan intros Dana (ex-Figma, led prototyping tools). Dana is exploring next steps; interested in your space.',
    actions: [
      { label: 'Reply w/ times', kind: 'primary', icon: 'reply' },
      { label: 'Snooze 2 days', kind: 'ghost', icon: 'clock' },
    ],
  },
  {
    id: 'e7', account: 'a1', unread: false, important: false, category: 'meetings',
    from: 'Notion', fromEmail: 'team@notion.so',
    subject: 'Weekly digest — 4 docs updated in Product',
    snippet: 'Here\'s what happened in your Product workspace this week. 4 docs edited, 2 new comments on your PRD…',
    time: 'Yesterday', date: 'Yesterday',
  },
  {
    id: 'e8', account: 'a2', unread: false, important: false, category: 'news',
    from: 'Kinfolk', fromEmail: 'hello@kinfolk.com',
    subject: 'Issue 52 · On Slowness',
    snippet: 'The new issue is here. Features essays on unhurried living, a profile of a Kyoto ceramicist, and our annual guide to winter travel…',
    time: 'Yesterday', date: 'Yesterday',
  },
  {
    id: 'e9', account: 'a1', unread: false, important: false, category: 'receipts',
    from: 'Vercel', fromEmail: 'billing@vercel.com',
    subject: 'Invoice #INV-2404-8821 · $420.00',
    snippet: 'Thanks for your business. This is your monthly invoice for the Pro plan, billed for April 2026…',
    time: 'Apr 18', date: 'Apr 18',
  },
  {
    id: 'e10', account: 'a1', unread: false, important: false, category: 'needs-reply',
    from: 'Sam Okoro', fromEmail: 'sam@lumenlabs.co',
    subject: 'Friday standup — anything to add?',
    snippet: 'Throwing together tomorrow\'s all-hands. Let me know if you want a 5-min slot to share the research findings…',
    time: 'Apr 18', date: 'Apr 18',
  },
];

// Today's digest — used in both variations
const TODAY_DIGEST = {
  date: 'Monday, April 20',
  arrived: 47,
  handled: 34,
  remaining: 13,
  highlights: [
    {
      title: 'Q3 contract redline from Orbital',
      body: 'Priya flagged an IP carve-out and an SLA change from 99.9 → 99.5%. She wants a call by Thursday EOD.',
      emailId: 'e1',
      kind: 'decision',
    },
    {
      title: 'Two interview slots requested Tuesday',
      body: 'Elena needs you on the product-sense round for 2 Sr. PM finalists — 1:30 and 3:15. Both would go on your calendar.',
      emailId: 'e3',
      kind: 'decision',
    },
    {
      title: 'Marcus (Helix) booked a design review',
      body: '45 min · Tue 2:00 PM. He wants to walk through your onboarding flow — worth prepping 2–3 screens.',
      emailId: 'e2',
      kind: 'fyi',
    },
  ],
  fyi: [
    { title: '12 new receipts auto-categorized', kind: 'auto', count: 12 },
    { title: '5 newsletters saved to Reading', kind: 'auto', count: 5 },
    { title: 'Jordan intro: Dana (ex-Figma)', kind: 'light', emailId: 'e6' },
  ],
};

const UPCOMING = [
  { time: '10:30', title: 'Sync with Elena',       where: 'Lumen HQ · Room 4',  kind: 'meeting' },
  { time: '13:00', title: 'Lunch · Marcus',        where: 'Tartine',            kind: 'personal' },
  { time: '14:00', title: 'Design review · Helix', where: 'Google Meet',        kind: 'meeting' },
  { time: '16:30', title: 'Blocker: draft Q3 reply', where: 'Focus time',       kind: 'focus' },
];

window.APP_DATA = { ACCOUNTS, CATEGORIES, EMAILS, TODAY_DIGEST, UPCOMING };
