import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { MapPin, Plus, X } from "lucide-react";

import { Badge, Button, Card, IconButton, Input, cx, ui, type UiTone } from "../ui";
import {
	PROVINCIAS_FRECUENTES,
	UBICACION_PRESETS,
	normalizarComparacion,
	presetActivoPorItems,
	presetPorId,
	type UbicacionPreset,
} from "../../config/scraperPresets";

export function StatusPill({
	estado,
}: {
	estado: { label: string; className: string; dot: string };
}) {
	return (
		<span
			className={cx(
				ui.badge.base,
				"h-10 rounded-sm border px-4 text-sm shadow-sm",
				estado.className,
			)}
		>
			<span className={`h-2 w-2 rounded-full ${estado.dot}`} />
			{estado.label}
		</span>
	);
}

export function MetricCard({
	icon,
	label,
	value,
	description,
	tone = "info",
}: {
	icon: ReactNode;
	label: string;
	value: number | string;
	description: string;
	tone?: UiTone;
}) {
	return (
		<Card className="p-5">
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="text-sm font-semibold text-[var(--app-text-muted)]">{label}</p>
					<p className="mt-2 text-3xl font-medium text-[var(--app-text)]">{value}</p>
					<p className="mt-1 text-xs text-[var(--app-text-muted)]">{description}</p>
				</div>

				<div className={cx("rounded-sm p-3", ui.tone[tone])}>{icon}</div>
			</div>
		</Card>
	);
}


export function ChipInput({
	label,
	placeholder,
	value,
	onValueChange,
	items,
	onAdd,
	onRemove,
	disabled,
	variant,
}: {
	label: string;
	placeholder: string;
	value: string;
	onValueChange: (value: string) => void;
	items: string[];
	onAdd: (event?: FormEvent | KeyboardEvent) => void;
	onRemove: (item: string) => void;
	disabled: boolean;
	variant: "blue" | "emerald";
}) {
	const chipTone = variant === "blue" ? "info" : "success";
	const chipClass = ui.tone[chipTone];

	return (
		<div>
			<div className="mb-2 flex items-center justify-between gap-2">
				<label className="text-sm font-medium text-[var(--app-text)]">{label}</label>
				<span className="text-xs font-semibold text-[var(--app-text-subtle)]">
					{items.length} añadidos
				</span>
			</div>

			<div className="flex gap-2">
				<Input
					type="text"
					value={value}
					onChange={(event) => onValueChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") onAdd(event);
					}}
					placeholder={placeholder}
					disabled={disabled}
					variant="white"
					className="min-w-0 flex-1"
				/>

				<IconButton
					type="button"
					onClick={() => onAdd()}
					disabled={disabled || !value.trim()}
					variant="secondary"
					buttonSize="md"
					label={`Añadir ${label.toLowerCase()}`}
				>
					<Plus size={18} />
				</IconButton>
			</div>

			<div className="mt-3 flex flex-wrap gap-1.5 min-h-[28px]">
				{items.length === 0 ? (
					<span className="text-xs text-[var(--app-text-subtle)]">
						Aún no hay elementos añadidos.
					</span>
				) : (
					items.map((item) => (
						<Badge
							key={item}
							className={`border ${chipClass}`}
						>
							{item}
							<button
								type="button"
								onClick={() => onRemove(item)}
								disabled={disabled}
								className="rounded-full hover:bg-black/5 disabled:opacity-50"
							>
								<X size={13} />
							</button>
						</Badge>
					))
				)}
			</div>
		</div>
	);
}

export function UbicacionesPresetButton({
	ubicacionesSeleccionadas,
	presetsSeleccionados,
	disabled,
	onOpenMap,
	onClear,
}: {
	ubicacionesSeleccionadas: string[];
	presetsSeleccionados: string[];
	disabled: boolean;
	onOpenMap: () => void;
	onClear: () => void;
}) {
	const presetsActivos = presetsSeleccionados
		.map((id) => presetPorId(id))
		.filter((preset): preset is UbicacionPreset => Boolean(preset));
	const cubiertas = new Set(
		presetsActivos.flatMap((preset) => preset.items.map(normalizarComparacion)),
	);
	const ubicacionesSueltas = ubicacionesSeleccionadas.filter(
		(ubicacion) => !cubiertas.has(normalizarComparacion(ubicacion)),
	);

	const resumen =
		presetsActivos.length > 0
			? `${presetsActivos.length} preset${presetsActivos.length === 1 ? "" : "s"}${
					ubicacionesSueltas.length > 0
						? ` · ${ubicacionesSueltas.length} extra`
						: ""
				}`
			: ubicacionesSeleccionadas.length > 0
				? `${ubicacionesSeleccionadas.length} ubicaciones`
				: "Añade zonas rápido";

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)]/70 px-3 py-2">
			<Button
				type="button"
				onClick={onOpenMap}
				disabled={disabled}
				variant="secondary"
				size="xs"
				leftIcon={<MapPin size={14} />}
			>
				Presets de zonas
			</Button>

			<div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--app-text-subtle)]">
				<span>{resumen}</span>

				{ubicacionesSeleccionadas.length > 0 && (
					<button
						type="button"
						onClick={onClear}
						disabled={disabled}
						className="font-medium text-[var(--app-text-muted)] underline-offset-2 transition hover:text-red-600 hover:underline disabled:opacity-50"
					>
						Limpiar
					</button>
				)}
			</div>
		</div>
	);
}

