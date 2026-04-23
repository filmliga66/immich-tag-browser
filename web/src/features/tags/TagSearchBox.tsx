// SPDX-License-Identifier: AGPL-3.0-or-later

interface TagSearchBoxProps {
  value: string;
  onChange: (query: string) => void;
}

export function TagSearchBox({ value, onChange }: TagSearchBoxProps): JSX.Element {
  return (
    <div className="px-2 py-2">
      <input
        type="search"
        aria-label="Search tags"
        placeholder="Search tags…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
    </div>
  );
}
