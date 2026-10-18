# 英语世界 v1 公共接口合同

依据：技术方案 0.2；用户已授权实现、本地独立数据库和真实额度测试、验收后部署。本文冻结前后端共同字段，不能通过旧酒馆会话接口实现这些功能。

所有时间是 ISO-8601 UTC 字符串，ID 为 UUID，响应 no-store。私密剧本、模型提示词、角色原生历史和答案不能进入公共 DTO。所有 POST 使用 CSRF，业务操作 clientActionId 在账号内唯一；重试先读取原操作。未明确的可选字段可省略，下面 `| null` 的字段必须明确返回 null。

```ts
type Funding = 'cash' | 'points' | 'byok';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type TaskState = 'queued' | 'running' | 'validating' | 'completed' | 'blocked' | 'failed' | 'stopped';
type ModelAccess = {apiKey:string;baseUrl:string;model:string;contextWindow:number;maxOutputTokens?:number|null;
  reasoningProtocol:'none'|'deepseek'|'siliconflow'|'openai_reasoning';reasoningSupported:boolean};
type FundingSelection = {funding:Funding;profileId?:string;profileVersion?:number;modelAccess?:ModelAccess};
type ResultRef = {kind:'world_version'|'turn'|'translation'|'debrief';worldId?:string;worldVersionId?:string;
  playthroughId?:string;branchId?:string;turnId?:string;translationUseId?:string};
type TaskPublic = {schemaVersion:1;taskId:string;stage:string;state:TaskState;progress:number;sequence:number;
  allowedActions:{canCheck:boolean;canStop:boolean;canResume:boolean;needsCredential:boolean};
  publicResultRef:ResultRef|null;publicError:{code:string;message:string}|null;
  settlement:{status:string;cashMicros:number|null;pointUnits:number|null;balanceMicros:number|null}|null};
type Accepted = {operationId:string;taskId:string|null;worldId?:string;worldVersionId?:string;
  playthroughId?:string;branchId?:string;turnId?:string;translationUseId?:string};
type WorldSummary = {worldId:string;title:string;summary:string;difficulty:Difficulty;
  status:'preparing'|'ready'|'failed'|'archived';currentVersionId:string|null;activeTaskId:string|null;createdAt:string};
type PlaySummary = {playthroughId:string;worldId:string;worldTitle:string;branchId:string;
  branchStatus:'active'|'dead'|'completed'|'abandoned';location:string;updatedAt:string};
type WorldList = {schemaVersion:1;worlds:WorldSummary[];recentPlaythroughs:PlaySummary[];reviewCount:number};
type WorldDetail = {schemaVersion:1;world:WorldSummary;versions:{worldVersionId:string;versionNo:number;status:string}[];
  playthroughs:PlaySummary[];allowedActions:{canStart:boolean;canGenerateVersion:boolean}};
type PublicState = {location:{id:string;name:string;description:string};worldTime:string;goal:string;
  characters:{id:string;name:string;description:string}[];clues:{id:string;text:string}[];inventory:{id:string;name:string}[]};
type PlaythroughPublic = {schemaVersion:1;playthroughId:string;worldId:string;worldTitle:string;worldVersionId:string;
  activeBranchId:string;viewedBranchId:string;revision:number;branchStatus:'active'|'dead'|'completed'|'abandoned';
  publicState:PublicState;activeTaskId:string|null;debriefTaskId:string|null;
  allowedActions:{canAct:boolean;canRestore:boolean;canReadDebrief:boolean}};
type Utterance = {utteranceId:string;turnId:string;sequence:number;ordinal:number;speakerKind:'narrator'|'npc';
  actorKey:string|null;speakerName:string;textEn:string;
  tokens:{tokenId:string;text:string;start:number;end:number;canTranslate:boolean}[];
  translationUse:{selectedTokenId:string;status:'reserved'|'ready'|'failed'|'outcome_unknown';glossZh:string|null}|null};
type HistoryPage = {schemaVersion:1;utterances:Utterance[];nextCursor:string|null};
type Checkpoint = {checkpointId:string;branchId:string;sequence:number;location:string;worldTime:string;summary:string;createdAt:string};
type Checkpoints = {schemaVersion:1;checkpoints:Checkpoint[]};
type Translation = {schemaVersion:1;translationUseId:string;selectedTokenId:string;status:'reserved'|'ready'|'failed'|'outcome_unknown';glossZh:string|null;taskId:string|null};
type Debrief = {schemaVersion:1;status:'pending'|'ready';taskId:string|null;deathReason:string|null;
  lastNpcText:string|null;lastNpcTranslation:string|null;playerText:string|null;playerMeaning:string|null;
  explanation:string|null;category:'language'|'world_rule'|'dangerous_choice'|'mixed'|null};
type Word = {learnerWordId:string;lemma:string;senseId:string|null;glossZh:string|null;
  meaningStatus:'unresolved'|'resolved';firstSeenAt:string;lastSeenAt:string;exposureCount:number;lookupCount:number;dueAt:string|null;
  source:{worldId:string;playthroughId:string;branchId:string;utteranceId:string|null;textEn:string;speakerName:string}|null};
type WordList = {schemaVersion:1;words:Word[];total:number;nextCursor:string|null};
type ReviewTarget = {modality:'reading';lemma:string}|{modality:'writing';lemma:null};
type DueList = {schemaVersion:1;items:(ReviewTarget&{learnerWordId:string;dueAt:string;revision:number})[];dueCount:number};
type ReviewItem = ReviewTarget&{schemaVersion:1;reviewItemId:string;learnerWordId:string;prompt:string;expiresAt:string};
type ReviewResult = {schemaVersion:1;reviewItemId:string;rating:1|2|3|4;glossZh:string|null;dueAt:string;counted:boolean};
```

