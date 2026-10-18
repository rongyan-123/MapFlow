import {useState} from 'react';
import type {Administrator} from '../../domains/admin/useAdministration';
import {useFeedbackHistory} from '../../domains/support/useFeedback';
import {Button} from '../../ui/Button';
import {QueryStatus} from '../../ui/QueryStatus';
import {FeedbackRecords} from '../../ui/support/FeedbackRecords';
import {FeedbackThread} from '../../ui/support/FeedbackThread';
export function FeedbackSection({accountId='',csrfToken}:Administrator){
  const [state,setState]=useState('all');const [selected,setSelected]=useState<string|null>(null);const list=useFeedbackHistory(accountId,!selected,state);
  return <section className="mf-stack"><div className="mf-section-title"><h2>用户反馈</h2><span className="mf-muted mf-small">回复将送达用户消息中心</span></div>{selected?<FeedbackThread key={selected} accountId={accountId} feedbackId={selected} csrfToken={csrfToken} admin onBack={()=>setSelected(null)} />:<><div role="tablist" aria-label="反馈状态" className="mf-section-tabs">{[{id:'all',label:'全部反馈'},{id:'waiting',label:'等待回复'},{id:'replied',label:'已回复'}].map(tab=><button type="button" role="tab" key={tab.id} aria-selected={state===tab.id} onClick={()=>setState(tab.id)}>{tab.label}</button>)}</div><QueryStatus pending={list.isPending} error={list.error} retry={()=>void list.refetch()} /><FeedbackRecords items={list.data?.pages.flatMap(page=>page.items)??[]} showUsername onOpen={setSelected} />{list.isSuccess&&!list.data.pages[0].items.length&&<p className="mf-empty">暂无符合条件的反馈。</p>}{list.hasNextPage&&<Button disabled={list.isFetchingNextPage} onClick={()=>void list.fetchNextPage()}>查看更多反馈</Button>}</>}</section>;
}
