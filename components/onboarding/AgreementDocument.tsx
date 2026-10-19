import PrintButton from "./PrintButton";

export type SignedAgreement = {
  agreement_title: string;
  agreement_text: string;
  agreement_version: number;
  signer_name: string;
  signed_at: string;
  countersigner_name: string | null;
  countersigned_at: string | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

// The signed agreement laid out as a document, with both signatures.
// Prints cleanly (or "Save as PDF") from the browser's print dialog.
export default function AgreementDocument({
  agreement,
  signatureUrl,
  countersignatureUrl,
  backHref,
}: {
  agreement: SignedAgreement;
  signatureUrl: string | null;
  countersignatureUrl: string | null;
  backHref: string;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <a href={backHref} className="text-sm text-accent hover:underline">
          ← Back
        </a>
        <PrintButton />
      </div>

      <article className="rounded-lg border border-border bg-white p-8 text-[13px] leading-6 text-neutral-900 print:border-0 print:p-0">
        <h1 className="mb-6 text-center text-xl font-semibold">{agreement.agreement_title}</h1>
        <div className="whitespace-pre-wrap">{agreement.agreement_text}</div>

        <div className="mt-10 grid gap-8 border-t border-neutral-300 pt-6 sm:grid-cols-2 print:grid-cols-2">
          <SignatureBlock
            heading="Client"
            name={agreement.signer_name}
            signedAt={agreement.signed_at}
            imageUrl={signatureUrl}
          />
          <SignatureBlock
            heading="For LB Collective LTD"
            name={agreement.countersigner_name}
            signedAt={agreement.countersigned_at}
            imageUrl={countersignatureUrl}
          />
        </div>
        <p className="mt-8 text-[11px] text-neutral-500">
          Signed electronically through the LBC Creator Portal · agreement version {agreement.agreement_version}
        </p>
      </article>
    </main>
  );
}

function SignatureBlock({
  heading,
  name,
  signedAt,
  imageUrl,
}: {
  heading: string;
  name: string | null;
  signedAt: string | null;
  imageUrl: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{heading}</p>
      {signedAt && imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={`Signature of ${name ?? ""}`} className="h-20 w-auto self-start" />
      ) : (
        <div className="flex h-20 items-end text-neutral-400">Awaiting signature</div>
      )}
      <div className="border-t border-neutral-400 pt-1">
        <p className="font-medium">{name ?? "—"}</p>
        <p className="text-neutral-600">{signedAt ? formatDateTime(signedAt) : "Not signed yet"}</p>
      </div>
    </div>
  );
}
