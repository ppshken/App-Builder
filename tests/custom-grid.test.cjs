const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateCustomPage,updateCustomNode,moveCustomNode}=require('../.test-build/custom-page.js');
const {customGridColumns,customGridStyle,customGridSpanStyle}=require('../.test-build/custom-grid.js');
const text={id:'text',type:'text',text:'Keep me'};
test('legacy custom pages retain flow layout; responsive grid accepts independent 1–12 column counts',()=>{
 const legacy={version:1,children:[text]};assert.deepEqual(validateCustomPage(legacy),legacy);assert.deepEqual(customGridStyle(legacy),{});
 const page={version:2,columns:4,tabletColumns:2,mobileColumns:1,rowGap:20,verticalAlign:'start',children:[text]};assert.equal(validateCustomPage(page).columns,4);assert.deepEqual(customGridColumns(page),{desktop:4,tablet:2,mobile:1});
 assert.deepEqual(customGridColumns({columns:6}),{desktop:6,tablet:2,mobile:1});
});
test('grid spans clamp to the parent count for each device without altering saved values',()=>{
 const item={span:8,tabletSpan:4,mobileSpan:3},before={...item};
 assert.deepEqual(customGridSpanStyle(item,{columns:3,tabletColumns:2,mobileColumns:1}),{'--custom-span-desktop':3,'--custom-span-tablet':2,'--custom-span-mobile':1});assert.deepEqual(item,before);
 assert.deepEqual(customGridSpanStyle(item,{}),{});
});
test('invalid grids and spans cannot enter saved custom-page configurations',()=>{
 for(const columns of [0,13,1.5,'3',NaN,Infinity])assert.throws(()=>validateCustomPage({version:2,columns,children:[text]}));
 for(const patch of [{mobileColumns:0},{tabletColumns:20},{rowGap:-1},{rowGap:81},{verticalAlign:'bad'}])assert.throws(()=>validateCustomPage({version:2,children:[text],...patch}));
 assert.throws(()=>validateCustomPage({version:2,children:[{...text,columns:3}]}));
 assert.throws(()=>validateCustomPage({version:2,children:[{...text,span:0}]}));
});
test('nested grids retain content and responsive properties during edits and moves',()=>{
 const layout={version:2,columns:3,children:[{id:'box',type:'container',columns:2,tabletColumns:1,mobileColumns:1,children:[{...text,span:2}]}]};validateCustomPage(layout);
 const updated=updateCustomNode(layout,'box',{columns:4});assert.equal(updated.children[0].children[0].text,'Keep me');
 const moved=moveCustomNode(updated,'text','');assert.equal(moved.children[1].span,2);assert.equal(moved.children[0].columns,4);assert.equal(layout.children[0].columns,2);
});
