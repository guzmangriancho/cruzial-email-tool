import type { HTMLAttributes } from "react";
import { cx, ui } from "./styles";

type BadgeVariant = keyof typeof ui.badge.variant;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
	return <span className={cx(ui.badge.base, ui.badge.variant[variant], className)} {...props} />;
}
