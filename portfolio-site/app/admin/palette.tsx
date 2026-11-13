"use client";

/**
 * The command palette (Ctrl/Cmd+K, or the search button) and the keyboard shortcuts (`g` then a letter, `?` for
 * the list). The palette jumps to any section or record by name and runs quick actions. It is a modal dialog:
 * focus goes into the search box, Escape closes it and focus returns to what had it. Shortcuts never fire while
 * you are typing in a field.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminIsDirty } from "./dirty";
import { paletteIndex } from "./record-actions";
import { filterPalette, QUICK_ACTIONS, sectionItems, SHORTCUTS, shortcutFor, type PaletteItem } from "./_lib/shortcuts";

const LEAVE = "You have unsaved edits. Leave without saving?";
const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

export function Palette({ openSignal }: { openSignal: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [records, setRecords] = useState<PaletteItem[] | null>(null);
  const back = useRef<HTMLElement | null>(null);
  const gPending = useRef<number>(0);
  const input = useRef<HTMLInputElement>(null);

  const go = (href: string) => {
    if (adminIsDirty() && !window.confirm(LEAVE)) return;
    setOpen(false);
    setHelp(false);
    if (href === "/admin/backup" || href.startsWith("/admin/preview")) window.location.assign(href);
    else router.push(href);
  };

  const show = () => {
    back.current = document.activeElement as HTMLElement | null;
    setQ("");
    setAt(0);
    setOpen(true);
    if (!records)
      void paletteIndex().then((r) => setRecords(r.map((x, i) => ({ id: `r${i}`, label: x.label, hint: x.hint, href: x.href }))));
  };
  const hide = () => {
    setOpen(false);
    setHelp(false);
    back.current?.focus?.();
  };

  useEffect(() => {
    if (openSignal) show();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
        return;
      }
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        back.current = document.activeElement as HTMLElement | null;
        setHelp(true);
        return;
      }
      if (e.key.toLowerCase() === "g" && !gPending.current) {
        gPending.current = window.setTimeout(() => (gPending.current = 0), 1200);
        return;
      }
      if (gPending.current) {
        clearTimeout(gPending.current);
        gPending.current = 0;
        const s = shortcutFor(e.key);
        if (s) {
          e.preventDefault();
          go(s.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const base = useMemo(() => [...QUICK_ACTIONS, ...sectionItems(), ...(records ?? [])], [records]);
  const list = useMemo(() => filterPalette(base, q).slice(0, 40), [base, q]);

  const onDialogKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return void (e.preventDefault(), hide());
    if (e.key === "ArrowDown") return void (e.preventDefault(), setAt((a) => Math.min(list.length - 1, a + 1)));
    if (e.key === "ArrowUp") return void (e.preventDefault(), setAt((a) => Math.max(0, a - 1)));
    if (e.key === "Enter" && list[at]) return void (e.preventDefault(), go(list[at].href));
    if (e.key === "Tab") {
      const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input, button"));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) return void (e.preventDefault(), last.focus());
      if (!e.shiftKey && document.activeElement === last) return void (e.preventDefault(), first.focus());
    }
  };

  if (help)
    return (
      <div className="adm-modal" role="presentation" onClick={hide}>
        <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && hide()}>
          <h2>Keyboard shortcuts</h2>
          <ul className="adm-keys">
            <li><kbd>Ctrl</kbd>+<kbd>K</kbd> <span>Search anything</span></li>
            <li><kbd>?</kbd> <span>This list</span></li>
            {SHORTCUTS.map((s) => (
              <li key={s.key}><kbd>g</kbd> <kbd>{s.key}</kbd> <span>{s.label}</span></li>
            ))}
          </ul>
          <button type="button" className="adm-btn" autoFocus onClick={hide}>
            Close
          </button>
        </div>
      </div>
    );
  if (!open) return null;
  return (
    <div className="adm-modal" role="presentation" onClick={hide}>
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Search the admin" onClick={(e) => e.stopPropagation()} onKeyDown={onDialogKey}>
        <input
          ref={input}
          className="adm-input"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="adm-palette-list"
          aria-activedescendant={list[at] ? `adm-pal-${list[at].id}` : undefined}
          placeholder="Jump to a section or record, or run an action"
          value={q}
          onChange={(e) => (setQ(e.target.value), setAt(0))}
        />
        <ul id="adm-palette-list" role="listbox" className="adm-palette-list">
          {list.map((it, i) => (
            <li key={it.id} id={`adm-pal-${it.id}`} role="option" aria-selected={i === at}>
              <button type="button" tabIndex={-1} className={i === at ? "is-on" : undefined} onMouseEnter={() => setAt(i)} onClick={() => go(it.href)}>
                <span>{it.label}</span>
                <small>{it.hint}</small>
              </button>
            </li>
          ))}
          {list.length === 0 ? <li className="adm-hint" style={{ padding: ".6rem" }}>Nothing matches.</li> : null}
        </ul>
        <p className="adm-hint">Up and Down to choose, Enter to open, Esc to close, ? for shortcuts.</p>
      </div>
    </div>
  );
}
