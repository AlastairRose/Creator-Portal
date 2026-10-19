"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { createDocumentUploadUrl, saveOnboardingDetails, type DetailsInput } from "@/lib/actions/onboarding";

const inputClass =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

type DocKind = "id_document" | "proof_of_address";
type UploadedDoc = DetailsInput["documents"][number];
type Login = { platform: string; username: string; password: string; notes: string };

export default function DetailsStep({ defaultEmail, onDone }: { defaultEmail: string; onDone: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [logins, setLogins] = useState<Login[]>([{ platform: "OnlyFans", username: "", password: "", notes: "" }]);
  const [noOnlyfansYet, setNoOnlyfansYet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function upload(kind: DocKind, files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(kind);
    try {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is over 20MB. Please use a smaller photo or PDF.`);
        const type = file.type || "application/octet-stream";
        const ticket = await createDocumentUploadUrl(kind, file.name, type);
        if (ticket.error || !ticket.path || !ticket.token) throw new Error(ticket.error ?? "Couldn't start the upload.");
        const { error } = await supabase.storage
          .from("creator-onboarding")
          .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: type });
        if (error) throw new Error(error.message);
        setDocs((d) => [...d, { kind, path: ticket.path!, name: file.name, type }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  function setLogin(i: number, patch: Partial<Login>) {
    setLogins((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const { error } = await saveOnboardingDetails({
        firstName,
        lastName,
        phone,
        email,
        documents: docs,
        logins,
        noOnlyfansYet,
      });
      if (error) setError(error);
      else onDone();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="Your details">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputClass} />
          </Field>
          <Field label="Last name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputClass} />
          </Field>
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="Include your country code, e.g. +61" className={inputClass} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section
        title="Age verification"
        note="Only management can see these files. They're stored privately and used to verify that you're over 18."
      >
        <DocUpload
          label="Photo ID (passport or driving licence)"
          hint="Upload the front, and the back too if it has one."
          kind="id_document"
          docs={docs}
          uploading={uploading === "id_document"}
          onFiles={upload}
        />
        <DocUpload
          label="Proof of address"
          hint="A recent bank statement or utility bill showing your name and address."
          kind="proof_of_address"
          docs={docs}
          uploading={uploading === "proof_of_address"}
          onFiles={upload}
        />
      </Section>

      <Section
        title="Account logins"
        note="So our team can manage your accounts. Passwords are encrypted, and only the agency owner can view them."
      >
        <div className="flex flex-col gap-3">
          {logins.map((login, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
              <Field label="Account">
                <input
                  value={login.platform}
                  onChange={(e) => setLogin(i, { platform: e.target.value })}
                  placeholder="e.g. Instagram"
                  className={inputClass}
                />
              </Field>
              <Field label="Username or email">
                <input
                  value={login.username}
                  onChange={(e) => setLogin(i, { username: e.target.value })}
                  autoComplete="off"
                  autoCapitalize="none"
                  className={inputClass}
                />
              </Field>
              <Field label="Password">
                <input
                  value={login.password}
                  onChange={(e) => setLogin(i, { password: e.target.value })}
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-3 flex items-center gap-2">
                <input
                  value={login.notes}
                  onChange={(e) => setLogin(i, { notes: e.target.value })}
                  placeholder="Notes (optional), e.g. two-factor is sent to my phone"
                  className={inputClass}
                />
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => setLogins((ls) => ls.filter((_, j) => j !== i))}
                    className="shrink-0 text-xs text-danger hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLogins((ls) => [...ls, { platform: "", username: "", password: "", notes: "" }])}
            className="self-start rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-raised"
          >
            + Add another account
          </button>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={noOnlyfansYet} onChange={(e) => setNoOnlyfansYet(e.target.checked)} />
            I don&apos;t have an OnlyFans account yet
          </label>
        </div>
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={isPending || uploading !== null}
        className="w-full rounded-md bg-accent px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save and continue"}
      </button>
    </div>
  );
}

function DocUpload({
  label,
  hint,
  kind,
  docs,
  uploading,
  onFiles,
}: {
  label: string;
  hint: string;
  kind: DocKind;
  docs: UploadedDoc[];
  uploading: boolean;
  onFiles: (kind: DocKind, files: FileList | null) => void;
}) {
  const mine = docs.filter((d) => d.kind === kind);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
      <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border px-3 py-4 text-sm hover:bg-surface-raised">
        {uploading ? "Uploading…" : mine.length > 0 ? "+ Add another file" : "Choose a photo or PDF"}
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            onFiles(kind, e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {mine.map((d) => (
        <span key={d.path} className="text-xs text-success">
          ✓ {d.name}
        </span>
      ))}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}
