import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cx, ui } from "./styles";

const modalSizes = {
	sm: "max-w-md",
	md: "max-w-2xl",
	lg: "max-w-3xl",
	xl: "max-w-5xl",
	full: "max-w-[96rem]",
};

export interface ModalProps {
	open: boolean;
	title?: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
	size?: keyof typeof modalSizes;
	closeDisabled?: boolean;
	className?: string;
	bodyClassName?: string;
	headerClassName?: string;
	footerClassName?: string;
	showCloseButton?: boolean;
}

export function Modal({
	open,
	title,
	description,
	icon,
	onClose,
	children,
	footer,
	size = "md",
	closeDisabled = false,
	className,
	bodyClassName,
	headerClassName,
	footerClassName,
	showCloseButton = true,
}: ModalProps) {
	useEffect(() => {
		if (!open || closeDisabled) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [closeDisabled, onClose, open]);

	if (!open) return null;

	return (
		<div className={ui.modal.overlay} role="dialog" aria-modal="true">
			<div className={cx(ui.modal.panel, modalSizes[size], className)}>
				{(title || description || showCloseButton) && (
					<div className={cx(ui.modal.header, headerClassName)}>
						<div className="flex items-start gap-3">
							{icon && (
								<div className={ui.modal.icon}>
									{icon}
								</div>
							)}

							<div>
								{title && <h2 className="text-xl font-medium text-[var(--app-text)]">{title}</h2>}
								{description && <p className="mt-1 max-w-2xl text-sm text-[var(--app-text-muted)]">{description}</p>}
							</div>
						</div>

						{showCloseButton && (
							<IconButton label="Cerrar" onClick={onClose} disabled={closeDisabled}>
								<X size={20} />
							</IconButton>
						)}
					</div>
				)}

				<div className={cx(ui.modal.body, bodyClassName)}>{children}</div>

				{footer && <div className={cx(ui.modal.footer, footerClassName)}>{footer}</div>}
			</div>
		</div>
	);
}
