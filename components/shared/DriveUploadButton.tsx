export default function DriveUploadButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
    >
      {label}
    </a>
  );
}
