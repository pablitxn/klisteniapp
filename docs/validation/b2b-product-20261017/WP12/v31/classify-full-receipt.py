import collections, json, re, sys
from pathlib import Path

e = Path('/workspace/wp12-runtime-v7/evidence')
version = sys.argv[1]
assert re.fullmatch(r'v\d+', version)
out = e / 'local-receipts' / version
assert out.exists() and not (out / 'manifest.json').exists()
runs = json.loads((out / 'runs.json').read_text())
rows = []
for run in runs:
    n = int(run['run'].rsplit('-r', 1)[1])
    for cell in run['cells']:
        if cell['status'] == 'passed':
            continue
        text = '\n'.join(str(error.get('message', '')) + '\n' + str(error.get('stack', ''))
                         if isinstance(error, dict) else str(error) for error in cell['errors'])
        text = re.sub(r'\x1b\[[0-9;]*m', '', text)
        scenario, project = cell['id'], cell['project']
        kind, certainty, owner = 'unclassified', 'Manual review required', 'Parent orchestration'
        if 'Real composed UI password admission' in text and re.search(r'Received[^0-9]*429', text):
            kind, certainty, owner = 'password-admission-429', 'Observed request status; case cannot establish downstream feature behavior', 'WP12 pacing proposal'
        elif 'Organización' in text and '5000ms' in text:
            kind, certainty, owner = 'positive-workspace-readiness-deadline', 'Observed positive login selector deadline', 'WP12 bounded readiness'
        elif 'Mi salud y privacidad' in text and '5000ms' in text:
            kind, certainty, owner = 'positive-health-heading-deadline', 'Observed positive health heading deadline', 'WP12 bounded readiness'
        elif 'Revisión de tus datos:' in text:
            kind, certainty, owner = 'positive-import-revision-acknowledgment-deadline', 'Original render root cause unresolved; separate complete-case deadline diagnostic passed', 'WP12 prospective acknowledgment patch'
        elif 'Tu membresía está inactiva' in text and '5000ms' in text:
            kind, certainty, owner = 'positive-inactive-bootstrap-deadline', 'Observed bootstrap loading snapshot; actual access response followed deadline', 'WP12 prospective inactive heading patch'
        elif 'Esta página no existe' in text and scenario == 'B2BP-INACTIVE-003' and n == 35:
            kind, certainty, owner = 'public-unknown-route-recovery-defect', 'Observed retry-only page; confirmed all six White Label contexts; no private disclosure in inspected snapshots', 'Accepted application223 fix; separate R41/R42 regressions'
        elif scenario in ('B2BP-PROGRAMMING-004', 'B2BP-PROGRAMMING-008') and project == 'product-webkit-320':
            kind, certainty, owner = 'planning-viewport-overflow', 'Original and fresh R39/R40 viewport failures; semantics reached before unchanged geometry assertion', 'WP07 application layout fix'
        elif scenario == 'B2BP-PROGRAMMING-007' and project == 'product-webkit-320':
            kind, certainty, owner = 'positive-original-history-readiness-deadline', 'Original selector deadline; complete R39/R40 cases passed prospectively', 'WP12 bounded readiness'
        elif scenario == 'B2BP-HEALTH-010':
            kind, certainty, owner = 'awaited-revoke-response-canceled-after-commit', 'Verified original committed revocation/native private state; prospective full R37 and R41/R42 cases use actual state', 'WP12 guarded response observation correction'
        elif scenario == 'B2BP-SYNC-002' and n == 34 and project == 'product-chromium-320':
            kind, certainty, owner = 'qa-request-forwarding-socket-error', 'Original route.fetch forwarding socket failure; separate native held-request R36 case passed', 'WP12 native request hold correction'
        rows.append({'run': run['run'], 'mode': run['mode'], 'id': scenario, 'project': project,
                     'originalStatus': cell['status'], 'failureClass': kind, 'basis': certainty,
                     'followupOwnerOrEvidence': owner, 'originalOutcomePreserved': True})
report = {'qualification': 'Interpretation of preserved original failures, not replacement statuses. Later passing regressions never turn an original failed cell green. No private-data defect is inferred solely from a positive readiness timeout or an admission guard rejection.',
          'classCounts': dict(collections.Counter(r['failureClass'] for r in rows)),
          'unclassifiedCount': sum(r['failureClass'] == 'unclassified' for r in rows), 'cells': rows}
(out / 'original-failure-analysis.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'localReceipt': str(out), 'classCounts': report['classCounts'], 'unclassifiedCount': report['unclassifiedCount']}))
