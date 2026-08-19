import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx, ui, type UiTone } from "./styles";

export interface StatCardProps {
	label: ReactNode;
	value: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	tone?: UiTone;
	trend?: ReactNode;
	className?: string;
	valueClassName?: string;
}

export function StatCard({
	label,
	value,
	description,
	icon,
	tone = "info",
	trend,
	className,
	valueClassName,
}: StatCardProps) {
	return (
		<Card className={cx("group p-4 transition hover:-translate-y-0.5 hover:shadow-md", className)}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-[13px] font-semibold text-[var(--app-text-muted)]">
						{label}
					</p>
					<p className={cx("mt-2 text-2xl font-medium tracking-tight text-[var(--app-text)] xl:text-3xl", valueClassName)}>
						{value}
					</p>
					{description && (
						<p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">
							{description}
						</p>
					)}
					{trend && <div className="mt-2 text-xs font-semibold text-[var(--intent-success-text)]">{trend}</div>}
				</div>

				{icon && (
					<div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border", ui.tone[tone])}>
						{icon}
					</div>
				)}
			</div>
		</Card>
	);
}
