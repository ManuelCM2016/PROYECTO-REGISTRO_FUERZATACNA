export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-700/50 rounded-lg skeleton-pulse ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3"><SkeletonLine className="h-4 w-24" /></td>
      <td className="px-4 py-3"><SkeletonLine className="h-4 w-32" /></td>
      <td className="px-4 py-3"><SkeletonLine className="h-4 w-28" /></td>
      <td className="px-4 py-3"><SkeletonLine className="h-4 w-20" /></td>
      <td className="px-4 py-3"><SkeletonLine className="h-6 w-16 rounded-full" /></td>
    </tr>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {Array.from({ length: 5 }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <SkeletonLine className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
