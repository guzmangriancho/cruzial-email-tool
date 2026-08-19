import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx, ui } from "./styles";

type IconButtonVariant = keyof typeof ui.button.variant;
type IconButtonSize = "xs" | "sm" | "md";

const iconButtonSize: Record<IconButtonSize, keyof typeof ui.button.size> = {
	xs: "iconXs",
	sm: "iconSm",
	md: "icon",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: IconButtonVariant;
	buttonSize?: IconButtonSize;
	label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	(
		{
			className,
			variant = "ghost",
			buttonSize = "md",
			label,
			children,
			type = "button",
			...props
		},
		ref,
	) => (
		<button
			ref={ref}
			type={type}
			aria-label={label}
			title={props.title || label}
			className={cx(
				ui.button.base,
				ui.button.variant[variant],
				ui.button.size[iconButtonSize[buttonSize]],
				className,
			)}
			{...props}
		>
			{children}
		</button>
	),
);

IconButton.displayName = "IconButton";
