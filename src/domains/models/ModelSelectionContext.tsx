import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { readModelSelection, saveModelSelection } from './preferences';
import {useSceneModels} from './SceneModelContext';
import type {ModelPurpose} from './scenePreferences';
import type { TavernModelSelection } from '../conversations/types';

interface ModelSelectionState {
  selection: TavernModelSelection;
  change: (selection: TavernModelSelection) => void;
}
const ModelSelectionContext = createContext<ModelSelectionState | null>(null);

export function ModelSelectionProvider({ accountId, children }: { accountId: string; children: ReactNode }) {
  const [selection, setSelection] = useState(() => readModelSelection(accountId));
  const customSelection = useRef(readModelSelection(accountId, 'custom'));
  function change(next: TavernModelSelection) {
    if (next.provider === 'custom') {
      if (next.apiKey) customSelection.current = next;
      else if (selection.provider === 'platform') next = { ...customSelection.current, historyBytes: next.historyBytes };
    } else if (selection.provider === 'custom' && !next.model) {
      next = { ...readModelSelection(accountId, 'platform'), historyBytes: next.historyBytes };
    }
    saveModelSelection(accountId, next);
    setSelection(next);
  }
  return <ModelSelectionContext.Provider value={{ selection, change }}>{children}</ModelSelectionContext.Provider>;
}

export function useSharedModelSelection(purpose:ModelPurpose='tavern') {
  const legacy=useContext(ModelSelectionContext);const scenes=useSceneModels();
  if(!scenes)return legacy;
  const saved=scenes.entries[purpose];
  const selection:TavernModelSelection={provider:'custom',apiKey:scenes.credentials[purpose]??'',baseUrl:saved?.settings.baseUrl??'',model:saved?.settings.model??'',historyBytes:saved?.settings.historyBytes??32768,settings:{}};
  return {selection,change:(next:TavernModelSelection)=>{if(saved)void scenes.save(purpose,saved.version,{...saved.settings,baseUrl:next.baseUrl,model:next.model,historyBytes:next.historyBytes},next.apiKey).catch(()=>scenes.reload());}};
}
