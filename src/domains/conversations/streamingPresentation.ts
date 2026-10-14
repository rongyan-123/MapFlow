import type { GenerationProcessEvent } from './types';

/** Presentation only: model traffic, tool execution and settlement never wait for a tick. */
export class StreamingPresentation {
  private readonly process:GenerationProcessEvent[]=[];
  private readonly queue:{parts:string[];offset:number;processIndex:number|null}[]=[];
  private text='';
  private pending=0;
  private deadline=0;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private closed=false;
  private readonly drained:(()=>void)[]=[];
  constructor(private readonly publish:(answer:string,process:GenerationProcessEvent[])=>void) {}
  answer(text:string) {this.enqueue(text,null);}
  reasoning(text:string) {
    if(this.closed)return;
    let index=this.process.length-1;
    if(this.process[index]?.type!=='reasoning'){this.process.push({type:'reasoning',text:''});index++;}
    this.enqueue(text,index);
  }
  tool(event:Extract<GenerationProcessEvent,{type:'tool'}>) {
    if(this.closed)return;
    this.process.push({...event});this.emit();
  }
  restore(events:GenerationProcessEvent[]) {
    if(this.closed)return;
    for(let index=this.queue.length-1;index>=0;index--) {
      const entry=this.queue[index];
      if(entry.processIndex!==null){this.pending-=entry.parts.length-entry.offset;this.queue.splice(index,1);}
    }
    this.process.splice(0,this.process.length,...events.map(event=>({...event})));this.emit();
  }
  private enqueue(text:string,processIndex:number|null) {
    if(this.closed||!text)return;
    const parts=Array.from(text);
    if(this.pending===0)this.deadline=Date.now()+300;
    this.queue.push({parts,offset:0,processIndex});this.pending+=parts.length;
    if(this.timer===null)this.timer=setTimeout(()=>this.tick(),60);
  }
  private consume(count:number) {
    while(count>0&&this.queue.length){
      const entry=this.queue[0];const take=Math.min(count,entry.parts.length-entry.offset);
      const text=entry.parts.slice(entry.offset,entry.offset+take).join('');
      if(entry.processIndex===null)this.text+=text;
      else {const event=this.process[entry.processIndex];if(event.type==='reasoning')event.text+=text;}
      entry.offset+=take;count-=take;this.pending-=take;
      if(entry.offset===entry.parts.length)this.queue.shift();
    }
  }
  private emit() {this.publish(this.text,this.process.map(event=>({...event})));}
  private tick() {
    this.timer=null;if(this.closed)return;
    const ticks=Math.max(1,Math.ceil((this.deadline-Date.now())/20));
    this.consume(Math.max(1,Math.ceil(this.pending/ticks)));this.emit();
    if(this.pending)this.timer=setTimeout(()=>this.tick(),20);
    else this.resolveDrained();
  }
  drain():Promise<void> {return this.pending&&!this.closed?new Promise(resolve=>this.drained.push(resolve)):Promise.resolve();}
  flush() {
    if(this.closed)return;
    if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
    this.consume(this.pending);this.emit();this.resolveDrained();
  }
  dispose() {
    if(this.timer!==null)clearTimeout(this.timer);this.timer=null;this.closed=true;
    this.queue.length=0;this.pending=0;this.resolveDrained();
  }
  private resolveDrained() {for(const resolve of this.drained.splice(0))resolve();}
}
