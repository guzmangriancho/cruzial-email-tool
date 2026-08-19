import type { ReactNode } from "react";
import { cx, ui } from "./styles";

export interface FieldProps {
	label?: ReactNode;
	description?: ReactNode;
	error?: ReactNode;
	required?: boolean;
	className?: string;
	children: ReactNode;
}

export function Field({ label, description, error, required, className, children }: FieldProps) {
	return (
		<div className={className}>
			{label && (
				<label className={ui.text.label}>
					{label}
					{required && <span className="ml-1 text-[var(--intent-danger-solid)]">*</span>}
				</label>
			)}

			{children}

			{description && <p className={ui.text.description}>{description}</p>}
			{error && <p className={cx(ui.text.error)}>{error}</p>}
		</div>
	);
}
