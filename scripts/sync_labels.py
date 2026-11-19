#!/usr/bin/env python3
"""Card #240: copy the owner's labels from the Langfuse annotation queue into the
dataset items' expected output, so they outlive the 30-day trace cleanup.

    python3 /Volume1/docker/email-command-center/scripts/sync_labels.py [--dry-run]

Runs on the NAS host. Langfuse v4 (events-only) has no API to read scores, so
they are read from ClickHouse (docker exec langfuse-clickhouse). Safe to re-run:
dataset items are upserted by id. Also writes a local copy to
/Volume1/docker/.cache/ecc-eval/labels.json (personal data, local only).
"""
import base64, hashlib, json, subprocess, sys, urllib.request
from pathlib import Path

DOCKER = '/Volume1/@apps/DockerEngine/dockerd/bin/docker'
DATASET = 'ecc-importance-labels'
SCORES = ['ecc.reply_or_decision', 'ecc.mandatory_appointment', 'ecc.payment_due', 'ecc.important', 'ecc.want_to_know']
LOCAL_COPY = Path('/Volume1/docker/.cache/ecc-eval/labels.json')


def env(path):
    return dict(l.split('=', 1) for l in Path(path).read_text().splitlines() if '=' in l and not l.startswith('#'))


lit = env('/Volume1/docker/litellm/.env')
ch_pw = env('/Volume1/docker/langfuse/.env')['CLICKHOUSE_PASSWORD']
AUTH = 'Basic ' + base64.b64encode(f"{lit['LANGFUSE_PUBLIC_KEY']}:{lit['LANGFUSE_SECRET_KEY']}".encode()).decode()
BASE = 'http://127.0.0.1:8121'


def lf(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': AUTH, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read()
        return json.loads(t) if t else None


def trace_id(email_id):  # same as build-label-set.js
    return hashlib.md5(f'ecc-label:{email_id}'.encode()).hexdigest()


def main():
    dry = '--dry-run' in sys.argv
    names = ','.join(f"'{n}'" for n in SCORES)
    # Latest non-deleted annotation per (trace, score name).
    sql = f"""SELECT trace_id, name, argMax(value, event_ts), argMax(comment, event_ts), max(timestamp)
              FROM scores WHERE project_id = 'litellm' AND name IN ({names}) AND source = 'ANNOTATION' AND is_deleted = 0
              GROUP BY trace_id, name FORMAT JSONCompact"""
    out = subprocess.run([DOCKER, 'exec', 'langfuse-clickhouse', 'clickhouse-client', '--user', 'clickhouse',
                          '--password', ch_pw, '-q', sql], check=True, capture_output=True, text=True).stdout
    labels = {}
    for tid, name, value, comment, ts in json.loads(out)['data']:
        d = labels.setdefault(tid, {})
        d[name.removeprefix('ecc.')] = bool(value)
        if comment:
            d.setdefault('comments', {})[name.removeprefix('ecc.')] = comment
        d['labelled_at'] = max(d.get('labelled_at', ''), ts)

    items, page = [], 1
    while True:
        r = lf('GET', f'/api/public/dataset-items?datasetName={DATASET}&limit=100&page={page}')
        items += r['data']
        if page >= r['meta']['totalPages']:
            break
        page += 1

    done = partial = 0
    copy = []
    for it in items:
        lab = labels.get(trace_id(it['id']))
        if not lab:
            continue
        complete = all(n.removeprefix('ecc.') in lab for n in SCORES)
        done += complete
        partial += not complete
        copy.append({'email_id': it['id'], 'stratum': (it.get('metadata') or {}).get('stratum'), **lab})
        if not dry:
            lf('POST', '/api/public/dataset-items', {
                'datasetName': DATASET, 'id': it['id'], 'input': it['input'], 'metadata': it.get('metadata'),
                'sourceTraceId': it.get('sourceTraceId'), 'expectedOutput': {**lab, 'complete': complete}})
    if not dry:
        LOCAL_COPY.write_text(json.dumps(copy, indent=1, ensure_ascii=False))
    print(f"{len(items)} dataset items: {done} fully labelled, {partial} partly, {len(items) - done - partial} not yet"
          + (' (dry run, nothing written)' if dry else f'; local copy {LOCAL_COPY}'))


if __name__ == '__main__':
    main()
