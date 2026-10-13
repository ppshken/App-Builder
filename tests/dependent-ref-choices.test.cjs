const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resetDependentRefChoices} = require('../.test-build/draft-expression.js');
const {formState, validateRow} = require('../.test-build/columns.js');
const now = new Date('2026-10-13T00:00:00Z');
const column = (name, type, extra = {}) => ({name, label: name, type, ...extra});
const columns = [
  column('group', 'text'), column('note', 'text'),
  column('derived', 'text', {is_virtual: true, virtual_expr: 'CONCATENATE([group], "x")'}),
  // Reverse order exercises downstream choices across more than one pass.
  column('second', 'ref', {ref_table: 'options', valid_if: 'IF(ISBLANK([first]), LIST(2), LIST(1))'}),
  column('first', 'ref', {ref_table: 'options', valid_if: 'SELECT(options[id], [kind] = [_THISROW].[derived])'}),
  column('unrelated', 'number', {is_virtual: true, virtual_expr: 'SUM(extras[value])'}),
  column('enum_field', 'enum', {ref_table: 'extras'})
];
function context(reads) {
  return {getTable(name) {
    reads.push(name);
    return name === 'options' ? {key: 'id', columns: ['id', 'kind'], rows: [{id: 1, kind: 'Ax'}, {id: 2, kind: 'Bx'}]} :
      {key: 'id', columns: ['id', 'value'], rows: [{id: 1, value: 10}], labels: {1: 'Extra'}};
  }};
}

test('typing an unrelated field skips Ref checks; dependent checks omit unrelated formulas and choices', () => {
  const raw = {group: 'B', note: 'typing', first: 1, second: 1, enum_field: '1'}, reads = [];
  assert.deepEqual(resetDependentRefChoices(columns, raw, 'note', now, '', context(reads)), raw);
  assert.deepEqual(reads, []);
  const result = resetDependentRefChoices(columns, raw, 'group', now, '', context(reads));
  assert.equal(result.first, null);
  assert.equal(result.second, null);
  assert.equal(result.note, raw.note);
  assert.equal(result.enum_field, '1');
  assert.deepEqual(reads, ['options']);
  assert.equal(raw.first, 1, 'The input draft remains intact');
  assert.equal(resetDependentRefChoices(columns, {...raw, first: 2}, 'group', now, '', context([])).first, 2);
});

test('direct selector edits, empty values, fixed fields and boolean Valid_If retain their values', () => {
  const reads = [];
  assert.equal(resetDependentRefChoices(columns, {group: 'B', first: 1}, 'first', now, '', context(reads)).first, 1);
  assert.deepEqual(reads, []);
  const locked = [...columns, column('fixed', 'ref', {ref_table: 'options', is_editable: false, valid_if: 'IF([group] = "A", LIST(1), LIST(2))'}),
    column('boolean_ref', 'ref', {ref_table: 'options', valid_if: '[group] = "A"'})];
  const result = resetDependentRefChoices(locked, {group: 'B', first: null, fixed: 1, boolean_ref: 1}, 'group', now, '', context(reads));
  assert.equal(result.first, null);
  assert.equal(result.fixed, 1);
  assert.equal(result.boolean_ref, 1);
  assert.deepEqual(reads, []);
});

test('selected form checks match full field results including virtual, Ref, normalized and original-row dependencies', () => {
  const cols = [column('enabled', 'yesno'), column('tags', 'list'), column('store', 'ref', {ref_table: 'stores'}),
    column('count', 'number', {is_virtual: true, virtual_expr: 'COUNT([tags])'}),
    column('choice', 'ref', {ref_table: 'options', valid_if: 'IF([count] > 0, LIST(2), LIST(1))',
      editable_if: 'AND([enabled], [store].[open])', show_if: '[count] > 0', required_if: '[enabled]'})];
  const ctx = {tables: {stores: {key: 'id', columns: ['id', 'open'], rows: [{id: 1, open: 1}]}}};
  for (const enabled of [0, 1]) for (const tags of ['[]', '["A"]']) for (const choice of [1, 2, null]) {
    const row = {enabled, tags, store: 1, choice};
    for (const original of [undefined, {...row, enabled: 0}]) {
      const full = formState(cols, row, now, '', ctx, original), selected = formState(cols, row, now, '', ctx, original, ['choice']);
      for (const field of ['choices', 'editable', 'visible', 'required', 'validation', 'errors']) assert.deepEqual(selected[field].choice, full[field].choice);
      assert.equal(selected.row.count, full.row.count);
    }
  }
});

test('field errors and Editable_If prevent clearing; save validation still checks unrelated fields', () => {
  for (const extra of [{editable_if: 'FALSE'}, {show_if: 'IF('}, {required_if: 'IF('}, {valid_if: 'IF([group], LIST("bad"), LIST(1))'}]) {
    const cols = [column('group', 'text'), column('ref', 'ref', {ref_table: 'options', valid_if: 'IF([group] = "A", LIST(1), LIST(2))', ...extra})];
    assert.equal(resetDependentRefChoices(cols, {group: 'B', ref: 1}, 'group', now, '', {}).ref, 1);
  }
  const cols = [...columns, column('required_text', 'text', {required: true})];
  assert.throws(() => validateRow(cols, {group: 'B', first: 2, second: 1, enum_field: '1'}, now, '', context([])), /required_text/);
});
