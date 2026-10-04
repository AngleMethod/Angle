const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const model = load('lib/programTemplates.ts');
const id = '11111111-1111-4111-8111-111111111111';
const steps = [
  { type: 'banner', text: 'Handstands', separateDay: true, dayId: id, dayFrequency: '3x per week' },
  { type: 'video', title: 'Wall handstand', videoId: id, description: 'Push tall.', sets: '3', repsOrHoldTime: '20 sec' },
  { type: 'banner', text: 'Flexibility' },
];
test('template copies preserve prescription but isolate student edits and day IDs', () => {
  const copied = model.copyTemplateSteps(steps, () => 'new-day');
  assert.equal(copied[0].dayId, 'new-day');
  assert.equal(copied[0].dayFrequency, '3x per week');
  assert.equal(copied[1].description, 'Push tall.');
  assert.equal(copied[1].sets, '3');
  copied[1].sets = '5'; copied[2].text = 'Mobility';
  assert.equal(steps[1].sets, '3'); assert.equal(steps[2].text, 'Flexibility');
  assert.equal(steps[0].dayId, id);
});
test('validation accepts empty drafts and removes non-program/member metadata', () => {
  assert.deepEqual(model.parseTemplateSteps([]), []);
  const clean = model.parseTemplateSteps([{ ...steps[1], goals: 'private', userId: 'student', title: ' Wall handstand ' }]);
  assert.equal(clean[0].title, 'Wall handstand');
  assert.equal(clean[0].goals, undefined); assert.equal(clean[0].userId, undefined);
});
test('validation rejects missing videos, malformed days and oversized content', () => {
  for (const bad of [null, {}, [null], [{ ...steps[1], videoId: '' }], [{ ...steps[1], title: '' }], [{ ...steps[1], description: 'a'.repeat(10001) }], [{ ...steps[0], dayId: 'bad' }], Array(301).fill(steps[1])]) {
    assert.throws(() => model.parseTemplateSteps(bad));
  }
});
function routeHarness({ email = 'josh@angle.coach', present = true, conflict = false, dbError = false } = {}) {
  const calls = [];
  const admin = { from(table) {
    assert.ok(['program_templates', 'videos'].includes(table), 'must never write a student workout');
    calls.push(table);
    const builder = {
      select() { return builder; }, eq(key, value) { calls.push(`${key}=${value}`); return builder; },
      update(value) { calls.push(value); return builder; },
      async in() { return { data: present ? [{ id }] : [], error: null }; },
      async single() { return { data: { steps, version: 2, updated_at: null }, error: dbError ? {} : null }; },
      async maybeSingle() { return { data: conflict ? null : { steps, version: 3 }, error: dbError ? {} : null }; },
    };
    return builder;
  } };
  const route = load('app/api/admin/program-templates/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { email } }, error: null }) } }) },
    '@/lib/supabase': { createAdminClient: () => admin },
    '@/lib/programTemplates': model,
  });
  return { route, calls };
}
const req = (body = { steps, version: 2 }, token = 'test') => ({ nextUrl: new URL('https://angle.coach/api/admin/program-templates'), headers: { get: () => token && `Bearer ${token}` }, json: async () => body });
test('both endpoints deny anonymous users and non-admin students before database access', async () => {
  for (const token of ['', 'test']) {
    const { route, calls } = routeHarness({ email: 'student@example.com' });
    assert.equal((await route.GET(req(undefined, token))).status, 403);
    assert.equal((await route.PUT(req(undefined, token))).status, 403);
    assert.deepEqual(calls, []);
  }
});
test('save advances revision and writes only a template, never student programs', async () => {
  const { route, calls } = routeHarness();
  const result = await route.PUT(req());
  assert.equal(result.status, 200); assert.equal(result.body.template.version, 3);
  const update = calls.find(c => typeof c === 'object');
  assert.equal(update.version, 3); assert.equal(update.steps.length, 3);
});
test('missing library videos are reported on load and block saves', async () => {
  const { route } = routeHarness({ present: false });
  assert.deepEqual((await route.GET(req())).body.missingVideoIds, [id]);
  assert.equal((await route.PUT(req())).status, 400);
});
test('concurrent edit conflicts do not overwrite another coach and setup failures surface', async () => {
  assert.equal((await routeHarness({ conflict: true }).route.PUT(req())).status, 409);
  assert.equal((await routeHarness({ dbError: true }).route.GET(req())).status, 503);
  assert.equal((await routeHarness().route.PUT(req({ steps, version: -1 }))).status, 400);
});

test('advanced reads and saves target advanced only; invalid template IDs are rejected', async () => {
  const { route, calls } = routeHarness();
  const request = req(); request.nextUrl.searchParams.set('id', 'advanced');
  assert.equal((await route.GET(request)).status, 200);
  assert.equal((await route.PUT(request)).status, 200);
  assert.equal(calls.filter(c => c === 'id=advanced').length, 2);
  assert.ok(!calls.includes('id=beginner'));
  request.nextUrl.searchParams.set('id', 'unknown');
  assert.equal((await route.GET(request)).status, 400);
  assert.equal((await route.PUT(request)).status, 400);
});
test('saving an imported template preserves legacy prescription fields', () => {
  const exercise = { ...steps[1], frequency: '3x/week', section: 'handstands', sectionDescription: 'Original dose', sectionTitle: 'Straight' };
  assert.deepEqual(model.parseTemplateSteps([exercise])[0], exercise);
});
