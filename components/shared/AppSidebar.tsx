"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function AppSidebar({
  navItems,
  displayName,
  role,
  signOutAction,
}: {
  navItems: { href: string; label: string }[];
  displayName: string;
  role: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Lola's Bunny Collective" width={28} height={29} priority />
          <span className="text-sm font-semibold tracking-tight">Creator Portal</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-foreground hover:bg-surface-raised"
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-2 text-sm font-semibold tracking-tight">Creator Portal</div>
        <div className="mt-6 flex justify-center">
          <Image src="/logo.png" alt="Lola's Bunny Collective" width={80} height={83} priority />
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 px-2">
          <ThemeToggle />
          <div className="text-xs text-muted">
            {displayName}
            <div className="text-[11px] uppercase tracking-wide">{role.replace("_", " ")}</div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
