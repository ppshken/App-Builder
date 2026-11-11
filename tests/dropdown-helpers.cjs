const {expect}=require('@playwright/test');
async function selectChoice(locator,value){
 const control=locator.first();
 if(await control.evaluate(el=>el.tagName!=='BUTTON'))return control.selectOption(value);
 const requested=Array.isArray(value)?value[0]:value;
 await control.click();const dialog=control.locator('xpath=ancestor::html').locator('.search-select-dialog');
 const label=await dialog.locator('select').evaluate((el,wanted)=>{const match=Array.from(el.options).find(o=>typeof wanted==='object'?wanted.label?o.label===wanted.label:o.value===wanted.value:o.value===String(wanted));if(!match){if(typeof wanted==='object'&&wanted.label)return wanted.label;throw Error('Option not found: '+JSON.stringify(wanted));}return match.label;},requested);
 await dialog.getByRole('searchbox',{name:'ค้นหาตัวเลือก',exact:true}).fill(label);await dialog.getByRole('option',{name:label,exact:true}).click();await expect(dialog).toHaveCount(0);
}
async function assertControlValue(locator,expected,options){
 if(await locator.first().evaluate(el=>el.tagName!=='BUTTON'))return expect(locator).toHaveValue(expected,options);
 const poll=expect.poll(()=>locator.getAttribute('value'),options);return expected instanceof RegExp?poll.toMatch(expected):poll.toBe(String(expected));
}
module.exports={selectChoice,assertControlValue};
