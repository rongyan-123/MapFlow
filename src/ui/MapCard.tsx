import type { SkillTree } from '../types/learning';
import { Button } from './Button';
import { Icon } from './Icon';

export function MapCard({tree,publisher,progress,onOpen,onLearn,onManage}:{tree:SkillTree;publisher?:string;progress?:number;onOpen:()=>void;onLearn?:()=>void;onManage?:()=>void}) {
  return <article className="mf-card mf-map-card"><div className="mf-map-card-top"><span className="mf-map-card-icon"><Icon name="map" /></span><span className="mf-pill">{tree.difficulty_level}</span></div><h2>{tree.title}</h2><p>{tree.description??tree.topic}</p><div className="mf-map-card-meta"><span>{tree.total_nodes} 个节点</span>{publisher && <span>{publisher}</span>}</div>{progress!==undefined && <div className="mf-map-progress"><div><span>学习进度</span><strong>{progress}%</strong></div><progress max={100} value={progress} /></div>}<div className="mf-map-card-actions"><Button onClick={onOpen} aria-label={`查看地图 ${tree.title}`}>查看地图</Button>{onLearn && <Button variant="primary" onClick={onLearn}>进入学习</Button>}{onManage && <Button variant="quiet" onClick={onManage}>管理</Button>}</div></article>;
}
