import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{cloudflared:{type:'string',default:'cloudflared'}},strict:true});
const args=[fileURLToPath(new URL('./access-bridge.mjs',import.meta.url)),'--endpoint','https://amazonads-v2.cs-fom.com/readonly-mcp','--cloudflared',values.cloudflared];
console.log(JSON.stringify({mcpServers:{'amazon-ads-readonly':{command:process.execPath,args}}},null,2));
const common='[mcp_servers.amazon_ads_readonly]\ncommand = '+JSON.stringify(process.execPath)+'\nargs = '+JSON.stringify(args)+'\nstartup_timeout_sec = 5\ntool_timeout_sec = 12\n';
process.stderr.write('\nCodex TOML:\n'+common+'required = false\n\nGrok CLI TOML:\n'+common);
