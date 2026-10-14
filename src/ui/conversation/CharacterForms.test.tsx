import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { character,detail } from '../../test/conversations';
import CreateCharacterDialog from './CreateCharacterDialog';
import EditCharacterDialog from './EditCharacterDialog';
afterEach(()=>vi.unstubAllGlobals());
it('creates a private character from the validated card and retains the source file',async()=>{
  let request:RequestInit|undefined;vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{request=options;return new Response(JSON.stringify(character));});
  const created=vi.fn();render(<CreateCharacterDialog csrfToken="csrf" onCreated={created} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('角色名称'),{target:{value:'旅人'}});fireEvent.change(screen.getByLabelText('角色设定（提示词）'),{target:{value:'友善的旅人'}});fireEvent.click(screen.getByRole('button',{name:'保存角色卡'}));await waitFor(()=>expect(created).toHaveBeenCalled());
  const body=request?.body as FormData;expect(JSON.parse(String(body.get('normalized_card')))).toMatchObject({name:'旅人',description:'友善的旅人'});expect(body.get('source_file')).toBeInstanceOf(File);expect(request?.headers).toMatchObject({'X-CSRF-Token':'csrf'});
});
it('preserves the worldbook and submits the original hash when renaming a card',async()=>{
  let request:RequestInit|undefined;vi.stubGlobal('fetch',async(_path:string,options?:RequestInit)=>{request=options;return new Response(JSON.stringify({character,conversation:null}));});
  const saved=vi.fn();render(<EditCharacterDialog character={character} conversation={detail} renameOnly csrfToken="csrf" onSaved={saved} onClose={vi.fn()} onConflict={async()=>{}} />);
  fireEvent.change(screen.getByLabelText('角色名称'),{target:{value:'新旅人'}});fireEvent.click(screen.getByRole('button',{name:'保存名称'}));await waitFor(()=>expect(saved).toHaveBeenCalled());
  expect(JSON.parse(String(request?.body))).toMatchObject({expectedHash:character.normalizedHash,card:{name:'新旅人',lorebook:character.card.lorebook,alternateGreetings:character.card.alternateGreetings}});
});
