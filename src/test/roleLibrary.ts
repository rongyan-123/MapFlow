import { fireEvent, screen, within, waitFor } from '@testing-library/react';

export function roleEntry() {
  return screen.getByRole('button', { name: /^我的角色：/ });
}

export function openRoleLibrary() {
  const opened = screen.queryByRole('dialog', { name: '角色库' });
  if (opened) return opened;
  fireEvent.click(roleEntry());
  return screen.getByRole('dialog', { name: '角色库' });
}

export function roleRecord(name: string) {
  return within(openRoleLibrary()).getByRole('heading', { name }).closest('article')!;
}

export async function chooseRole(name: string) {
  if (!screen.queryByRole('dialog', { name: '角色库' })) await waitFor(() => { if ((roleEntry() as HTMLButtonElement).disabled) throw new Error('Role selection still busy'); });
  fireEvent.click(within(roleRecord(name)).getByRole('button', { name: /^(使用角色|当前角色)$/ }));
}
