"use client";

import { useMemo, useState } from "react";

type CityAutocompleteProps = {
  id: string;
  name: string;
  defaultValue: string;
  suggestions: string[];
  placeholder?: string;
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function CityAutocomplete({
  id,
  name,
  defaultValue,
  suggestions,
  placeholder
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalize(query);

  const filtered = useMemo(() => {
    const unique = Array.from(new Set(suggestions));
    if (!normalizedQuery) return unique.slice(0, 8);
    return unique
      .filter((city) => normalize(city).includes(normalizedQuery))
      .slice(0, 8);
  }, [normalizedQuery, suggestions]);

  return (
    <div className="city-autocomplete">
      <input
        id={id}
        name={name}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        required
        aria-autocomplete="list"
        aria-expanded={isOpen}
      />

      {isOpen && filtered.length > 0 ? (
        <ul className="city-autocomplete-list" role="listbox" aria-label="City suggestions">
          {filtered.map((city) => (
            <li key={city}>
              <button
                type="button"
                className="city-autocomplete-item"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(city);
                  setIsOpen(false);
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
