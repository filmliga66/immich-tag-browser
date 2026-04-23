// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useTagSelection, type TagSelection } from './useTagSelection.js';

type HandleRef = { current: TagSelection | null };

function Harness({ handleRef }: { handleRef: HandleRef }): JSX.Element {
  const selection = useTagSelection();
  handleRef.current = selection;
  const location = useLocation();
  return (
    <div>
      <span data-testid="selected">{selection.selected.join('|')}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
}

function renderHook(initial = '/browse'): () => TagSelection {
  const handleRef: HandleRef = { current: null };
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Harness handleRef={handleRef} />
    </MemoryRouter>,
  );
  return () => {
    if (!handleRef.current) throw new Error('Harness never mounted');
    return handleRef.current;
  };
}

describe('useTagSelection', () => {
  it('reads empty selection from bare URL', () => {
    renderHook('/browse');
    expect(screen.getByTestId('selected')).toHaveTextContent('');
  });

  it('parses the ?tags= param into an array', () => {
    renderHook('/browse?tags=a,b,c');
    expect(screen.getByTestId('selected')).toHaveTextContent('a|b|c');
  });

  it('ignores blank/whitespace entries', () => {
    renderHook('/browse?tags=a,,b, ');
    expect(screen.getByTestId('selected')).toHaveTextContent('a|b');
  });

  it('toggle adds and removes ids, writing to the URL', () => {
    const get = renderHook('/browse');
    act(() => get().toggle('a'));
    expect(screen.getByTestId('selected')).toHaveTextContent('a');
    expect(screen.getByTestId('search').textContent).toContain('tags=a');

    act(() => get().toggle('b'));
    expect(screen.getByTestId('selected')).toHaveTextContent('a|b');

    act(() => get().toggle('a'));
    expect(screen.getByTestId('selected')).toHaveTextContent('b');
    expect(screen.getByTestId('search').textContent).toContain('tags=b');
  });

  it('remove drops the id from the URL', () => {
    const get = renderHook('/browse?tags=a,b');
    act(() => get().remove('a'));
    expect(screen.getByTestId('selected')).toHaveTextContent('b');
  });

  it('clear removes the param entirely', () => {
    const get = renderHook('/browse?tags=a,b');
    act(() => get().clear());
    expect(screen.getByTestId('selected')).toHaveTextContent('');
    expect(screen.getByTestId('search').textContent).not.toContain('tags');
  });

  it('preserves other query params when editing selection', () => {
    const get = renderHook('/browse?foo=bar&tags=a');
    act(() => get().toggle('b'));
    const search = screen.getByTestId('search').textContent ?? '';
    expect(search).toContain('foo=bar');
    expect(search).toContain('tags=');
  });

  it('isSelected reflects URL state', () => {
    const get = renderHook('/browse?tags=a,c');
    expect(get().isSelected('a')).toBe(true);
    expect(get().isSelected('b')).toBe(false);
  });
});
