// SPDX-License-Identifier: AGPL-3.0-or-later

interface TagSearchBoxProps {
  value: string;
  onChange: (query: string) => void;
}

export function TagSearchBox({ value, onChange }: TagSearchBoxProps): JSX.Element {
  return (
    <div className="border-b border-immich-gray-200 px-2 py-2 dark:border-immich-gray-800">
      <input
        type="search"
        aria-label="Search tags"
        placeholder="Search tags…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-immich-gray-200 bg-immich-bg px-3 py-1.5 text-sm text-immich-gray-900 placeholder:text-immich-gray-400 focus:outline-none focus:ring-2 focus:ring-immich-primary dark:border-immich-gray-700 dark:bg-immich-gray-900 dark:text-immich-dark-fg dark:placeholder:text-immich-gray-400"
      />
    </div>
  );
}
