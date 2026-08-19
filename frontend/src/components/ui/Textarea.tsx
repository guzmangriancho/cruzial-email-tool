import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx, ui } from "./styles";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	invalid?: boolean;
	variant?: "default" | "compact" | "white";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, invalid = false, variant = "default", ...props }, ref) => (
		<textarea
			ref={ref}
			className={cx(
				"resize-none",
				variant === "compact" ? ui.field.compact : variant === "white" ? ui.field.white : ui.field.base,
				ui.focus,
				invalid && ui.field.error,
				className,
			)}
			{...props}
		/>
	),
);

Textarea.displayName = "Textarea";
