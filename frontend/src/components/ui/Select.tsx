import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx, ui } from "./styles";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	leftIcon?: ReactNode;
	invalid?: boolean;
	variant?: "default" | "compact" | "white";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	({ className, leftIcon, invalid = false, variant = "default", children, ...props }, ref) => {
		const select = (
			<select
				ref={ref}
				className={cx(
					variant === "compact" ? ui.field.compact : variant === "white" ? ui.field.white : ui.field.base,
					ui.focus,
					leftIcon && ui.field.withLeftIcon,
					invalid && ui.field.error,
					className,
				)}
				{...props}
			>
				{children}
			</select>
		);

		if (!leftIcon) return select;

		return (
			<div className="relative">
				<span className={cx(ui.field.icon, "left-3")}>
					{leftIcon}
				</span>
				{select}
			</div>
		);
	},
);

Select.displayName = "Select";
