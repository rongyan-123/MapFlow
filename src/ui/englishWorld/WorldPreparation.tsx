import { useState } from 'react';
import { Button } from '../Button';
import type { TaskPublic } from '../../domains/englishWorld/types';
import { TaskProgress } from './TaskProgress';
import type { WorldPageContext } from './shared';

export function WorldPreparation({ context, taskId }: { context: WorldPageContext; taskId: string }) {
  const [task, setTask] = useState<TaskPublic | null>(null);
  return <div className="mf-content"><div className="mf-page ew-preparation"><div className="ew-intro"><div><p className="mf-eyebrow">PREPARING YOUR WORLD</p><h2>故事正在准备。</h2><p>选词、编写、检查，再保存。离开页面后，任务仍按原记录继续；回来可以核对进度。</p></div></div>
    <TaskProgress context={context} taskId={taskId} onTask={setTask} />
    <div className="mf-row mf-wrap">{task?.state === 'completed' && task.publicResultRef?.worldId && <Button variant="primary" onClick={() => context.navigate('/english-world/worlds/' + task.publicResultRef!.worldId)}>查看已准备的世界</Button>}<Button onClick={() => context.navigate('/english-world')}>返回我的世界</Button></div>
  </div></div>;
}
