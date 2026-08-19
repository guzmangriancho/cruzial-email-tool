import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cx, ui } from "./styles";

type ButtonVariant = keyof typeof ui.button.variant;
type ButtonSize = keyof typeof ui.button.size;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	isLoading?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant = "secondary",
			size = "md",
			isLoading = false,
			leftIcon,
			rightIcon,
			children,
			disabled,
			type = "button",
			...props
		},
		ref,
	) => (
		<button
			ref={ref}
			type={type}
			disabled={disabled || isLoading}
			className={cx(
				ui.button.base,
				ui.button.variant[variant],
				ui.button.size[size],
				className,
			)}
			{...props}
		>
			{isLoading ? <Loader2 size={17} className="animate-spin" /> : leftIcon}
			{children}
			{rightIcon}
		</button>
	),
);

Button.displayName = "Button";
