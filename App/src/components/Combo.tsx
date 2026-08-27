import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';

export interface ComboOption { value: string; label?: string }

// A search-as-you-type combo box. On each keystroke (debounced) it calls `search(query)` and shows
// the returned matches in a dropdown — so the narrowing happens in the query, not by pre-loading
// every value. `search` may be async: here it filters the in-memory seed, but it is shaped exactly
// like a backend call (indexed LIKE + DISTINCT + LIMIT), so it swaps for a `fetch` unchanged and
// scales to millions of rows because the browser only ever holds one small page of results.
export function SearchCombo({ value, onChange, search, placeholder, minChars = 0 }: {
  value: string;
  onChange: (v: string) => void;
  search: (query: string) => ComboOption[] | Promise<ComboOption[]>;
  placeholder?: string;
  minChars?: number;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ComboOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const searchRef = useRef(search);
  searchRef.current = search; // always query with the latest data/closure

  // Debounced query whenever the text changes while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < minChars) { setOpts([]); setBusy(false); return; }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await searchRef.current(q);
      if (mine !== seq.current) return; // a newer keystroke won — drop this stale result
      setOpts(r);
      setBusy(false);
      setActive(-1);
    }, 180);
    return () => clearTimeout(t);
  }, [value, open, minChars]);

  // Close when clicking away.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (v: string) => { onChange(v); setOpen(false); };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, opts.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open && active >= 0 && opts[active]) { e.preventDefault(); pick(opts[active].value); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const showPop = open && value.trim().length >= minChars;
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showPop && (busy || opts.length > 0 || value.trim().length > 0) && (
        <div style={{
          position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, marginTop: 2,
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 6,
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
        }}>
          {busy && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }}>Searching…</div>}
          {!busy && opts.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--muted)' }}>No matches</div>}
          {!busy && opts.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(o.value); }}
              onMouseEnter={() => setActive(i)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                padding: '7px 10px', fontSize: 13, background: i === active ? '#f4effd' : 'transparent',
              }}
            >
              <span style={{ fontWeight: 600 }}>{o.value}</span>
              {o.label && <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 12 }}>{o.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Build a "server-style" query over one column of in-memory rows: distinct values whose text
// contains the query (prefix matches first), capped to `limit`. This is the stand-in for a backend
// endpoint — replace the body with a fetch and the component behaves identically. Scanning stops
// early once enough matches are found, so it never walks the whole column for a typical query.
export function makeColumnSearch(
  rows: () => (string | number | null | undefined)[],
  labelOf?: (v: string) => string | undefined,
  limit = 25,
) {
  return (query: string): ComboOption[] => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    const starts: string[] = [];
    const contains: string[] = [];
    for (const raw of rows()) {
      if (raw == null) continue;
      const v = String(raw).trim();
      if (!v || seen.has(v)) continue;
      const lv = v.toLowerCase();
      if (q && !lv.includes(q)) continue;
      seen.add(v);
      (q && lv.startsWith(q) ? starts : contains).push(v);
      if (seen.size >= limit * 6) break; // plenty found — stop early (the DB would LIMIT server-side)
    }
    const byNum = (a: string, b: string) => {
      const na = Number(a), nb = Number(b);
      return !isNaN(na) && !isNaN(nb) ? nb - na : a.localeCompare(b);
    };
    return [...starts.sort(byNum), ...contains.sort(byNum)].slice(0, limit).map(v => ({ value: v, label: labelOf?.(v) }));
  };
}
