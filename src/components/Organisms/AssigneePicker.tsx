import { useState, useEffect, useRef } from "react";
import { getInitials } from "../../lib/initials";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number | string;
  name: string;
  role?: string;
}

interface AssigneePickerProps {
  users?: User[];
  value?: User | null;
  onChange?: (user: User | null) => void;
  width?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS: { bg: string; fg: string }[] = [
  { bg: "#CEDBF6", fg: "#0C447C" },
  { bg: "#C0E8D5", fg: "#085041" },
  { bg: "#F5D0C0", fg: "#3C1D0C" },
  { bg: "#E6D6F5", fg: "#3C3489" },
  { bg: "#FAE0D5", fg: "#993C1D" },
  { bg: "#D0EEE6", fg: "#0F6E56" },
];

const NO_ASSIGNEE: User = { id: "__none__", name: "Sin asignar", role: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorFor(id: string | number): { bg: string; fg: string } {
  const n = typeof id === "number" ? id : id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  user: User | null;
  size?: "sm" | "md";
}

function Avatar({ user, size = "sm" }: AvatarProps) {
  const sizeClass = size === "sm" ? "w-[22px] h-[22px] text-[10px]" : "w-8 h-8 text-xs";

  if (!user || user.id === "__none__") {
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center font-medium shrink-0 bg-gray-200 text-gray-400`}>
        —
      </div>
    );
  }

  const c = colorFor(user.id);
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-medium shrink-0`}
      style={{ background: c.bg, color: c.fg }}
    >
      {getInitials(user.name)}
    </div>
  );
}

// ─── AssigneePicker ───────────────────────────────────────────────────────────

export default function AssigneePicker({
  users = [],
  value,
  onChange,
  width = "w-56",
}: AssigneePickerProps) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalSelected, setInternalSelected] = useState<User | null>(null);

  const selected = isControlled ? value : internalSelected;
  const setSelected = isControlled ? onChange! : setInternalSelected;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (open && rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  const allOptions: User[] = [NO_ASSIGNEE, ...users];

  const filtered = allOptions.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      (u.role ?? "").toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(user: User): void {
    setSelected(user.id === "__none__" ? null : user);
    setOpen(false);
  }

  const isOptionSelected = (u: User): boolean =>
    u.id === "__none__" ? !selected : selected?.id === u.id;

  return (
    <div ref={rootRef} className={`relative ${width}`}>
      {/* Trigger */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-2.5 py-2 text-[13px] rounded-md border border-gray-200 bg-gray-50 text-gray-900 cursor-pointer transition-colors hover:border-gray-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Avatar user={selected ?? null} />
        <span className={`flex-1 text-left truncate text-sm ${selected ? "text-gray-900 font-medium" : "text-gray-400"}`}>
          {selected ? selected.name : "Sin asignar"}
        </span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute top-[calc(100%+4px)] left-0 w-64 z-50 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar usuario..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0047AC] transition-colors"
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</p>
            ) : (
              filtered.map((u) => {
                const isSel = isOptionSelected(u);
                const subtitle = u.role || "";
                return (
                  <div
                    key={String(u.id)}
                    role="option"
                    aria-selected={isSel}
                    onClick={() => handleSelect(u)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSel ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <Avatar user={u.id === "__none__" ? null : u} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate font-medium ${isSel ? "text-[#0047AC]" : "text-gray-900"}`}>
                        {u.name}
                      </p>
                      {subtitle && (
                        <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
                      )}
                    </div>
                    {isSel && <span className="ml-auto text-[11px] text-[#0047AC] font-bold">✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
