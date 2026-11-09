import {execFile,execFileSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {parseArgs,promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {tools,protocolVersions,serverInfo,guideResource} from './bridge-catalog.mjs';

const execute=promisify(execFile);
const guide=readFileSync(new URL('../AI_README.md',import.meta.url),'utf8');
const failure=code=>({isError:true,content:[{type:'text',text:JSON.stringify({error:{code,message:'Amazon Adsへの参照だけを停止しました。別ターミナルでCloudflareへ再ログインするか、接続状態を確認してください。'}})}]});

export function parseSse(text){return text.split(/\r?\n\r?\n/).flatMap(event=>{
 const data=event.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trimStart()).join('\n');
 return data&&data!=='[DONE]'?[JSON.parse(data)]:[];
});}
export async function relayRpc(message,{endpoint,token,fetchImpl=fetch,version,session,signal}){
 const headers={'content-type':'application/json',accept:'application/json, text/event-stream','cf-access-token':token};
 if(version)headers['mcp-protocol-version']=version;if(session)headers['mcp-session-id']=session;
 const response=await fetchImpl(endpoint,{method:'POST',headers,body:JSON.stringify(message),redirect:'manual',signal:signal??AbortSignal.timeout(8000)});
 if(response.status>=300)throw new Error(response.status===401||response.status===403||(response.status>=300&&response.status<400)?'CLOUDFLARE_LOGIN_REQUIRED':'MCP_NOT_AVAILABLE');
 if(response.status===202||response.status===204)return {messages:[]};
 const reader=response.body?.getReader();const chunks=[];let size=0;
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){void reader.cancel().catch(()=>{});throw new Error('MCP_RESPONSE_TOO_LARGE');}chunks.push(value);}
 const text=Buffer.concat(chunks).toString('utf8');
 const type=response.headers.get('content-type')??'';
 const messages=type.includes('text/event-stream')?parseSse(text):type.includes('application/json')?[JSON.parse(text)]:[];
 if(!messages.length&&message.id!==undefined)throw new Error('CLOUDFLARE_LOGIN_REQUIRED');
 return {messages,session:response.headers.get('mcp-session-id')??session};
}

export function createTokenLoader(cloudflared,app){
 let cached;
 const valid=token=>{try{const exp=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).exp;return token.split('.').length===3&&Number.isFinite(exp)&&exp*1000>Date.now()+45000;}catch{return false;}};
 return async signal=>{
  if(cached&&valid(cached))return cached;
  const result=await execute(cloudflared,['access','token','--app',app],{signal,timeout:2000,killSignal:'SIGKILL',maxBuffer:65536,encoding:'utf8'});
  cached=result.stdout.trim();if(!valid(cached))throw new Error('CLOUDFLARE_LOGIN_REQUIRED');return cached;
 };
}

// Startup/catalog never execute cloudflared or contact the server. Only tools/call can.
export function createBridge({endpoint,loadToken,fetchImpl=fetch,deadlineMs=8000,cooldownMs=30000,now=Date.now}){
 let version=protocolVersions[0],blockedUntil=0,active=0;
 const pending=new Map();
 return async message=>{
  if(message?.method==='notifications/cancelled'){pending.get(message.params?.requestId)?.abort();return;}
  if(message?.id===undefined)return;
  const result=value=>({jsonrpc:'2.0',id:message.id,result:value});
  const error=(code,text)=>({jsonrpc:'2.0',id:message.id,error:{code,message:text}});
  switch(message.method){
   case 'initialize':
    version=protocolVersions.includes(message.params?.protocolVersion)?message.params.protocolVersion:protocolVersions[0];
    return result({protocolVersion:version,serverInfo,capabilities:{tools:{listChanged:false},resources:{subscribe:false,listChanged:false}},instructions:'参照専用。最初にamazonads://guide/ai-readmeを読む。初期化成功は認証成功を意味しない。認証切れはtools/callのisErrorとして返す。'});
   case 'ping':return result({});
   case 'tools/list':return result({tools});
   case 'resources/list':return result({resources:[guideResource]});
   case 'resources/templates/list':return result({resourceTemplates:[]});
   case 'resources/read':return message.params?.uri===guideResource.uri?result({contents:[{uri:guideResource.uri,mimeType:guideResource.mimeType,text:guide}]}):error(-32602,'Unknown resource');
   case 'tools/call':break;
   default:return error(-32601,'Method not found');
  }
  if(!tools.some(t=>t.name===message.params?.name))return error(-32602,'Unknown tool');
  if(now()<blockedUntil)return result(failure('MCP_RETRY_LATER'));
  if(active>=2)return result(failure('MCP_BUSY'));
  const controller=new AbortController();pending.set(message.id,controller);active++;
  let timer;
  try{
   // One wall-clock budget includes token lookup, handshake, response body and tool call.
   const operation=(async()=>{
    const token=await loadToken(controller.signal);
    const options={endpoint,token,fetchImpl,version,signal:controller.signal};
    const init=await relayRpc({jsonrpc:'2.0',id:'bridge-init',method:'initialize',params:{protocolVersion:version,capabilities:{},clientInfo:serverInfo}},options);
    const initialized=init.messages.find(m=>m.id==='bridge-init');
    if(!initialized?.result?.protocolVersion)throw new Error('MCP_NOT_AVAILABLE');
    options.version=initialized.result.protocolVersion;options.session=init.session;
    await relayRpc({jsonrpc:'2.0',method:'notifications/initialized'},options);
    const reply=await relayRpc(message,options);
    const answer=reply.messages.find(m=>m.id===message.id);
    if(!answer?.result)throw new Error('MCP_NOT_AVAILABLE');
    return result(answer.result);
   })();
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('MCP_TIMEOUT'));},deadlineMs);});
   return await Promise.race([operation,deadline]);
  }catch(e){blockedUntil=now()+cooldownMs;return result(failure(e.message==='CLOUDFLARE_LOGIN_REQUIRED'?'CLOUDFLARE_LOGIN_REQUIRED':'MCP_UNAVAILABLE'));}
  finally{controller.abort();clearTimeout(timer);pending.delete(message.id);active--;}
 };
}
let isMain=false;
try{isMain=!!process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href;}catch{}
if(isMain){
 const {values}=parseArgs({options:{endpoint:{type:'string'},cloudflared:{type:'string',default:'cloudflared'},login:{type:'boolean',default:false}},strict:true});
 const url=new URL(values.endpoint??'https://amazonads-v2.cs-fom.com/readonly-mcp');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('An HTTPS MCP endpoint without credentials is required');
 const app=url.href;
 if(values.login){
  try{process.stderr.write('Complete Cloudflare authentication in the browser window.\n');execFileSync(values.cloudflared,['access','login',app],{stdio:['ignore','pipe','pipe'],timeout:180000});process.stderr.write('Cloudflare login completed. Tokens were not printed.\n');}
  catch{process.stderr.write('Cloudflare login did not complete.\n');process.exitCode=1;}
 }else{
  const handle=createBridge({endpoint:app,loadToken:createTokenLoader(values.cloudflared,app)});
  const write=value=>{if(value)process.stdout.write(JSON.stringify(value)+'\n');};
  for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
   try{
    if(line.length>131072)throw new Error();const message=JSON.parse(line);
    // Local ping/catalog remain responsive even while a remote operation is stalled.
    void handle(message).then(write,()=>write({jsonrpc:'2.0',id:message.id??null,error:{code:-32603,message:'MCP bridge unavailable'}}));
   }catch{
    write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON-RPC input'}});
   }
  }
 }
}
