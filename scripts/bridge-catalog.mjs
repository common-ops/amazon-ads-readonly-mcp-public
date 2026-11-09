// Public protocol contract: no credentials, memberships, target names or live data.
// Compared with the authoritative Zod schemas in test/bridge.test.mjs.
const id={type:'string',minLength:1,maxLength:100};
const page={limit:{type:'integer',minimum:1,maximum:200,default:50},cursor:{type:'string',maxLength:2048}};
const date={type:'string',format:'date-time'};
const object=(properties,required=[])=>({type:'object',properties,...(required.length?{required}:{}),additionalProperties:false});
const inputs={
 list_accessible_contexts:object({}),
 search_targets:object({organization_id:id,query:{type:'string',maxLength:200,default:''},target_type:{type:'string',enum:['keyword','product_target']},include_archived:{type:'boolean',default:false},...page}),
 get_effective_settings:object({target_id:id},['target_id']),
 get_change_history:object({target_id:id,from:date,to:date,time_basis:{type:'string',enum:['executed','generated'],default:'executed'},statuses:{type:'array',items:{type:'string',enum:['executed','pending','open','approved','failed','unknown','rejected','expired','notified','queued','executing','cancelled','skipped']},minItems:1,maxItems:13,default:['executed']},...page},['target_id']),
 get_processing_status:object({organization_id:id,target_id:id,...page}),
};
const descriptions={list_accessible_contexts:'認証済み利用者の閲覧可能法人。最初に呼ぶ。',search_targets:'対象名・IDを検索。法人と対象IDで同名を区別する。',get_effective_settings:'現在の保存設定と対象範囲。条件一致・実行適格性を判定しない。',get_change_history:'保存された変更履歴と当時の根拠。既定7日・実行日時・executed。欠損と収集範囲を保持する。',get_processing_status:'取得・評価・入札・通知の観測状態。法人集計を個別対象の理由と断定しない。'};
export const protocolVersions=['2025-11-25','2025-06-18','2025-03-26','2024-11-05','2024-10-07'];
export const serverInfo={name:'amazon-ads-readonly-bridge',version:'0.3.0'};
export const tools=Object.entries(inputs).map(([name,inputSchema])=>({name,description:descriptions[name],inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
export const guideResource={uri:'amazonads://guide/ai-readme',name:'ai-readme',mimeType:'text/markdown',description:'公開AI利用ガイド。実データは認証後にツールで取得する。'};
