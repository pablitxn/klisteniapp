// Manual member review data, only through the disposable WL harness's spare proxy.
// No production domains, mail provider, DNS changes, or persistent connections.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { whiteLabelTLS } from './b2b-wl-tls.mjs';

const requireWeb = createRequire(new URL('../apps/b2c-web/package.json', import.meta.url));
const { chromium } = requireWeb('@playwright/test');
const origin = 'https://atlas.b2b.test';
const email = 'review-member@atlas.example.test';
const password = 'browser-tests-only-password-2026';
const { spki } = whiteLabelTLS();
const browser = await chromium.launch({
  ...(process.env.B2B_QA_CHROMIUM_PATH ? { executablePath: process.env.B2B_QA_CHROMIUM_PATH } : {}),
  args: [`--ignore-certificate-errors-spki-list=${spki}`],
});
const context = await browser.newContext({ proxy: { server: 'http://127.0.0.1:4344' } });
try {
  const page = await context.newPage();
  await page.goto(`${origin}/manage`);
  await page.getByLabel('Email', { exact: true }).fill('admin@atlas.example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByRole('button', { name: 'Salir', exact: true }).waitFor();
  async function request(path, method = 'GET', body, headers = {}) {
    const result = await page.evaluate(async ({ path, method, body, headers }) => {
      const response = await fetch(`/api/b2b${path}`, { method,
        headers: { 'content-type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    }, { path, method, body, headers });
    assert.ok(result.status < 400, `Synthetic fixture operation failed (${result.status})`);
    return result.body;
  }
  const brand = await request('/context');
  assert.equal(brand.organization.id, 'atlas-demo');
  assert.deepEqual(brand.branches.map(branch => branch.slug).sort(), ['centro', 'norte']);
  const me = await request('/me');
  const headers = { 'x-klisteni-b2b-account': me.user.id, 'x-klisteni-b2b-role': 'admin',
    'x-klisteni-b2b-branch': 'atlas-demo-principal' };
  const members = await request('/orgs/atlas-demo/members', 'GET', undefined, headers);
  let member = members.members.find(person => person.email === email);
  if (!member) {
    const invitation = await request('/orgs/atlas-demo/invitations', 'POST',
      { name: 'Socio de revisión ficticio', email, role: 'member' }, headers);
    const token = new URLSearchParams(new URL(invitation.url).hash.slice(1)).get('token');
    assert.ok(token);
    await request('/invitations/accept', 'POST', { token, name: 'Socio de revisión ficticio', password });
    member = (await request('/orgs/atlas-demo/members', 'GET', undefined, headers)).members.find(person => person.email === email);
  }
  assert.ok(member);
  const branches = ['atlas-demo-principal', 'atlas-demo-norte'];
  for (const branchId of branches) {
    await request('/orgs/atlas-demo/grants', 'PUT', { userId: member.userId, branchId, role: 'member', active: true }, headers);
    const scope = { ...headers, 'x-klisteni-b2b-branch': branchId };
    const existing = await request('/orgs/atlas-demo/assignments', 'GET', undefined, scope);
    const programId = branchId === branches[0] ? 'atlas-demo-starter' : 'atlas-demo-norte-starter';
    if (!existing.assignments.some(item => item.memberId === member.userId && item.program.programId === programId))
      await request('/orgs/atlas-demo/assignments', 'POST', { memberId: member.userId, programId, version: 1 }, scope);
  }
  const programs = await request('/orgs/atlas-demo/programs', 'GET', undefined, headers);
  let timed = programs.programs.find(program => program.name === 'QA manual · tiempo');
  if (!timed) {
    timed = (await request('/orgs/atlas-demo/programs', 'POST', { name: 'QA manual · tiempo',
      description: 'Fixture ficticio: dos series por segundos con esfuerzo opcional.',
      steps: [{ id: 'manual-time', exerciseId: 'squat', sets: 2, reps: null, durationSeconds: 45,
        targetRpe: 7, loadKg: null, restSeconds: 30, alternatives: ['quarter-squat'], notes: '' }] }, headers)).program;
    await request(`/orgs/atlas-demo/programs/${timed.id}/publish`, 'POST', { expectedRevision: timed.revision }, headers);
  }
  const assigned = await request('/orgs/atlas-demo/assignments', 'GET', undefined, headers);
  if (!assigned.assignments.some(item => item.memberId === member.userId && item.program.programId === timed.id))
    await request('/orgs/atlas-demo/assignments', 'POST', { memberId: member.userId, programId: timed.id, version: 1 }, headers);
  const output = { origin, proxy: 'http://127.0.0.1:4344', email, branches,
    routines: ['Inicio · fuerza y técnica', 'QA manual · tiempo'],
    passwordSource: 'Synthetic constant in apps/b2c-web/e2e/member-qa.spec.ts',
    lifetime: 'Only while scripts/b2b-wl-e2e-server.mjs is running. SIGTERM drops its schemas.' };
  const directory = fileURLToPath(new URL('../.cache/member-qa/', import.meta.url));
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/review-fixture.json`, JSON.stringify(output, null, 2), { mode: 0o600 });
  console.info(JSON.stringify(output, null, 2));
} finally {
  await context.close();
  await browser.close();
}
