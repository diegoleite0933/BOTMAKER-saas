export function HelmetMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex size-7 shrink-0 items-center justify-center text-[#1683ff] ${className}`}>
      <span aria-hidden="true" className="absolute left-[43%] top-[2%] h-[34%] w-[14%] bg-gradient-to-b from-[#91d2ff] to-[#1683ff]" style={{ clipPath: "polygon(50% 0, 100% 18%, 76% 100%, 24% 100%, 0 18%)" }} />
      <span aria-hidden="true" className="absolute inset-x-[14%] bottom-[7%] top-[19%] bg-gradient-to-b from-[#58b4ff] via-[#1683ff] to-[#0753b4]" style={{ clipPath: "polygon(50% 0, 83% 9%, 100% 29%, 91% 67%, 72% 87%, 50% 100%, 28% 87%, 9% 67%, 0 29%, 17% 9%)" }} />
      <span aria-hidden="true" className="absolute left-[22%] top-[40%] h-[15%] w-[56%] bg-[#071421]" style={{ clipPath: "polygon(10% 0, 90% 0, 100% 45%, 78% 100%, 22% 100%, 0 45%)" }} />
      <span aria-hidden="true" className="absolute left-[30%] top-[45%] h-[2px] w-[16%] bg-[#83ceff]" />
      <span aria-hidden="true" className="absolute right-[30%] top-[45%] h-[2px] w-[16%] bg-[#83ceff]" />
      <span aria-hidden="true" className="absolute left-[39%] top-[58%] h-[24%] w-[22%] bg-[#06111c]" style={{ clipPath: "polygon(0 0, 100% 0, 78% 80%, 50% 100%, 22% 80%)" }} />
    </span>
  );
}

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 font-bold ${className}`}>
      <HelmetMark />
      <span className="truncate">ODISSEIABOT</span>
    </span>
  );
}
