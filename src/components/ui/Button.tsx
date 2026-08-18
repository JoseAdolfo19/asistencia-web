export type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-lg font-semibold transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-blue-900 text-white hover:bg-blue-800",
  secondary: "border border-slate-300 text-slate-600 hover:bg-slate-100",
  success: "bg-green-700 text-white hover:bg-green-600",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost: "text-slate-600 hover:bg-slate-100",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "w-full px-3 py-2 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
}
