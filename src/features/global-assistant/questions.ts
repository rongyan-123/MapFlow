export interface AssistantQuestion {id:string;text:string}
const pools=[
  ['本网站是什么？适合怎么使用？','作者支持怎样的学习方式？','学习地图和普通课程有什么不同？','这里适合哪些学习目标？','全局助手能帮我做哪些事？','网站的主要功能分别在哪里？'],
  ['第一次使用，我应该从哪里开始？','怎样创建自己的第一张学习地图？','已有地图，怎样开始学习？','在哪里查看我的地图和学习进度？','如何选择模型、查看费用？','我想导入角色卡，应该去哪里？'],
  ['怎么规划自己的学习路线？','零基础学习一个方向，先做什么？','每天只有半小时，怎样安排学习？','如何判断自己缺少哪些前置知识？','如何把大目标拆成可以完成的小阶段？','学了一段时间，怎么调整原来的路线？'],
].map((questions,pool)=>questions.map((text,index)=>({id:`${pool}-${index}`,text})));

/** Only public question IDs are persisted; chat content never influences the choices. */
export function questionsForVisit(accountId:string):AssistantQuestion[] {
  const key=`mapflow.global-assistant.questions.v1.${accountId}`;
  let previous:unknown;
  try{previous=JSON.parse(localStorage.getItem(key)??'null');}catch{previous=null;}
  const previousIds=Array.isArray(previous)?previous.filter((id):id is string=>typeof id==='string'):[];
  const selected=pools.map(pool=>{
    const candidates=pool.filter(question=>!previousIds.includes(question.id));
    return candidates[Math.floor(Math.random()*candidates.length)];
  });
  try{localStorage.setItem(key,JSON.stringify(selected.map(question=>question.id)));}catch{/* Questions remain usable without browser storage. */}
  return selected;
}

export function appendQuestion(draft:string,question:string):string {
  if(draft.includes(question))return draft;
  return draft?`${draft}${draft.endsWith('\n')?'':'\n'}${question}`:question;
}
