#!/usr/bin/env python3
"""Card #246: how much each deterministic signal and candidate hard rule is worth.

    python3 /Volume1/docker/email-command-center/scripts/signal_report.py

Ground truth: the owner's labels (/Volume1/docker/.cache/ecc-eval/labels.json, written
by sync_labels.py). Coverage: share of all emails in the app a rule would decide.
A hard rule may decide alone only when it is never wrong on the labels AND the LLM
backtest runs agree with it on a large sample (later step).
"""
import json, sqlite3
from pathlib import Path

DB = '/Volume1/docker/email-command-center/backend/data/email-center.db'
LABELS = Path('/Volume1/docker/.cache/ecc-eval/labels.json')

c = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
sig = {eid: json.loads(s) for eid, s in c.execute('SELECT email_id, signals FROM email_signals')}
labels = {x['email_id']: x for x in json.loads(LABELS.read_text())}
L = [(sig[e], l) for e, l in labels.items() if e in sig]
ALL = list(sig.values())

bulk = lambda s: s['list_unsubscribe'] or s['precedence_bulk'] or s['esp_feedback_id'] or s['list_id']
action_kw = lambda s: s['kw_payment'] or s['kw_appointment'] or s['kw_deadline']
TRUSTED = ('insurer', 'government', 'utility', 'bank', 'school', 'work')
PERSONAL_GITHUB = ('mention', 'review_requested', 'assign', 'team_mention')


def hard_v1(s):
    """Candidate hard rule: decides 'not important' without an LLM."""
    return ((bulk(s) or s['noreply_sender']) and not action_kw(s) and not s['kw_reply_request']
            and not s['freemail_sender'] and s['domain_category'] not in TRUSTED
            and s['github_reason'] not in PERSONAL_GITHUB and not s['owner_wrote_to_sender_before']
            and not s['owner_replied_in_thread_before'])


RULES = {
    # name: (predicate, verdict it would give)
    'bulk, no action keyword, not freemail': (lambda s: bulk(s) and not action_kw(s) and not s['freemail_sender'], False),
    'noreply, no action keyword': (lambda s: s['noreply_sender'] and not action_kw(s), False),
    'bulk or noreply, no action keyword': (lambda s: (bulk(s) or s['noreply_sender']) and not action_kw(s) and not s['freemail_sender'], False),
    'bulk or noreply, no action kw, no reply request, not trusted domain': (lambda s: (bulk(s) or s['noreply_sender']) and not action_kw(s) and not s['kw_reply_request'] and not s['freemail_sender'] and s['domain_category'] not in TRUSTED, False),
    'HARD v1: above + not a GitHub review/mention + never wrote to sender': (hard_v1, False),
    'wrote to sender before, not bulk': (lambda s: s['owner_wrote_to_sender_before'] and not bulk(s), True),
    'replied in this thread before': (lambda s: s['owner_replied_in_thread_before'], True),
    'github: not mention/review/assign': (lambda s: s['github_reason'] is not None and s['github_reason'] not in ('mention', 'review_requested', 'assign', 'team_mention'), False),
    'unsubscribe text, no action keyword, not freemail': (lambda s: s['unsubscribe_text'] and not action_kw(s) and not s['freemail_sender'], False),
    'freemail person, to me, not bulk': (lambda s: s['freemail_sender'] and s['owner_in_to'] and not bulk(s), True),
    'payment keyword, no receipt, not bulk': (lambda s: s['kw_payment'] and not s['kw_receipt'] and not bulk(s), True),
}

print(f'{len(L)} labelled emails with signals ({sum(l["important"] for _, l in L)} important); {len(ALL)} emails in the app\n')
print('signal                         labelled: true  important%   all: true%')
for k in ALL[0]:
    if not isinstance(ALL[0][k], bool) and ALL[0][k] is not None:
        continue
    t = [l for s, l in L if s.get(k)]
    if not t and not any(s.get(k) for s in ALL):
        continue
    imp = sum(l['important'] for l in t)
    print(f'{k:30} {len(t):5}      {100 * imp / len(t) if t else 0:5.0f}%    {100 * sum(bool(s.get(k)) for s in ALL) / len(ALL):5.1f}%')

cats = {}
for s, l in L:
    cats.setdefault(s['domain_category'] or '-', []).append(l['important'])
print('\ndomain category: labelled n, important%  ', '  '.join(f'{k}: {len(v)}, {100*sum(v)/len(v):.0f}%' for k, v in sorted(cats.items())))

print('\ncandidate hard rule                                  verdict  labelled: fires wrong   all: fires')
for name, (pred, verdict) in RULES.items():
    fired = [l for s, l in L if pred(s)]
    wrong = [l for l in fired if l['important'] != verdict]
    cov = sum(1 for s in ALL if pred(s))
    print(f'{name:52} {"important" if verdict else "not imp.":9} {len(fired):5} {len(wrong):5}   {100 * cov / len(ALL):5.1f}%')
    for l in wrong:
        r = c.execute('SELECT sender_email, subject FROM emails WHERE id = ?', (l['email_id'],)).fetchone()
        print(f'{"":56}wrong: {r[0].split("@")[-1]} | {r[1][:60]}')
