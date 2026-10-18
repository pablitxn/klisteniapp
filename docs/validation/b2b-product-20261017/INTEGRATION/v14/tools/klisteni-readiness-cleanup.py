from pathlib import Path
import datetime, json, subprocess

ROOT = Path('/tmp/klisteni-readiness-runtime')
terminal = json.loads((ROOT / 'evidence/terminal-summary.json').read_text())
assert terminal['status'] == 'complete' and len(terminal['runs']) == 8
assert all(run['counts'] == {'passed': run['attempted']} and run['exitCode'] == 0 for run in terminal['runs'])
task_containers = ['klisteni-readiness-pg-v1', 'klisteni-readiness-browser-v1']
network = 'klisteni-readiness-network-v1'

def command(args):
    return subprocess.check_output(args, text=True).strip()

def containers():
    ids = command(['docker', 'ps', '-aq', '--no-trunc']).splitlines()
    if not ids:
        return []
    template = '{"id":{{json .Id}},"name":{{json .Name}},"running":{{json .State.Running}}}'
    return [json.loads(line) for line in command(['docker', 'inspect', '--format', template, *ids]).splitlines()]

before = containers()
owned = [value for value in before if value['name'].lstrip('/') in task_containers]
assert len(owned) == 2
others = [value for value in before if value not in owned]
schemas = command(['docker', 'exec', task_containers[0], 'psql', '-U', 'readiness', '-d', 'klisteni_b2b_readiness_test', '-Atc', "select schema_name from information_schema.schemata where schema_name like 'b2b_product_browser_%'"])
assert not schemas, 'Do not conceal fixture teardown failure by removing the database'
operations = []
for args in [['docker', 'rm', '-f', *task_containers], ['docker', 'network', 'rm', network]]:
    result = subprocess.run(args, capture_output=True, text=True)
    operations.append({'args': args, 'exitCode': result.returncode, 'stdout': result.stdout.strip(), 'stderr': result.stderr.strip()})
    assert result.returncode == 0, result.stderr
after = containers()
after_ids = {value['id'] for value in after}
remaining = [value['name'] for value in after if value['name'].lstrip('/') in task_containers]
networks = command(['docker', 'network', 'ls', '--format', '{{.Name}}']).splitlines()
value = {'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'remainingBrowserSchemas': 0,
    'schemaInventoryTiming': 'After all eight product runs finished and before task database removal; no manual schema drop',
    'remainingTaskContainers': remaining, 'remainingTaskNetworks': [name for name in networks if name == network],
    'removedTaskContainers': owned, 'nonTaskContainersBefore': others, 'nonTaskContainersAfter': after,
    'nonTaskContainerIdsPreserved': all(item['id'] in after_ids for item in others),
    'cleanupCommandTargets': task_containers + [network], 'operations': operations,
    'qualification': 'Cleanup targets only task-owned containers/network. Original and unrelated container IDs are retained; no claim about independently changing unrelated workloads.'}
assert value['nonTaskContainerIdsPreserved'] and not remaining and not value['remainingTaskNetworks']
(ROOT / 'terminal-cleanup.json').write_text(json.dumps(value, indent=2) + '\n')
print(json.dumps({'remainingBrowserSchemas': 0, 'remainingTaskContainers': remaining, 'remainingTaskNetworks': value['remainingTaskNetworks'], 'nonTaskContainerIdsPreserved': value['nonTaskContainerIdsPreserved']}))
