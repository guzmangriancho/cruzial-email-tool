import { useEffect, useMemo, useState } from "react";
import { Filter, FolderPlus, Save, Users } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Textarea, cx, useDialog } from "../ui";
import type { ClienteFilters } from "../../types/crm";
import type { Segmento, SegmentoCreatePayload, SegmentoTipo } from "../../types/segmentos";

interface SegmentoFormModalProps {
	abierto: boolean;
	segmento?: Segmento | null;
	tipoInicial?: SegmentoTipo;
	filtros?: ClienteFilters | null;
	clienteIds?: number[];
	guardando: boolean;
	onClose: () => void;
	onSubmit: (payload: SegmentoCreatePayload) => Promise<void> | void;
}

const COLORES = [
	{ label: "Azul", value: "blue", className: "bg-blue-500" },
	{ label: "Verde", value: "green", className: "bg-green-500" },
	{ label: "Azul eléctrico", value: "purple", className: "bg-[var(--app-primary)]" },
	{ label: "Ámbar", value: "amber", className: "bg-amber-500" },
	{ label: "Rojo", value: "red", className: "bg-red-500" },
	{ label: "Gris", value: "slate", className: "bg-slate-500" },
];

function limpiarFiltrosParaVista(filtros?: ClienteFilters | null) {
	if (!filtros) return [];

	return Object.entries(filtros).filter(([, value]) => {
		if (value === undefined || value === null || value === "") return false;
		return true;
	});
}

export default function SegmentoFormModal({
	abierto,
	segmento,
	tipoInicial = "dinamico",
	filtros,
	clienteIds = [],
	guardando,
	onClose,
	onSubmit,
}: SegmentoFormModalProps) {
	const { alert } = useDialog();

	const [nombre, setNombre] = useState("");
	const [descripcion, setDescripcion] = useState("");
	const [tipo, setTipo] = useState<SegmentoTipo>(tipoInicial);
	const [color, setColor] = useState("blue");

	const esEdicion = Boolean(segmento);
	const filtrosActivos = useMemo(
		() => limpiarFiltrosParaVista(segmento?.filtros || filtros),
		[filtros, segmento?.filtros],
	);
	const tieneSeleccion = clienteIds.length > 0;

	useEffect(() => {
		if (!abierto) return;

		setNombre(segmento?.nombre || "");
		setDescripcion(segmento?.descripcion || "");
		setTipo(segmento?.tipo || tipoInicial);
		setColor(segmento?.color || "blue");
	}, [abierto, segmento, tipoInicial]);

	const guardar = async () => {
		const nombreLimpio = nombre.trim();

		if (!nombreLimpio) {
			alert("Pon un nombre al segmento.");
			return;
		}

		const filtrosPayload = segmento?.filtros || filtros || {};
		const tipoFinal = tipo;

		if (tipoFinal === "estatico" && !esEdicion && clienteIds.length === 0) {
			alert("Selecciona clientes en la base de datos para crear una lista fija.");
			return;
		}

		await onSubmit({
			nombre: nombreLimpio,
			descripcion: descripcion.trim() || null,
			tipo: tipoFinal,
			filtros: tipoFinal === "dinamico" ? filtrosPayload : null,
			cliente_ids: tipoFinal === "estatico" ? clienteIds : [],
			color,
		});
	};

	return (
		<Modal
			open={abierto}
			onClose={onClose}
			closeDisabled={guardando}
			size="md"
			title={esEdicion ? "Editar segmento" : "Guardar segmento"}
			description={
				tipo === "dinamico"
					? "Segmento dinámico: se actualiza solo cuando cambian los clientes que cumplen los filtros."
					: "Lista fija: conserva exactamente los clientes seleccionados."
			}
			icon={<FolderPlus size={22} />}
			footer={
				<>
					<Button variant="secondary" onClick={onClose} disabled={guardando}>
						Cancelar
					</Button>

					<Button
						variant="primary"
						onClick={guardar}
						isLoading={guardando}
						leftIcon={esEdicion ? <Save size={17} /> : <FolderPlus size={17} />}
					>
						{esEdicion ? "Guardar cambios" : "Crear segmento"}
					</Button>
				</>
			}
		>
			<div className="space-y-5">
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Field label="Nombre" className="md:col-span-2">
						<Input
							value={nombre}
							onChange={(e) => setNombre(e.target.value)}
							placeholder="Ej: Restaurantes Madrid con email"
						/>
					</Field>

					<Field label="Descripción" className="md:col-span-2">
						<Textarea
							value={descripcion}
							onChange={(e) => setDescripcion(e.target.value)}
							placeholder="Notas internas sobre esta lista..."
							rows={3}
						/>
					</Field>

					<Field label="Tipo">
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => setTipo("dinamico")}
								disabled={esEdicion && segmento?.tipo === "estatico"}
								className={cx(
									"rounded-sm border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
									tipo === "dinamico"
										? "border-blue-300 bg-blue-50 text-blue-800"
										: "border-[var(--app-border)] bg-[var(--app-surface-raised)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]",
								)}
							>
								<Filter size={17} />
								<div className="mt-1 text-sm font-medium">Dinámico</div>
								<div className="text-[11px] text-[var(--app-text-muted)]">Por filtros</div>
							</button>

							<button
								type="button"
								onClick={() => setTipo("estatico")}
								disabled={(esEdicion && segmento?.tipo === "dinamico") || (!esEdicion && !tieneSeleccion)}
								className={cx(
									"rounded-sm border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
									tipo === "estatico"
										? "border-[var(--app-primary-border)] bg-[var(--app-primary-soft)] text-[var(--app-primary-text)]"
										: "border-[var(--app-border)] bg-[var(--app-surface-raised)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]",
								)}
							>
								<Users size={17} />
								<div className="mt-1 text-sm font-medium">Lista fija</div>
								<div className="text-[11px] text-[var(--app-text-muted)]">
									{tieneSeleccion ? `${clienteIds.length} seleccionados` : "Sin selección"}
								</div>
							</button>
						</div>
					</Field>

					<Field label="Color">
						<div className="flex flex-wrap gap-2 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2">
							{COLORES.map((opcion) => (
								<button
									key={opcion.value}
									type="button"
									onClick={() => setColor(opcion.value)}
									title={opcion.label}
									className={cx(
										"h-8 w-8 rounded-full transition",
										opcion.className,
										color === opcion.value
											? "ring-2 ring-blue-500 ring-offset-2"
											: "opacity-80 hover:opacity-100",
									)}
								/>
							))}
						</div>
					</Field>
				</div>

				<div className="rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="text-sm font-medium text-[var(--app-text)]">
								{tipo === "dinamico" ? "Filtros guardados" : "Clientes guardados"}
							</div>
							<p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
								{tipo === "dinamico"
									? "El segmento recalculará sus clientes usando estos filtros."
									: "La lista no cambiará aunque los clientes dejen de cumplir filtros."}
							</p>
						</div>
						<Badge variant="white">
							{tipo === "dinamico"
								? `${filtrosActivos.length} reglas`
								: `${clienteIds.length || segmento?.total_clientes || 0} clientes`}
						</Badge>
					</div>

					{tipo === "dinamico" && (
						<div className="mt-3 flex flex-wrap gap-2">
							{filtrosActivos.length === 0 ? (
								<Badge variant="white">Sin filtros: incluirá toda la base de datos</Badge>
							) : (
								filtrosActivos.map(([key, value]) => (
									<Badge key={key} variant="white">
										{key}: {String(value)}
									</Badge>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
}