progress 为 0..1，不伪造逐字进度。tokens 的 start/end 是 Unicode 码点偏移；前端用 Array.from(textEn) 还原，禁止自行切词。只有 NPC 单词可以选择，每段一处；旁白不获得预算。原生输出不直接流式展示。

## 端点与输入

根路径 `/api/me/english-world`。

| 请求 | 输入 | 输出 |
| --- | --- | --- |
| GET /worlds | 无 | WorldList |
| POST /worlds | `{clientActionId,topic,difficulty,targetWordCount,...FundingSelection}`；targetWordCount 首版 6..20 | Accepted |
| GET /worlds/:worldId | 无 | WorldDetail |
| POST /worlds/:worldId/versions | 同创建配置与 clientActionId | Accepted |
| POST /worlds/:worldId/playthroughs | `{clientActionId,worldVersionId,...FundingSelection}` | Accepted，含本局、根分支和开场 task |
| GET /tasks/:taskId | 无 | TaskPublic |
| GET /tasks/:taskId/events | `after` 可选持久序号 | 公开阶段 SSE；页面可使用 GET polling，同一任务不会重新提交 |
| POST /tasks/:taskId/stop | `{clientActionId}` | TaskPublic |
| POST /tasks/:taskId/resume | `{clientActionId,modelAccess?}`，仅允许原调用能恢复时 | TaskPublic |
| GET /playthroughs/:id | `branch` 可选历史分支 | PlaythroughPublic |
| GET /playthroughs/:id/history | `branch`、`cursor` 可选 | HistoryPage |
| POST /playthroughs/:id/turns | `{clientActionId,branchId,expectedRevision,text,...FundingSelection}` | Accepted |
| POST /playthroughs/:id/translations | `{clientActionId,branchId,utteranceId,tokenId,...FundingSelection}` | Translation |
| GET /playthroughs/:id/checkpoints | 无 | Checkpoints |
| POST /playthroughs/:id/restores | `{clientActionId,checkpointId,expectedBranchId,expectedRevision}` | `{schemaVersion:1,operationId,branchId,revision}` |
| GET /playthroughs/:id/debrief | `branch` 可选 | Debrief |
| GET /words | `q`、`filter`（all/lookup/due）、cursor 可选 | WordList |
| GET /words/:id | 无 | `{schemaVersion:1,word:Word,occurrences:[{occurrenceId,textEn,senseId,assignmentRevision}]}` |
| GET /reviews/due | 无 | DueList |
| POST /reviews/items | `{clientActionId,learnerWordId,modality}` | ReviewItem |
| POST /reviews | `{clientActionId,reviewItemId,answer,rating,usedHint}` | ReviewResult |

首版复习采用明确标注的自评 1..4，并保存原作答和提示情况；普通曝光不评分。主动表达的候选和题目必须返回 lemma:null，阅读识别仍返回英文 lemma；复习页先选能力方向，仅显示对应候选，主动表达题面及标题不展示目标英文。题面无答案，提交后显示获准释义；usedHint 为真时不得把自评当无帮助成功，原始自评仍保留。FSRS 调度使用真实库与固定参数版本，原题只能消费一次。

## 请求保存和错误

首次提交前保存原 clientActionId 和冻结的公开请求；modelAccess.apiKey 仅在内存。BYOK 恢复没有 Key 时显示重新填写，不把 Key 放 sessionStorage。未知请求保留操作号，重试按钮明确重放；新行动才生成新号。funding/profile 不能在重试时偷偷换成当前默认值。

错误统一沿用平台 `{error:{code,message,traceId?}}`，英文世界额外封闭码包含 `english_world.not_found/disabled/invalid_request/operation_conflict/revision_conflict/task_pending/translation_used/review_item_consumed/review_item_expired/review_revision_conflict`。401/403 使用既有身份处理。界面显示已知中文错误，不原样展示上游或私密响应。

任务成功只触发刷新业务状态。玩家是否死亡仅看 branchStatus，模型出错不据此宣告死亡。cash/points/byok 均使用服务端目录与执行结算，额度从既有钱包/积分 API 刷新；未知费用显示待核账。
