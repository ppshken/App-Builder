// Isolated integration guard: a Push regression must never contact real providers.
if(!process.env.NOCODE_TEST_DB?.includes('integration-'))throw Error('Push network guard requires isolated test DB');
const https=require('node:https');https.request=()=>{throw Error('Real HTTPS provider traffic is forbidden in the isolated Push integration test');};
