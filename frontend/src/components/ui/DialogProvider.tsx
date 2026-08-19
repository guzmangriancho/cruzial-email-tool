import {
	createContext,
	isValidElement,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { cx } from "./styles";

type DialogTone = "info" | "success" | "warning" | "danger";

type DialogInput = ReactNode | DialogOptions;

interface DialogOptions {
	title?: ReactNode;
	description?: ReactNode;
	tone?: DialogTone;
	confirmLabel?: string;
	cancelLabel?: string;
}

interface PendingDialog extends Required<Pick<DialogOptions, "tone">> {
	id: number;
	kind: "alert" | "confirm";
	title: ReactNode;
	description?: ReactNode;
	confirmLabel: string;
	cancelLabel: string;
	resolve: (value: boolean) => void;
}

interface DialogContextValue {
	alert: (input: DialogInput) => Promise<void>;
	confirm: (input: DialogInput) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const toneIcon = {
	info: <Info size={22} />,
	success: <CheckCircle2 size={22} />,
	warning: <AlertTriangle size={22} />,
	danger: <XCircle size={22} />,
};

const toneIconClass = {
	info: "bg-[var(--intent-info-bg)] text-[var(--intent-info-text)]",
	success: "bg-[var(--intent-success-bg)] text-[var(--intent-success-text)]",
	warning: "bg-[var(--intent-warning-bg)] text-[var(--intent-warning-text)]",
	danger: "bg-[var(--intent-danger-bg)] text-[var(--intent-danger-text)]",
};

const confirmVariant = {
	info: "primary",
	success: "success",
	warning: "warning",
	danger: "dangerSolid",
} as const;

function esDialogOptions(input: DialogInput): input is DialogOptions {
	return (
		typeof input === "object" &&
		input !== null &&
		!Array.isArray(input) &&
		!isValidElement(input) &&
		("title" in input ||
			"description" in input ||
			"tone" in input ||
			"confirmLabel" in input ||
			"cancelLabel" in input)
	);
}

function normalizarDialogo(kind: PendingDialog["kind"], input: DialogInput): Omit<PendingDialog, "id" | "resolve"> {
	const opciones = esDialogOptions(input)
		? input
		: ({ description: input } as DialogOptions);

	const tone = opciones.tone ?? (kind === "confirm" ? "warning" : "info");

	return {
		kind,
		tone,
		title:
			opciones.title ??
			(kind === "confirm" ? "Confirmar acción" : tone === "success" ? "Todo correcto" : tone === "danger" ? "Ha ocurrido un problema" : "Aviso"),
		description: opciones.description,
		confirmLabel: opciones.confirmLabel ?? (kind === "confirm" ? "Confirmar" : "Entendido"),
		cancelLabel: opciones.cancelLabel ?? "Cancelar",
	};
}

function DialogDescription({ children }: { children?: ReactNode }) {
	if (!children) return null;

	if (typeof children === "string") {
		return (
			<div className="space-y-2 text-sm leading-6 text-[var(--app-text-muted)]">
				{children.split("\n").map((line, index) => (
					<p key={`${line}-${index}`}>{line}</p>
				))}
			</div>
		);
	}

	return <div className="text-sm leading-6 text-[var(--app-text-muted)]">{children}</div>;
}

export function DialogProvider({ children }: { children: ReactNode }) {
	const [current, setCurrent] = useState<PendingDialog | null>(null);
	const currentRef = useRef<PendingDialog | null>(null);
	const queueRef = useRef<PendingDialog[]>([]);
	const idRef = useRef(0);

	const showNext = useCallback(() => {
		const next = queueRef.current.shift() ?? null;
		currentRef.current = next;
		setCurrent(next);
	}, []);

	const openDialog = useCallback(
		(kind: PendingDialog["kind"], input: DialogInput) =>
			new Promise<boolean>((resolve) => {
				const item: PendingDialog = {
					id: idRef.current + 1,
					...normalizarDialogo(kind, input),
					resolve,
				};

				idRef.current = item.id;

				if (currentRef.current) {
					queueRef.current.push(item);
					return;
				}

				currentRef.current = item;
				setCurrent(item);
			}),
		[],
	);

	const completeDialog = useCallback(
		(value: boolean) => {
			if (!currentRef.current) return;

			currentRef.current.resolve(value);
			showNext();
		},
		[showNext],
	);

	const value = useMemo<DialogContextValue>(
		() => ({
			alert: async (input) => {
				await openDialog("alert", input);
			},
			confirm: (input) => openDialog("confirm", input),
		}),
		[openDialog],
	);

	return (
		<DialogContext.Provider value={value}>
			{children}

			<Modal
				open={Boolean(current)}
				onClose={() => completeDialog(false)}
				size="sm"
				showCloseButton={false}
				className="animate-in fade-in-0 zoom-in-95 duration-200"
				bodyClassName="px-6 py-6"
			>
				{current && (
					<div className="space-y-5">
						<div className="flex items-start gap-4">
							<div
								className={cx(
									"flex h-11 w-11 shrink-0 items-center justify-center rounded-sm",
									toneIconClass[current.tone],
								)}
							>
								{current.kind === "confirm" && current.tone === "info" ? <HelpCircle size={22} /> : toneIcon[current.tone]}
							</div>

							<div className="min-w-0 flex-1">
								<h2 className="text-lg font-medium tracking-tight text-[var(--app-text)]">
									{current.title}
								</h2>
								<div className="mt-2">
									<DialogDescription>{current.description}</DialogDescription>
								</div>
							</div>
						</div>

						<div className="flex flex-col-reverse gap-3 border-t border-[var(--app-border)] pt-4 sm:flex-row sm:justify-end">
							{current.kind === "confirm" && (
								<Button variant="secondary" onClick={() => completeDialog(false)}>
									{current.cancelLabel}
								</Button>
							)}

							<Button
								variant={current.kind === "confirm" ? confirmVariant[current.tone] : "primary"}
								onClick={() => completeDialog(true)}
							>
								{current.confirmLabel}
							</Button>
						</div>
					</div>
				)}
			</Modal>
		</DialogContext.Provider>
	);
}

export function useDialog() {
	const context = useContext(DialogContext);

	if (!context) {
		throw new Error("useDialog debe usarse dentro de DialogProvider.");
	}

	return context;
}
