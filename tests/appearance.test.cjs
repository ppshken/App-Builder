const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {APP_FONTS,DEFAULT_SETTINGS,validateSettings,normalizeHex,themeColors,contrastRatio}=require('../.test-build/app-settings');
test('Appearance validates whitelisted fonts, sizes, loaders and hex; older writes preserve options',()=>{
 const previous={...DEFAULT_SETTINGS,font:'prompt',font_weight:300,font_size:18,color:'custom',custom_color:'#09f',loading_style:'both',loading_text:'รอสักครู่'};
 const saved=validateSettings({name:' เปลี่ยนชื่อ '},previous);assert.equal(saved.font,'prompt');assert.equal(saved.font_weight,300);assert.equal(saved.font_size,18);assert.equal(saved.custom_color,'#0099FF');assert.equal(saved.name,'เปลี่ยนชื่อ');
 assert.equal(normalizeHex(' #abc '),'#AABBCC');
 for(const changes of [{font_weight:0},{font_weight:350},{font_weight:'700'},{font:'Arial'},{font:'";url(bad)'},{font_size:11},{font_size:25},{font_size:18.5},{font_size:'18'},{font_size:null},{loading_style:'html'},{loading_text:''},{loading_text:'a'.repeat(81)},{custom_color:'red'},{custom_color:'#12'},{custom_color:'#12345678'},{custom_color:'url(x)'},{color:'bad'}])assert.throws(()=>validateSettings(changes,previous));
 for(const color of ['#FFFFFF','#000000','#FFFF00','#09f','#F5F5F5','#112233'])for(const dark of [true,false]){const p=themeColors({...DEFAULT_SETTINGS,color:'custom',custom_color:color},dark);assert.equal(p.button,normalizeHex(color));assert.ok(contrastRatio(p.button,p.buttonText)>=4.5);assert.ok(contrastRatio(p.accent,dark?'#1b2330':'#ffffff')>=4.5);assert.match(p.soft,/^#[0-9a-f]{6}$/i);}
});
test('Ten Thai Google Fonts include local valid WOFF2 assets, source manifest and original licenses',()=>{
 assert.equal(APP_FONTS.length,10);const files=JSON.parse(fs.readFileSync('public/fonts/sources.json','utf8')),css=fs.readFileSync('app/fonts.css','utf8');assert.equal(css.includes('url(https:'),false);
 for(const f of APP_FONTS){assert.ok(css.includes(`font-family: '${f.family}'`));assert.match(fs.readFileSync(path.join('public/fonts',f.name+'-OFL.txt'),'utf8'),/SIL OPEN FONT LICENSE/);assert.ok(files.some(file=>file.family===f.family));}
 for(const file of files){const data=fs.readFileSync(path.join('public/fonts',file.file));assert.equal(data.subarray(0,4).toString(),'wOF2');assert.equal(data.length,file.bytes);assert.ok(file.source.startsWith('https://fonts.gstatic.com/'));}
});
