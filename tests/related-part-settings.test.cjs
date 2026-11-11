const {test}=require('node:test'),assert=require('node:assert/strict');const {relatedPartDraft}=require('../.test-build/related-part-settings');
test('moving Related settings preserves active rules and translates the legacy minimum once',()=>{
 const c={name:'parent',type:'ref',is_part_of:true,related_required:true,part_valid_if:'COUNT([_THIS]) <= 7',part_show_if:'[status] = "open"',part_add_if:'TRUE'};
 const draft=relatedPartDraft(c);assert.equal(draft.part_valid_if,'AND(COUNT([_THIS]) > 0, (COUNT([_THIS]) <= 7))');assert.equal(draft.part_show_if,c.part_show_if);assert.equal(draft.part_add_if,'TRUE');assert.equal(c.related_required,true);
 assert.deepEqual(relatedPartDraft({...c,...draft,related_required:false}),draft);
});
test('legacy required does not silently enable part-of or activate a dormant validation',()=>{
 const draft=relatedPartDraft({name:'parent',type:'ref',related_required:true,is_part_of:false,part_valid_if:'FALSE'});assert.equal(draft.is_part_of,false);assert.equal(draft.part_valid_if,'COUNT([_THIS]) > 0');assert.equal(relatedPartDraft({name:'parent',type:'ref'}).part_valid_if,'');
});


test('Related Valid_If message is retained separately from the Ref value message',()=>{const draft=relatedPartDraft({name:'parent',type:'ref',part_invalid_value_error:'Add two photos',invalid_value_error:'Choose a valid parent'});assert.equal(draft.part_invalid_value_error,'Add two photos');assert.equal(relatedPartDraft({name:'parent',type:'ref'}).part_invalid_value_error,'');});
