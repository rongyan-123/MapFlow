import { expect, it } from 'vitest';
import type { GraphMessage, RoleChange } from './types';
import { messageAuthors } from './messageAuthors';

const message = (id: string, role: string): GraphMessage => ({ messageId: id, parentMessageId: null, role: 'assistant', origin: 'model', characterId: role, content: id });
const change = (anchor: string | null, role: string, name: string): RoleChange => ({ changeId: `${anchor}.${role}`, afterMessageId: anchor, characterId: role, characterName: name, createdAt: '2026-10-11T00:00:00Z' });

it('uses an unchanged conversation snapshot only for messages with the same character ID', () => {
  const authors = messageAuthors([message('old', 'old-role'), message('new', 'current-role')], [], 'current-role', '当前角色');
  expect(authors.get('old')).toBe('历史角色');
  expect(authors.get('new')).toBe('当前角色');
});

it('uses the anchored historical name and ignores switches on another branch', () => {
  const authors = messageAuthors([message('first', 'old-role'), message('second', 'current-role')],
    [change('first', 'current-role', '当时的导师'), change('other-branch', 'current-role', '另一分支角色')], 'current-role', '后来改名的导师');
  expect(authors.get('first')).toBe('历史角色');
  expect(authors.get('second')).toBe('当时的导师');
});

it('does not relabel early messages when switching back to the same character later', () => {
  const authors = messageAuthors([message('first', 'role-1'), message('second', 'role-2'), message('third', 'role-1')],
    [change('first', 'role-2', '角色二'), change('second', 'role-1', '返回后的角色一')], 'role-1', '当前新名称');
  expect(authors.get('first')).toBe('历史角色');
  expect(authors.get('second')).toBe('角色二');
  expect(authors.get('third')).toBe('返回后的角色一');
});

it('preserves the outgoing conversation snapshot for messages before the first role switch', () => {
  const switched = { ...change('first', 'role-2', '第二位导师'), previousCharacterId: 'role-1', previousCharacterName: '原来的导师' };
  const authors = messageAuthors([message('first', 'role-1'), message('second', 'role-2')], [switched], 'role-2', '第二位导师');
  expect(authors.get('first')).toBe('原来的导师');
  expect(authors.get('second')).toBe('第二位导师');
});

it('keeps unknown legacy authors unknown when a later switch supplies an outgoing snapshot', () => {
  const later = { ...change('third', 'role-3', '第三位导师'), previousCharacterId: 'role-1', previousCharacterName: '后来的名称' };
  const authors = messageAuthors([message('first', 'role-1'), message('second', 'role-2'), message('third', 'role-1')],
    [change('first', 'role-2', '角色二'), change('second', 'role-1', '后来的名称'), later], 'role-3', '第三位导师');
  expect(authors.get('first')).toBe('历史角色');
  expect(authors.get('second')).toBe('角色二');
  expect(authors.get('third')).toBe('后来的名称');
});

it('retains old names when the same character receives a new snapshot', () => {
  const edited = { ...change('first', 'role-1', '新名称'), previousCharacterId: 'role-1', previousCharacterName: '旧名称' };
  const authors = messageAuthors([message('first', 'role-1'), message('second', 'role-1')], [edited], 'role-1', '新名称');
  expect(authors.get('first')).toBe('旧名称');
  expect(authors.get('second')).toBe('新名称');
});

it('uses each generated message snapshot across regenerated alternatives and sibling branches', () => {
  const edited = { ...change('original-answer', 'role-1', '新名称'), previousCharacterId: 'role-1', previousCharacterName: '旧名称' };
  const original = { ...message('original-answer', 'role-1'), characterName: '旧名称' };
  const regenerated = { ...message('regenerated-answer', 'role-1'), characterName: '新名称' };
  const siblingReply = { ...message('sibling-reply', 'role-1'), characterName: '新名称' };
  expect(messageAuthors([regenerated, siblingReply], [edited], 'role-1', '新名称').get(regenerated.messageId)).toBe('新名称');
  expect(messageAuthors([original], [edited], 'role-1', '新名称').get(original.messageId)).toBe('旧名称');
});
