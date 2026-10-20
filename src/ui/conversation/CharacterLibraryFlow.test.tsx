import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { character } from '../../test/conversations';
import CharacterLibraryFlow from './CharacterLibraryFlow';

afterEach(() => vi.unstubAllGlobals());

function openLibrary() {
  const close = vi.fn();
  const imported = vi.fn();
  render(<CharacterLibraryFlow characters={[character]} csrfToken="csrf" busy={false} changingRole={false} feedback={null}
    removal={{ pending: false, error: null, reset: vi.fn(), remove: async () => undefined }}
    onSelect={vi.fn()} onImported={imported} onSaved={vi.fn()} onConflict={async () => {}} onClose={close} />);
  return { close, imported };
}

it('switches import and creation inside one library with persistent top buttons and drafts', async () => {
  const requests = vi.fn();
  vi.stubGlobal('fetch', requests);
  openLibrary();
  const library = screen.getByRole('dialog', { name: '角色库' });
  fireEvent.click(screen.getByRole('button', { name: '创建角色卡' }));
  expect(screen.getByRole('dialog', { name: '角色库' })).toBe(library);
  expect(screen.getByRole('button', { name: '导入角色卡' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '尚未保存的伙伴' } });
  fireEvent.change(screen.getByLabelText('角色设定（提示词）'), { target: { value: '切换后仍保留这段设定。' } });
  fireEvent.change(screen.getByLabelText('开场白（可选）'), { target: { value: '你好。' } });
  fireEvent.click(screen.getByRole('button', { name: '导入角色卡' }));
  const file = new File([JSON.stringify({ name: '导入伙伴', description: '文件预览也要保留。' })], 'partner.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('选择角色卡'), { target: { files: [file] } });
  await screen.findByRole('region', { name: '导入预览' });
  fireEvent.click(screen.getByRole('button', { name: '创建角色卡' }));
  expect(screen.getByLabelText('角色名称')).toHaveValue('尚未保存的伙伴');
  expect(screen.getByLabelText('角色设定（提示词）')).toHaveValue('切换后仍保留这段设定。');
  expect(screen.getByLabelText('开场白（可选）')).toHaveValue('你好。');
  fireEvent.click(screen.getByRole('button', { name: '导入角色卡' }));
  expect(screen.getByRole('region', { name: '导入预览' })).toHaveTextContent('导入伙伴');
  expect(screen.getByRole('dialog', { name: '角色库' })).toBe(library);
  expect(requests).not.toHaveBeenCalled();
});

it('locks switching during creation and returns to the library after saving without closing it', async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  const request = vi.fn(() => pending);
  vi.stubGlobal('fetch', request);
  const { close, imported } = openLibrary();
  fireEvent.click(screen.getByRole('button', { name: '创建角色卡' }));
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '新伙伴' } });
  fireEvent.change(screen.getByLabelText('角色设定（提示词）'), { target: { value: '一起聊天。' } });
  fireEvent.click(screen.getByRole('button', { name: '保存角色卡' }));
  for (const name of ['我的角色', '导入角色卡', '创建角色卡', '关闭']) expect(screen.getByRole('button', { name })).toBeDisabled();
  await waitFor(() => expect(request).toHaveBeenCalledOnce());
  await act(async () => finish(new Response(JSON.stringify(character))));

  await waitFor(() => expect(screen.getByRole('button', { name: '我的角色' })).toHaveAttribute('aria-pressed', 'true'));
  expect(screen.getByRole('button', { name: '导入角色卡' })).toBeEnabled();
  expect(screen.getByRole('dialog', { name: '角色库' })).toBeVisible();
  expect(imported).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
});

it('releases the import controls after success so the next card can be imported in the same library', async () => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(character)));
  const { imported, close } = openLibrary();
  fireEvent.click(screen.getByRole('button', { name: '导入角色卡' }));
  const file = new File([JSON.stringify({ name: '导入伙伴', description: '一个私有角色。' })], 'partner.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('选择角色卡'), { target: { files: [file] } });
  fireEvent.click(await screen.findByRole('button', { name: '确认导入' }));
  await waitFor(() => expect(imported).toHaveBeenCalledOnce());
  expect(screen.getByRole('button', { name: '我的角色' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '导入角色卡' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '关闭' })).toBeEnabled();
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '导入角色卡' }));
  expect(screen.getByLabelText('选择角色卡')).toBeEnabled();
  expect(screen.queryByRole('region', { name: '导入预览' })).not.toBeInTheDocument();
});
