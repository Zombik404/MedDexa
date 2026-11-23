import { useCompare } from '../store/compare';

describe('compare selection', () => {
  beforeEach(() => useCompare.setState({ items: [], localHistory: [] }));

  it('toggles items and enforces the 6-item limit', () => {
    const { toggle } = useCompare.getState();
    for (let i = 1; i <= 6; i++) expect(toggle({ id: `m${i}`, name: `M${i}` })).toBe('added');
    expect(toggle({ id: 'm7', name: 'M7' })).toBe('full');
    expect(toggle({ id: 'm3', name: 'M3' })).toBe('removed');
    expect(useCompare.getState().items.map((i) => i.id)).toEqual(['m1', 'm2', 'm4', 'm5', 'm6']);
  });

  it('moves a medicine to the reference position', () => {
    useCompare.getState().replace([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]);
    useCompare.getState().makeReference('c');
    expect(useCompare.getState().items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps a de-duplicated local history for guests', () => {
    const items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    useCompare.getState().remember(items);
    useCompare.getState().remember(items);
    expect(useCompare.getState().localHistory).toHaveLength(1);
  });
});
