import type { ReactNode } from "react";
import { cx, ui } from "./styles";

export interface EmptyStateProps {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}

export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
	return (
		<div className={cx("flex flex-col items-center justify-center rounded-sm border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-10 text-center", className)}>
			{icon && <div className="mb-3 text-[var(--app-text-subtle)]">{icon}</div>}
			<h3 className={ui.card.title}>{title}</h3>
			{description && <p className="mt-1 max-w-md text-sm text-[var(--app-text-muted)]">{description}</p>}
			{actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
		</div>
	);
}
