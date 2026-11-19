"""Card #240: trim the labelling queue to a 70-email test set, keeping the strata's
proportions and every email already labelled. Removed emails leave the queue and their
dataset items are archived. Writes test_set.json. --dry-run prints the plan only."""
import base64, hashlib, json, random, subprocess, sys, urllib.request
from collections import Counter
from pathlib import Path
DRY = '--dry-run' in sys.argv
TARGET = {'replied_or_starred': 31, 'keyword_payment_or_appointment': 14, 'random': 25}
QUEUE = 'cmwndxgat00bkp53s5atp0v4g'
env = lambda p: dict(l.split('=', 1) for l in Path(p).read_text().splitlines() if '=' in l and not l.startswith('#'))
lit = env('/Volume1/docker/litellm/.env'); pw = env('/Volume1/docker/langfuse/.env')['CLICKHOUSE_PASSWORD']
AUTH = 'Basic ' + base64.b64encode(f"{lit['LANGFUSE_PUBLIC_KEY']}:{lit['LANGFUSE_SECRET_KEY']}".encode()).decode()
def lf(m, p, b=None):
    r = urllib.request.Request('http://127.0.0.1:8121' + p, method=m, data=json.dumps(b).encode() if b else None,
                               headers={'Authorization': AUTH, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=30) as x:
        t = x.read(); return json.loads(t) if t else None
tid = lambda i: hashlib.md5(f'ecc-label:{i}'.encode()).hexdigest()
out = subprocess.run(['/Volume1/@apps/DockerEngine/dockerd/bin/docker', 'exec', 'langfuse-clickhouse', 'clickhouse-client', '--user', 'clickhouse',
    '--password', pw, '-q', "SELECT DISTINCT trace_id FROM scores WHERE project_id='litellm' AND name LIKE 'ecc.%' AND source='ANNOTATION' AND is_deleted=0 FORMAT JSONCompact"],
    capture_output=True, text=True, check=True).stdout
labelled = {r[0] for r in json.loads(out)['data']}
s = json.load(open('label_set.json'))
rng = random.Random(241)
keep = []
for st, n in TARGET.items():
    rows = [x for x in s if x['stratum'] == st]
    done = [x for x in rows if tid(x['email_id']) in labelled]
    rest = [x for x in rows if tid(x['email_id']) not in labelled]
    rng.shuffle(rest)
    keep += done + rest[:max(0, n - len(done))]
keep_ids = {x['email_id'] for x in keep}
drop = [x for x in s if x['email_id'] not in keep_ids]
print('keep', len(keep), Counter(x['stratum'] for x in keep), 'drop', len(drop))
if DRY: sys.exit()
json.dump(keep, open('test_set.json', 'w'), indent=1)
items = []
for page in range(1, 10):
    r = lf('GET', f'/api/public/annotation-queues/{QUEUE}/items?limit=100&page={page}'); items += r['data']
    if page >= r['meta']['totalPages']: break
by_obj = {it['objectId']: it for it in items}
drop_t = {tid(x['email_id']) for x in drop}
removed = 0
for o, it in by_obj.items():
    if o in drop_t:
        lf('DELETE', f"/api/public/annotation-queues/{QUEUE}/items/{it['id']}"); removed += 1
archived = 0
ds = []
for page in range(1, 10):
    r = lf('GET', f'/api/public/dataset-items?datasetName=ecc-importance-labels&limit=100&page={page}'); ds += r['data']
    if page >= r['meta']['totalPages']: break
drop_ids = {x['email_id'] for x in drop}
for it in ds:
    if it['id'] in drop_ids and it.get('status') != 'ARCHIVED':
        lf('POST', '/api/public/dataset-items', {'datasetName': 'ecc-importance-labels', 'id': it['id'], 'input': it['input'],
           'metadata': it.get('metadata'), 'sourceTraceId': it.get('sourceTraceId'), 'status': 'ARCHIVED'}); archived += 1
print(f'queue items removed {removed} (was {len(items)}), dataset items archived {archived}')
