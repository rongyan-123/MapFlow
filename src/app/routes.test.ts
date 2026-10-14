import { describe, expect, it } from 'vitest';
import { resolveRoute } from './routes';

describe('application addresses', () => {
  it('keeps the selected personal map in the address', () => {
    expect(resolveRoute('/maps?entry=entry-1')).toMatchObject({ page: 'maps', entryId: 'entry-1' });
  });

  it('preserves a learning area and an explicitly referenced node', () => {
    expect(resolveRoute('/learning?area=area-1&node=node-1&title=CSV')).toMatchObject({
      page: 'learning', areaId: 'area-1', node: { id: 'node-1', title: 'CSV' },
    });
  });

  it('opens a legacy console link in the account remembered view', () => {
    expect(resolveRoute('/console', 'personal').page).toBe('maps');
    expect(resolveRoute('/console', 'learning').page).toBe('learning');
    expect(resolveRoute('/console', 'public').page).toBe('library');
  });

  it('keeps the marketing link separate from the signed in assistant', () => {
    expect(resolveRoute('/?marketing=1').page).toBe('landing');
    expect(resolveRoute('/').page).toBe('assistant');
  });

  it('does not carry an invalid partial node reference into a lesson', () => {
    expect(resolveRoute('/learning?area=area-1&node=node-1').node).toBeUndefined();
    expect(resolveRoute('/learning?area=area-1&node=node-1&title=%00').node).toBeUndefined();
  });

  it('keeps guide links and all existing standalone page addresses reachable', () => {
    expect(resolveRoute('/library?guide=1').guide).toBe(true);
    for (const page of ['assistant','library','maps','learning','tavern','wallet','models','admin','settings','login','register']) {
      expect(resolveRoute('/'+page).page).toBe(page);
    }
  });
});
it('keeps the public map deep link',()=>{
  expect(resolveRoute('/library?tree=public-one')).toMatchObject({page:'library',treeId:'public-one'});
});
