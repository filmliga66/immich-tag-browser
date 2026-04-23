// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { ChipBar } from './ChipBar.js';

function labelFor(id: string): string {
  const names: Record<string, string> = {
    tag1: 'Animals',
    tag2: 'Places',
    tag3: 'People',
  };
  return names[id] ?? id;
}

/** Renders ChipBar inside a MemoryRouter with the given initial search string. */
function renderWithSearch(search: string) {
  // Capture URL changes via a sibling component.
  let capturedSearch = search;

  function Spy(): null {
    const [params] = useSearchParams();
    capturedSearch = `?${params.toString()}`;
    return null;
  }

  render(
    <MemoryRouter initialEntries={[`/browse${search}`]}>
      <Routes>
        <Route
          path="/browse"
          element={
            <>
              <ChipBar labelFor={labelFor} />
              <Spy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

  return { getSearch: () => capturedSearch };
}

describe('ChipBar', () => {
  it('renders nothing meaningful when no tags are selected', () => {
    renderWithSearch('');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders chips for each selected tag id', () => {
    renderWithSearch('?tags=tag1,tag2');
    expect(screen.getByText('Animals')).toBeInTheDocument();
    expect(screen.getByText('Places')).toBeInTheDocument();
  });

  it('removes a tag from the URL when its chip remove button is clicked', async () => {
    const user = userEvent.setup();
    const { getSearch } = renderWithSearch('?tags=tag1,tag2');

    await user.click(screen.getByRole('button', { name: /Remove tag Animals/i }));

    expect(getSearch()).toContain('tag2');
    expect(getSearch()).not.toContain('tag1');
  });

  it('removes the tags param entirely when the last chip is removed', async () => {
    const user = userEvent.setup();
    const { getSearch } = renderWithSearch('?tags=tag1');

    await user.click(screen.getByRole('button', { name: /Remove tag Animals/i }));

    expect(getSearch()).not.toContain('tags');
  });

  it('renders chips for three selected tags', () => {
    renderWithSearch('?tags=tag1,tag2,tag3');
    expect(screen.getByText('Animals')).toBeInTheDocument();
    expect(screen.getByText('Places')).toBeInTheDocument();
    expect(screen.getByText('People')).toBeInTheDocument();
  });
});
