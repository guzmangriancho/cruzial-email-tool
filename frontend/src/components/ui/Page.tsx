import type { HTMLAttributes, ReactNode } from "react";
import { cx, ui } from "./styles";

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
	constrained?: boolean;
	fill?: boolean;
}

export function PageShell({
	constrained = false,
	fill = false,
	className,
	...props
}: PageShellProps) {
	const pageClass = fill
		? ui.page.fill
		: constrained
			? ui.page.constrained
			: ui.page.base;

	return <div className={cx(pageClass, className)} {...props} />;
}

export interface PageHeaderProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	"title"
> {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}

export function PageHeader({
	title,
	description,
	actions,
	className,
	...props
}: PageHeaderProps) {
	return (
		<div className={cx(ui.page.header, className)} {...props}>
			<div>
				<h1 className={ui.page.title}>{title}</h1>
				{description && <p className={ui.page.description}>{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</div>
	);
}
