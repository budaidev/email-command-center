#!/bin/bash
# CI Fail Action — called by the email action runner
# Receives email JSON on stdin, extracts GitHub Actions URL, runs analyzer
#
# Env vars: EMAIL_ID, EMAIL_SUBJECT, EMAIL_SENDER, EMAIL_CATEGORY
# Config via env: CI_FAIL_REPORT_DIR, GITHUB_TOKEN, ANALYZER_SCRIPT

set -euo pipefail

REPORT_DIR="${CI_FAIL_REPORT_DIR:-/home/abudai/Projects/email-command-center/backend/data/ci-fails}"
ANALYZER="${ANALYZER_SCRIPT:-/home/abudai/Projects/fineract/.claude/scripts/github-log-analyzer.py}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$REPORT_DIR"

# Read email JSON from stdin
EMAIL_JSON=$(cat)

# The email body_html may be empty (fetched lazily).
# Try to extract URL from the JSON body_html or body_text first
BUILD_URL=$(echo "$EMAIL_JSON" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
html = data.get('body_html', '') or data.get('body_text', '') or data.get('snippet', '') or ''
# Try HTML href first
m = re.search(r'https://github\.com/[^\"'\s]+/actions/runs/\d+', html)
if m:
    print(m.group(0))
    sys.exit(0)
# Try subject: extract repo and commit, construct a search
subject = data.get('subject', '')
# Pattern: [owner/repo] PR run failed: Workflow Name - Branch (commit)
m2 = re.search(r'\[([^\]]+)\].*\(([0-9a-f]{7,})\)', subject)
if m2:
    repo = m2.group(1)
    commit = m2.group(2)
    print(f'https://github.com/{repo}/actions?query=sha:{commit}')
    sys.exit(0)
print('')
" 2>/dev/null || echo "")

if [ -z "$BUILD_URL" ]; then
    echo "ERROR: Could not extract build URL from email"
    exit 1
fi

echo "BUILD_URL=$BUILD_URL"
echo "REPORT_DIR=$REPORT_DIR"

# Build token arg if available
TOKEN_ARG=""
if [ -n "${GITHUB_TOKEN:-}" ]; then
    TOKEN_ARG="-t $GITHUB_TOKEN"
fi

# Run the analyzer
python3 "$ANALYZER" \
    $TOKEN_ARG \
    -s \
    --raw-log-file "$REPORT_DIR/${TIMESTAMP}-raw.log" \
    --output-file "$REPORT_DIR/${TIMESTAMP}-analysis.txt" \
    "$BUILD_URL" 2>&1 || true

# Generate the report table from analysis
ANALYSIS_FILE="$REPORT_DIR/${TIMESTAMP}-analysis.txt"
REPORT_FILE="$REPORT_DIR/${TIMESTAMP}-ci-fail-report.md"

if [ -f "$ANALYSIS_FILE" ]; then
    python3 -c "
import re, sys

with open('$ANALYSIS_FILE', 'r') as f:
    content = f.read()

# Extract test failures
pattern = r'org\.apache\.fineract\.integrationtests\.(\w+)\.(\w+)\(\w+\.java:\d+\)'
failures = re.findall(pattern, content)

# Also look for other test failure patterns
pattern2 = r'(\w+Test)\.(\w+)\s*(?:FAILED|ERROR)'
failures2 = re.findall(pattern2, content)
failures.extend(failures2)

# Deduplicate
seen = set()
unique = []
for cls, method in failures:
    key = (cls, method)
    if key not in seen:
        seen.add(key)
        unique.append(key)

# Extract error summaries
lines = content.split('\n')
error_map = {}
for i, line in enumerate(lines):
    for cls, method in unique:
        if cls in line and method in line:
            # Look for error in nearby lines
            for j in range(max(0, i-2), min(len(lines), i+5)):
                if any(e in lines[j] for e in ['Exception', 'Error', 'assert', 'expected', 'Caused by']):
                    error_map[(cls, method)] = lines[j].strip()[:120]
                    break

report = '# CI Failure Report\n\n'
report += f'**Build URL:** $BUILD_URL\n'
report += f'**Email Subject:** ${EMAIL_SUBJECT}\n'
report += f'**Date:** $(date -Iseconds)\n\n'

if unique:
    report += '| Class Name | Method Name | Error Summary |\n'
    report += '|------------|-------------|---------------|\n'
    for cls, method in unique:
        err = error_map.get((cls, method), 'See analysis for details')
        report += f'| {cls} | {method} | {err} |\n'
else:
    report += 'No specific test failures extracted. See analysis file for details.\n'

report += f'\n**Full analysis:** {ANALYSIS_FILE}\n'

with open('$REPORT_FILE', 'w') as f:
    f.write(report)
print(report)
" 2>&1 || echo "Report generation failed — see $ANALYSIS_FILE"
else
    echo "No analysis file generated"
fi
