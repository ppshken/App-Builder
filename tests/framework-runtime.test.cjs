const {test}=require('node:test'),assert=require('node:assert/strict'),manifest=require('../package.json');

test('installed Next/React runtime and typings match exact manifest pins',()=>{
 for(const name of ['next','react','react-dom','@types/react','@types/react-dom']){
  const expected=manifest.dependencies?.[name]||manifest.devDependencies?.[name];
  assert.match(expected,/^\d+\.\d+\.\d+$/,'Framework versions must remain exact pins');
  assert.equal(require(name+'/package.json').version,expected,`${name} does not match package.json; run npm ci before testing`);
 }
 assert.equal(require('react/package.json').version,require('react-dom/package.json').version);
});