export function MapaUbicacionesModal({
	ubicacionesSeleccionadas,
	presetsSeleccionados,
	disabled,
	onClose,
	onTogglePreset,
	onToggleUbicacion,
	onClear,
}: {
	ubicacionesSeleccionadas: string[];
	presetsSeleccionados: string[];
	disabled: boolean;
	onClose: () => void;
	onTogglePreset: (preset: UbicacionPreset) => void;
	onToggleUbicacion: (ubicacion: string) => void;
	onClear: () => void;
}) {
	const seleccionadasNormalizadas = new Set(
		ubicacionesSeleccionadas.map(normalizarComparacion),
	);
	const presetsActivos = UBICACION_PRESETS.filter((preset) =>
		presetActivoPorItems(
			preset,
			presetsSeleccionados,
			ubicacionesSeleccionadas,
		),
	);
	const cubiertasPorPreset = new Set(
		presetsActivos.flatMap((preset) => preset.items.map(normalizarComparacion)),
	);
	const ubicacionesSueltas = ubicacionesSeleccionadas.filter(
		(ubicacion) => !cubiertasPorPreset.has(normalizarComparacion(ubicacion)),
	);
	const haySeleccion =
		presetsActivos.length > 0 || ubicacionesSueltas.length > 0;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--app-overlay)] p-4">
			<div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] shadow-[var(--app-shadow-lg)]">
				<div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						{haySeleccion ? (
							<>
								{presetsActivos.map((preset) => (
									<span
										key={preset.id}
										className="rounded-sm bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
									>
										{preset.nombre}
									</span>
								))}

								{ubicacionesSueltas.slice(0, 6).map((ubicacion) => (
									<span
										key={ubicacion}
										className="rounded-sm bg-gray-100 px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)]"
									>
										{ubicacion}
									</span>
								))}

								{ubicacionesSueltas.length > 6 && (
									<span className="rounded-sm bg-gray-100 px-2.5 py-1 text-xs font-medium text-[var(--app-text-muted)]">
										+{ubicacionesSueltas.length - 6}
									</span>
								)}
							</>
						) : (
							<span className="text-sm font-medium text-[var(--app-text-muted)]">
								Selecciona zonas
							</span>
						)}
					</div>

					<div className="flex shrink-0 items-center gap-2">
						{ubicacionesSeleccionadas.length > 0 && (
							<Button
								type="button"
								onClick={onClear}
								disabled={disabled}
								variant="secondary"
								size="xs"
							>
								Limpiar
							</Button>
						)}

						<button
							type="button"
							onClick={onClose}
							className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-2 text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
							aria-label="Cerrar presets"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-surface-muted)] p-4">
					<div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
						<div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-3">
							<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
								{UBICACION_PRESETS.map((preset) => {
									const activo = presetActivoPorItems(
										preset,
										presetsSeleccionados,
										ubicacionesSeleccionadas,
									);

									return (
										<button
											key={preset.id}
											type="button"
											onClick={() => onTogglePreset(preset)}
											disabled={disabled}
											className={`min-h-[76px] rounded-sm border px-3 py-2 text-left transition disabled:opacity-50 ${
												activo
													? "border-emerald-300 bg-emerald-50 text-emerald-900"
													: "border-[var(--app-border)] bg-[var(--app-surface-raised)] text-[var(--app-text-muted)] hover:border-emerald-200 hover:bg-emerald-50/50"
											}`}
										>
											<div className="text-sm font-semibold leading-tight">
												{preset.nombre}
											</div>
											<div className="mt-1 text-[11px] font-medium opacity-55">
												{preset.items.length} ubicaciones
											</div>
										</button>
									);
								})}
							</div>
						</div>

						<div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-3">
							<div className="max-h-[314px] overflow-y-auto pr-1">
								<div className="flex flex-wrap gap-1.5">
									{PROVINCIAS_FRECUENTES.map((ubicacion) => {
										const activa = seleccionadasNormalizadas.has(
											normalizarComparacion(ubicacion),
										);

										return (
											<button
												key={ubicacion}
												type="button"
												onClick={() => onToggleUbicacion(ubicacion)}
												disabled={disabled}
												className={`rounded-sm border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
													activa
														? "border-emerald-300 bg-emerald-100 text-emerald-800"
														: "border-[var(--app-border)] bg-[var(--app-surface-raised)] text-[var(--app-text-muted)] hover:border-emerald-200 hover:text-emerald-700"
												}`}
											>
												{ubicacion}
											</button>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-[var(--app-surface-raised)] px-4 py-3">
					<span className="text-xs font-medium text-[var(--app-text-subtle)]">
						{ubicacionesSeleccionadas.length} ubicaciones reales
					</span>

					<button
						type="button"
						onClick={onClose}
						className="rounded-sm bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--app-primary-hover)]"
					>
						Aplicar
					</button>
				</div>
			</div>
		</div>
	);
}
