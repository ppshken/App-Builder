const test = require('node:test');
const assert = require('node:assert/strict');
const { AiQuotaError, aiFormulaMeasurement, aiSettingLinks, geminiProvider, openAiProvider, parseAiSuggestion, validateAiFormula } = require('../.test-build/ai-assist');
const { blankColumn } = require('../.test-build/columns');

test('Copilot retains bounded recent conversation context as plain text', () => {
  const { aiConversation } = require('../.test-build/ai-assist');
  const history = Array.from({length: 5}, (_, i) => ({ question: String(i), answer: 'a'.repeat(1300), role: 'system' }));
  const normalized = aiConversation(history);
  assert.deepEqual(normalized.map(turn => turn.question), ['1', '2', '3', '4']);
  assert.equal(normalized[0].answer.length, 1200);
  assert.equal(normalized[0].role, undefined);
  assert.deepEqual(aiConversation([null, {question: 'x', answer: {}}]), []);
});

test('AI View drafts accept only a label, table and supported display type', () => {
  const parse = viewDraft => parseAiSuggestion({ answer: 'Draft', formula: null, viewDraft }).viewDraft;
  assert.deepEqual(parse({ label: ' Pending ', table: 'inspection', kind: 'list', position: 'primary', show_if: 'TRUE' }),
    { label: 'Pending', table: 'inspection', kind: 'list' });
  assert.equal(parse({ label: 'Pending', table: 'inspection', kind: 'form' }), null);
  assert.equal(parse({ label: 'Pending', table: '../other', kind: 'table' }), null);
  assert.equal(parse({ label: ' '.repeat(6), table: 'inspection', kind: 'table' }), null);
});

test('AI settings links resolve only server-known identifiers to encoded internal routes', () => {
  const suggestion = parseAiSuggestion({ answer: 'Check settings', formula: null,
    references: ['setting_0', 'setting_0', '/api/users', 'setting_900', 'setting_1', 'setting_2'] });
  const links = aiSettingLinks(suggestion.references, [
    { kind: 'column', table: 'inspection', name: 'status&app=other', label: 'Status' },
    { kind: 'slice', table: 'inspection', name: 'pending', label: 'Pending' },
    { kind: 'action', table: 'inspection', name: 'complete', label: 'Complete' },
  ]);
  assert.deepEqual(links.map(link => link.href), [
    '/t/inspection/edit?column=status%26app%3Dother', '/slices?name=pending', '/actions?name=complete',
  ]);
});

test('AI measurement includes only numeric metrics, permitted tables and generic failure status', () => {
  assert.deepEqual(aiFormulaMeasurement({
    loadMs: 12.5, totalMs: Infinity, calculationFailed: true, error: 'private', value: 'private',
    reads: { rowsLoaded: 120, dataLoads: 2, rowsByTable: { inspection: 100, hidden: 20 }, row: { id: 1 } },
    evaluation: { steps: 30, memoHits: -2, selectRows: 'private' },
  }, new Set(['inspection'])), {
    loadMs: 12.5, reads: { rowsLoaded: 120, dataLoads: 2, rowsByTable: { inspection: 100 } },
    evaluation: { steps: 30 }, calculationFailed: true,
  });
  assert.equal(aiFormulaMeasurement({ reads: { rowsLoaded: '120' } }, new Set()), null);
});

test('AI provider sends only supplied context, disables storage, and forwards the abort signal', async () => {
  const controller = new AbortController();
  const context = { tables: [{ name: 'inspection' }] };
  const provider = openAiProvider('test-key', 'test-model', async (url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(init.redirect, 'error');
    assert.equal(init.signal, controller.signal);
    assert.equal(body.store, false);
    assert.deepEqual(JSON.parse(body.messages[1].content), { question: 'example', context, mode: 'formula' });
    return Response.json({ choices: [{ message: { content: '{"answer":"example","formula":"[amount] + 1"}' } }] });
  });
  assert.deepEqual(await provider({ question: 'example', context, formula: true }, controller.signal),
    { answer: 'example', formula: '[amount] + 1' });
});

test('AI provider suppresses upstream error details and rejects malformed output', async () => {
  const provider = openAiProvider('test-key', 'test-model', async () => new Response('private', { status: 500 }));
  await assert.rejects(provider({ question: 'example', context: {}, formula: false }, new AbortController().signal),
    { message: 'AI provider request failed' });
  assert.throws(() => parseAiSuggestion({ answer: 'ok', formula: 1 }));
  assert.throws(() => parseAiSuggestion({ answer: 'ok', formula: 'a'.repeat(4001) }));
  assert.deepEqual(parseAiSuggestion({ answer: ' ok ', formula: null }), { answer: 'ok', formula: null });
});

test('AI formulas reuse syntax, schema, dependency and result type validation', () => {
  const column = { ...blankColumn(), name: 'total', label: 'Total', type: 'number', is_virtual: true };
  const amount = { ...blankColumn(), name: 'amount', label: 'Amount', type: 'number' };
  const columns = [column, amount];
  const check = source => validateAiFormula(source, column, 'virtual_expr', 'inspection', columns, []);
  assert.equal(check('[amount] + 1'), null);
  assert.ok(check('[missing] + 1'));
  assert.ok(check('SUM(private_table[amount])'));
  assert.ok(check('[total] + 1'));
  assert.ok(check('"wrong type"'));
});

test('AI provider distinguishes exhausted credits from request throttling', async () => {
  for (const code of ['credit_balance_exhausted', 'rate_limit_exceeded']) {
    const provider = openAiProvider('test-key', 'test-model', async () =>
      Response.json({ error: { code } }, { status: 429 }));
    await assert.rejects(provider({ question: 'example', context: {}, formula: false }, new AbortController().signal),
      err => code === 'credit_balance_exhausted' ? err instanceof AiQuotaError : err.message === 'AI provider request failed');
  }
});

test('Gemini sends structured output requests to Google and shares the existing response parser', async () => {
  const provider = geminiProvider('gemini-test-key', 'gemini-3.1-flash-lite', async (url, init) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    assert.equal(init.headers.Authorization, 'Bearer gemini-test-key');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'gemini-3.1-flash-lite');
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.store, undefined);
    return Response.json({ choices: [{ message: { content: '{"answer":"ok","formula":null}' } }] });
  });
  const signal = new AbortController().signal;
  const request = { question: 'example', context: {}, formula: false };
  assert.deepEqual(await provider(request, signal), { answer: 'ok', formula: null });
  const limited = geminiProvider('gemini-test-key', 'gemini-3.1-flash-lite', async () => new Response(null, { status: 429 }));
  await assert.rejects(limited(request, signal), AiQuotaError);
});
