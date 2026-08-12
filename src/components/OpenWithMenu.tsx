import { useEffect, useRef, useState } from "react";
import type { SkillOpener } from "../types";

const OPENERS: Array<{ id: SkillOpener; label: string }> = [
  { id: "finder", label: "访达" },
  { id: "vscode", label: "VS Code" },
  { id: "cursor", label: "Cursor" },
];

interface OpenWithMenuProps {
  label: string;
  busyKey?: string;
  busyPrefix?: string;
  onOpenWith: (opener: SkillOpener) => void;
  onNavigate?: () => void;
}

export function OpenWithMenu({ label, busyKey, busyPrefix = "", onOpenWith, onNavigate }: OpenWithMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (triggerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const busy = busyKey?.startsWith(`${busyPrefix}:open:`);

  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = onNavigate ? 168 : 120;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight + 12 ? rect.top - menuHeight - 4 : rect.bottom + 4;
      setCoords({ top: Math.max(8, top), left: rect.right - 160 });
    }
    setOpen((value) => !value);
  };

  return (
    <div className="open-with">
      <button
        type="button"
        ref={triggerRef}
        className="open-with-trigger"
        aria-label={`打开 ${label} 方式`}
        aria-expanded={open}
        disabled={busy}
        onClick={toggle}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={busy ? "open-with-icon open-with-icon--busy" : "open-with-icon"}>
          {busy ? (
            <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 10a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
          ) : (
            <path d="M12 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
          )}
        </svg>
      </button>
      {open && coords && (
        <div
          ref={menuRef}
          className="open-with-menu"
          role="menu"
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          onClick={(event) => event.stopPropagation()}
        >
          {onNavigate && (
            <>
              <button
                className="open-with-item open-with-item--nav"
                role="menuitem"
                onClick={() => { setOpen(false); onNavigate(); }}
              >
                查看详情
              </button>
              <div className="open-with-divider" />
            </>
          )}
          {OPENERS.map((opener) => (
            <button
              key={opener.id}
              className="open-with-item"
              role="menuitem"
              disabled={busyKey === `${busyPrefix}:open:${opener.id}`}
              onClick={() => { setOpen(false); onOpenWith(opener.id); }}
            >
              用 {opener.label} 打开
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
