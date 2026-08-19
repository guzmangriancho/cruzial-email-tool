import type { HTMLAttributes, ReactNode } from "react";
import { cx, ui } from "./styles";

type StatusKind = keyof typeof ui.status;

const campaignStatusMap: Record<string, StatusKind> = {
	Borrador: "draft",
	Preparada: "ready",
	"En Progreso": "running",
	Pausada: "paused",
	Completada: "completed",
	Error: "error",
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
	status?: ReactNode;
	kind?: StatusKind;
}

export function getCampaignStatusClass(status?: string | null) {
	return ui.status[status ? campaignStatusMap[status] || "unknown" : "unknown"];
}

export function StatusBadge({ status, kind, className, children, ...props }: StatusBadgeProps) {
	const statusText = status === null || status === undefined ? undefined : String(status);
	const resolvedKind = kind || (statusText ? campaignStatusMap[statusText] : undefined) || "unknown";

	return (
		<span
			className={cx("inline-flex items-center rounded-sm border px-2 py-1 text-[11px] font-medium", ui.status[resolvedKind], className)}
			{...props}
		>
			{children ?? status ?? "Sin estado"}
		</span>
	);
}
