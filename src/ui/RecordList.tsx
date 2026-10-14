import type {ReactNode} from 'react';
export interface RecordColumn<T>{label:string;render:(record:T)=>ReactNode}
export function RecordList<T>({records,columns,keyOf,titleOf,actions,empty='暂无记录。'}:{records:readonly T[];columns:RecordColumn<T>[];keyOf:(record:T)=>string;titleOf:(record:T)=>string;actions?:(record:T)=>ReactNode;empty?:string}){
  if(!records.length)return <p className="mf-empty">{empty}</p>;
  return <><div className="mf-record-table"><table><thead><tr>{columns.map(column=><th key={column.label}>{column.label}</th>)}{actions&&<th>操作</th>}</tr></thead><tbody>{records.map(record=><tr key={keyOf(record)}>{columns.map(column=><td key={column.label}>{column.render(record)}</td>)}{actions&&<td><div className="mf-row mf-wrap">{actions(record)}</div></td>}</tr>)}</tbody></table></div><div className="mf-record-cards">{records.map(record=><article className="mf-record-card" aria-label={titleOf(record)} key={keyOf(record)}><h3>{titleOf(record)}</h3><dl>{columns.map(column=><div key={column.label}><dt>{column.label}</dt><dd>{column.render(record)}</dd></div>)}</dl>{actions&&<div className="mf-record-actions">{actions(record)}</div>}</article>)}</div></>;
}
