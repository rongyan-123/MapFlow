import { useState, type ReactNode } from 'react';
import type { Character, ConversationDetail } from '../../domains/conversations/types';
import { describePublicError } from '../../lib/publicErrors';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import CharacterLibraryDialog from './CharacterLibraryDialog';
import CardImportDialog from './CardImportDialog';
import CreateCharacterDialog from './CreateCharacterDialog';
import EditCharacterDialog from './EditCharacterDialog';

type Panel = { kind: 'library' | 'import' | 'official' | 'create' }
  | { kind: 'edit'; character: Character; renameOnly: boolean }
  | { kind: 'delete'; character: Character };

interface Props {
  characters: Character[];
  selected?: string;
  conversation?: ConversationDetail;
  csrfToken: string;
  busy: boolean;
  changingRole: boolean;
  feedback: ReactNode;
  removal: { pending: boolean; error: unknown; reset: () => void; remove: (id: string) => Promise<unknown> };
  onSelect: (character: Character) => void;
  onImported: (character: Character) => void;
  onSaved: (saved: { character: Character; conversation: ConversationDetail | null }) => void;
  onConflict: () => Promise<void>;
  onClose: () => void;
}

export default function CharacterLibraryFlow(props: Props) {
  const [panel, setPanel] = useState<Panel>({ kind: 'library' });
  if (panel.kind === 'library') return <CharacterLibraryDialog
    characters={props.characters} selected={props.selected} busy={props.busy} changingRole={props.changingRole}
    feedback={props.feedback} onSelect={props.onSelect} onClose={props.onClose}
    onImport={() => setPanel({ kind: 'import' })} onBrowseOfficial={() => setPanel({ kind: 'official' })}
    onCreate={() => setPanel({ kind: 'create' })}
    onEdit={(character, renameOnly) => setPanel({ kind: 'edit', character, renameOnly })}
    onDelete={character => { props.removal.reset(); setPanel({ kind: 'delete', character }); }}
  />;
  if (panel.kind === 'import' || panel.kind === 'official') return <CardImportDialog
    csrfToken={props.csrfToken} initialBrowseOfficial={panel.kind === 'official'}
    onImported={character => { props.onImported(character); setPanel({ kind: 'library' }); }}
    onClose={() => setPanel({ kind: 'library' })}
  />;
  if (panel.kind === 'create') return <CreateCharacterDialog csrfToken={props.csrfToken}
    onCreated={character => { props.onImported(character); props.onClose(); }} onClose={props.onClose}
  />;
  if (panel.kind === 'edit') return <EditCharacterDialog character={panel.character} renameOnly={panel.renameOnly}
    conversation={props.conversation?.character.characterId === panel.character.characterId ? props.conversation : undefined}
    csrfToken={props.csrfToken} onConflict={props.onConflict}
    onSaved={saved => { props.onSaved(saved); props.onClose(); }} onClose={props.onClose}
  />;
  if (panel.kind === 'delete') return <Dialog title="删除角色" onClose={props.onClose} dismissible={!props.removal.pending}>
    <div className="mf-stack">
      <p>删除“{panel.character.card.name}”？已有会话保留角色快照。</p>
      {!!props.removal.error && <p role="alert" className="mf-status mf-status--error">{describePublicError(props.removal.error)}</p>}
      <Button variant="danger" disabled={props.removal.pending}
        onClick={() => void props.removal.remove(panel.character.characterId).then(props.onClose).catch(() => {})}>确认删除角色</Button>
    </div>
  </Dialog>;
  return null;
}
