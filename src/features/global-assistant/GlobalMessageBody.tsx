import {useLayoutEffect,useRef,useState} from 'react';
import {fetchGlobalMessageBody,type GlobalBinding,type GlobalGraphMessage} from '../../api/globalAssistantClient';
import type {Navigate} from '../../app/useLocation';
import {PublicUiError,describePublicError} from '../../lib/publicErrors';
import {Button} from '../../ui/Button';
import GlobalMessageMarkdown from './GlobalMessageMarkdown';

export default function GlobalMessageBody({message,binding,navigate}:{message:GlobalGraphMessage;binding:GlobalBinding;navigate:Navigate}){
  const {content,messageId,bodyRef}=message;
  const [body,setBody]=useState({content,nextOffset:bodyRef?.nextOffset??null});
  const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>(null);const reader=useRef<AbortController|null>(null);
  useLayoutEffect(()=>{
    reader.current?.abort();reader.current=null;setBody({content,nextOffset:bodyRef?.nextOffset??null});setBusy(false);setError(null);
    return()=>{reader.current?.abort();reader.current=null;};
  },[content,messageId,bodyRef?.nextOffset,bodyRef?.totalChars,binding.conversationId,binding.bindingVersion]);
  async function expand(){
    if(reader.current||body.nextOffset===null||!bodyRef)return;
    const request=new AbortController();reader.current=request;setBusy(true);setError(null);
    try{
      const page=await fetchGlobalMessageBody(binding,messageId,body.nextOffset,request.signal);
      if(reader.current!==request||request.signal.aborted)return;
      if(page.totalChars!==bodyRef.totalChars)throw new PublicUiError('正文版本已变化，请重新读取最近消息。');
      setBody({content:body.content+page.content,nextOffset:page.nextOffset});
    }catch(failure){if(reader.current===request&&!request.signal.aborted)setError(failure);}
    finally{if(reader.current===request){reader.current=null;setBusy(false);}}
  }
  return <><GlobalMessageMarkdown markdown={body.content} navigate={navigate} />
    {bodyRef&&<div className="mf-global-body-pages"><p className="mf-muted mf-small">正文已加载 {Array.from(body.content).length} / {bodyRef.totalChars} 字</p>
      {Boolean(error)&&<p role="alert" className="mf-status mf-status--error">{describePublicError(error,'正文暂时无法展开，请重试。')}</p>}
      {body.nextOffset!==null&&<Button disabled={busy} onClick={()=>void expand()}>{busy?'正在展开正文…':'展开后续正文'}</Button>}
    </div>}
  </>;
}
