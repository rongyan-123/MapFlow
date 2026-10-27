import { useState } from 'react';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Dialog } from '../Dialog';

interface Props {
  disabled: boolean;
  allCompleted: boolean;
  undoCount: number;
  onLight: () => Promise<void>;
  onUndo: () => Promise<void>;
}

export default function MapBulkActions({ disabled, allCompleted, undoCount, onLight, onUndo }: Props) {
  const [confirming, setConfirming] = useState(false);
  return <>
    <Button variant="quiet" disabled={disabled || allCompleted} onClick={() => setConfirming(true)}><Icon name="spark" />全部点亮</Button>
    {undoCount > 0 && <Button variant="quiet" disabled={disabled} onClick={() => void onUndo()}><Icon name="back" />撤销本次点亮</Button>}
    {confirming && <Dialog title="全部点亮" onClose={() => setConfirming(false)} className="mf-map-bulk-dialog"
      footer={<><Button onClick={() => setConfirming(false)}>取消</Button><Button variant="primary" disabled={disabled} onClick={() => { setConfirming(false); void onLight(); }}>确认点亮</Button></>}>
      <p>确定要点亮全部节点吗？建议一个个节点开始学，全部点亮后，可能影响学习你的学习计划。且可回退。如果要查看学习全景，建议去【学习清单总览】看</p>
    </Dialog>}
  </>;
}
