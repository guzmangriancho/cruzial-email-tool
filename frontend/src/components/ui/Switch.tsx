import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cx, ui } from "./styles";

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
	checked?: boolean;
	onChange?: (checked: boolean) => void;
	label?: ReactNode;
	description?: ReactNode;
	align?: "start" | "center";
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
	(
		{
			checked = false,
			onChange,
			label,
			description,
			align = "start",
			className,
			disabled,
			type = "button",
			...props
		},
		ref,
	) => (
		<button
			ref={ref}
			type={type}
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange?.(!checked)}
			className={cx(
				"group flex w-full gap-3 rounded-sm border px-4 py-3 text-left transition",
				checked
					? "border-[var(--app-primary-border)] bg-[var(--app-primary-soft)]"
					: "border-[var(--app-border)] bg-[var(--app-surface-muted)] hover:bg-[var(--intent-neutral-bg)]",
				disabled && "cursor-not-allowed opacity-60",
				className,
			)}
			{...props}
		>
			<span
				className={cx(
					"relative mt-0.5 flex h-6 w-11 shrink-0 rounded-full p-0.5 transition",
					checked ? "bg-[var(--app-primary)]" : "bg-[var(--app-border-strong)]",
					align === "center" && "mt-0",
				)}
			>
				<span
					className={cx(
						"flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] transition-transform",
						checked && "translate-x-5",
					)}
				>
					{checked && <Check size={12} className="text-[var(--app-primary)]" />}
				</span>
			</span>

			{(label || description) && (
				<span className="min-w-0 flex-1">
					{label && <span className="block text-sm font-medium text-[var(--app-text)]">{label}</span>}
					{description && (
						<span className="mt-0.5 block text-xs leading-relaxed text-[var(--app-text-muted)]">
							{description}
						</span>
					)}
				</span>
			)}
		</button>
	),
);

Switch.displayName = "Switch";
