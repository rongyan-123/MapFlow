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
    <Button variant="quiet" disabled={disabled || allCompleted} onClick={() => void onLight()}><Icon name="spark" />全部点亮</Button>
    {undoCount > 0 && <Button variant="quiet" disabled={disabled} onClick={() => void onUndo()}><Icon name="back" />撤销本次点亮</Button>}
  </>;
}
