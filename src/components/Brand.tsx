import { Shield } from "lucide-react";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 font-bold ${className}`}>
      <Shield aria-hidden="true" className="size-6 shrink-0 text-blue-400" strokeWidth={2.5} />
      <span className="truncate">ODISSEIABOT</span>
    </span>
  );
}
