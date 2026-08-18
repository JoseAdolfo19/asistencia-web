export type BadgeVariant = "green" | "amber" | "red" | "blue" | "slate";

const styles: Record<BadgeVariant, string> = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-800",
  slate: "bg-slate-100 text-slate-600",
};

export default function Badge({
  variant = "slate",
  children,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
