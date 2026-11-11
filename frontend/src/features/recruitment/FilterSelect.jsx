/**
 * A select you can type into.
 *
 * Branch and section come from fixed official lists, but a plain <select>
 * makes you hunt through fourteen sections to find yours. This filters as you
 * type — "cs" narrows to CSE and CSBS — while still only ever committing a
 * value that is on the list, so a typo cannot invent a branch.
 *
 * Built as a combobox rather than a text input with suggestions, so screen
 * readers announce the option count and the active option. Keyboard: arrows
 * move, Enter picks, Escape closes and restores what was committed.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FilterSelect({
  id,
  label,
  options,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  placeholder,
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const root = useRef(null);
  const input = useRef(null);

  // The committed value is the source of truth; typing only proposes.
  useEffect(() => { setQuery(value || ""); }, [value]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    // An untouched field, or one still showing its committed value, offers
    // the whole list — otherwise picking a different option means clearing
    // the box first.
    if (!needle || needle === String(value || "").toLowerCase()) return options;
    return options.filter((o) => o.toLowerCase().includes(needle));
  }, [query, options, value]);

  useEffect(() => { setActive(0); }, [query, open]);

  // Clicking away commits nothing new: restore the committed value so the
  // box never sits showing text that was never accepted.
  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (event) => {
      if (root.current && !root.current.contains(event.target)) {
        setOpen(false);
        setQuery(value || "");
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, value, onBlur]);

  /**
   * Typing is a proposal, not a choice — except when what was typed is
   * already exactly an option. Someone who types "CSE" in full has chosen
   * it as surely as someone who clicked it, and should not have to click
   * the list as well. Clearing the box clears the choice.
   */
  function type(next) {
    setQuery(next);
    const needle = next.trim().toLowerCase();
    if (!needle) { if (value) onChange(""); return; }
    const exact = options.find((o) => o.toLowerCase() === needle);
    if (exact && exact !== value) onChange(exact);
  }

  function commit(option) {
    onChange(option);
    setQuery(option);
    setOpen(false);
    onBlur?.();
    input.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (matches.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter") {
      if (open && matches[active]) { event.preventDefault(); commit(matches[active]); }
      return;
    }
    if (event.key === "Escape") {
      if (open) { event.preventDefault(); setOpen(false); setQuery(value || ""); }
    }
  }

  const activeId = open && matches[active] ? `${listId}-${active}` : undefined;

  return (
    <div className="mc-recruit-combo" ref={root}>
      <div className="mc-recruit-select">
        <input
          id={id}
          ref={input}
          type="text"
          required
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={Boolean(invalid)}
          aria-describedby={describedBy}
          placeholder={placeholder}
          value={query}
          onChange={(event) => { setOpen(true); type(event.target.value); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (!open) onBlur?.(); }}
        />
        <ChevronDown size={17} aria-hidden="true" />
      </div>

      {/* Announced to screen readers; the list below is the visual half. */}
      <span className="mc-recruit-sr" role="status">
        {open ? `${matches.length} ${label.toLowerCase()} option${matches.length === 1 ? "" : "s"}` : ""}
      </span>

      {open && (
        <ul className="mc-recruit-options" id={listId} role="listbox" aria-label={label}>
          {matches.length === 0 ? (
            <li className="mc-recruit-option mc-recruit-option--empty" role="presentation">
              No {label.toLowerCase()} matches “{query.trim()}”
            </li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === value}
                className={
                  "mc-recruit-option" +
                  (index === active ? " is-active" : "") +
                  (option === value ? " is-chosen" : "")
                }
                // mousedown, not click: blur would close the list first.
                onMouseDown={(event) => { event.preventDefault(); commit(option); }}
                onMouseEnter={() => setActive(index)}
              >
                {option}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
