import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx, ui } from "./styles";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	invalid?: boolean;
	variant?: "default" | "compact" | "white";
	containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			className,
			containerClassName,
			leftIcon,
			rightIcon,
			invalid = false,
			variant = "default",
			...props
		},
		ref,
	) => {
		const input = (
			<input
				ref={ref}
				className={cx(
					variant === "compact"
						? ui.field.compact
						: variant === "white"
							? ui.field.white
							: ui.field.base,
					ui.focus,
					!!leftIcon && ui.field.withLeftIcon,
					!!rightIcon && ui.field.withRightIcon,
					invalid && ui.field.error,
					className,
				)}
				{...props}
			/>
		);

		if (!leftIcon && !rightIcon) return input;

		return (
			<div className={cx("relative", containerClassName)}>
				{leftIcon && (
					<span className={cx(ui.field.icon, "left-3")}>{leftIcon}</span>
				)}
				{input}
				{rightIcon && (
					<span className={cx(ui.field.icon, "right-3")}>{rightIcon}</span>
				)}
			</div>
		);
	},
);

Input.displayName = "Input";
