import { Button } from '../Button';
import { Icon } from '../Icon';

interface Props {
  disabled: boolean;
  allCompleted: boolean;
  undoCount: number;
  onLight: () => Promise<void>;
  onUndo: () => Promise<void>;
}

export default function MapBulkActions({ disabled, allCompleted, undoCount, onLight, onUndo }: Props) {
  return <>
    <Button variant="quiet" aria-label="全部点亮" title="全部点亮" disabled={disabled || allCompleted} onClick={() => void onLight()}><Icon name="spark" /><span className="mf-map-action-label">全部点亮</span></Button>
    {undoCount > 0 && <Button variant="quiet" aria-label="撤销本次点亮" title="撤销本次点亮" disabled={disabled} onClick={() => void onUndo()}><Icon name="back" /><span className="mf-map-action-label">撤销本次点亮</span></Button>}
  </>;
}
