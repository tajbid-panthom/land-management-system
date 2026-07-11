const variants = {
  default: "bg-sky-100 text-slate-700",
  success: "bg-teal-100 text-teal-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
} as const;

export function StatusBadge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {label}
    </span>
  );
}

export function statusVariant(
  status: string,
): keyof typeof variants {
  switch (status) {
    case "verified":
    case "approved":
    case "active":
    case "completed":
      return "success";
    case "pending":
    case "applied":
    case "under_review":
    case "under_hearing":
      return "warning";
    case "rejected":
    case "disputed":
    case "defaulted":
      return "danger";
    default:
      return "default";
  }
}
