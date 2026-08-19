import type { ChangeEvent, ReactNode, RefObject } from "react";
import {
	Database,
	Download,
	Filter,
	FolderPlus,
	PlusCircle,
	Loader2,
	MapPin,
	Sparkles,
	Trash2,
	Upload,
	Users,
	Wand2,
	XCircle,
} from "lucide-react";
import type { ProgresoLote } from "../../types/crm";
import { Badge, Button, Card, IconButton } from "../ui";

interface CRMToolbarProps {
	progresoLote: ProgresoLote | null;
	deteniendo: boolean;
	seleccionadosCount: number;
	isProcessingAny: boolean;
	mostrarFiltros: boolean;
	mostrarMapaFiltro: boolean;
	poligonoActivo: boolean;
	exportando: boolean;
	exportandoSeleccionados: boolean;
	limpiando: boolean;
	importando: boolean;
	eliminandoSeleccionados: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
	onDetenerProceso: () => void;
	onAbrirNuevoCliente: () => void;
	onEnriquecerSeleccionados: () => void;
	onEliminarSeleccionados: () => void;
	onCrearSegmentoSeleccion: () => void;
	onEnriquecerBbdd: () => void;
	onToggleFiltros: () => void;
	onToggleMapaFiltro: () => void;
	onExportarCsv: () => void;
	onExportarSeleccionadosCsv: () => void;
	onLimpiarBaseDatos: () => void;
	onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface ToolbarButtonProps {
	children: ReactNode;
	disabled?: boolean;
	title?: string;
	variant?: "primary" | "neutral" | "soft" | "warning" | "danger";
	active?: boolean;
	onClick: () => void;
}

function ToolbarButton({
	children,
	disabled = false,
	title,
	variant = "neutral",
	active = false,
	onClick,
}: ToolbarButtonProps) {
	const uiVariant = {
		primary: "primaryGradient",
		neutral: "secondary",
		soft: "outline",
		warning: "warning",
		danger: "danger",
	} as const;

	return (
		<Button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			size="md"
			variant={uiVariant[variant]}
			className={active ? "border-blue-300 bg-blue-50 text-blue-700 ring-2 ring-blue-200 ring-offset-1" : undefined}
		>
			{children}
		</Button>
	);
}

function FloatingSelectionBar({
	seleccionadosCount,
	isProcessingAny,
	eliminandoSeleccionados,
	exportandoSeleccionados,
	onEnriquecerSeleccionados,
	onEliminarSeleccionados,
	onCrearSegmentoSeleccion,
	onExportarSeleccionadosCsv,
}: {
	seleccionadosCount: number;
	isProcessingAny: boolean;
	eliminandoSeleccionados: boolean;
	exportandoSeleccionados: boolean;
	onEnriquecerSeleccionados: () => void;
	onEliminarSeleccionados: () => void;
	onCrearSegmentoSeleccion: () => void;
	onExportarSeleccionadosCsv: () => void;
}) {
	if (seleccionadosCount === 0) return null;

	return (
		<Card className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 border-[var(--app-border-strong)] bg-[var(--app-surface-raised)] p-2 shadow-[var(--app-shadow-md)] animate-in fade-in slide-in-from-bottom-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2 px-2 text-[var(--app-text)]">
					<Users size={17} className="shrink-0 text-[var(--app-primary)]" />
					<div className="truncate text-sm font-medium">
						{seleccionadosCount} {seleccionadosCount === 1 ? "seleccionado" : "seleccionados"}
					</div>
				</div>

				<div className="flex shrink-0 items-center justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onEnriquecerSeleccionados}
						disabled={isProcessingAny}
						title="Enriquecer únicamente los clientes seleccionados"
						leftIcon={<Wand2 size={15} />}
					>
						Enriquecer
					</Button>

					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={onCrearSegmentoSeleccion}
						disabled={isProcessingAny}
						title="Guardar los clientes seleccionados como lista fija"
						leftIcon={<FolderPlus size={15} />}
					>
						Lista
					</Button>

					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={onExportarSeleccionadosCsv}
						disabled={isProcessingAny || exportandoSeleccionados}
						title="Exportar únicamente los clientes seleccionados"
						leftIcon={exportandoSeleccionados ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
					>
						Exportar
					</Button>

					<IconButton
						variant="danger"
						buttonSize="sm"
						onClick={onEliminarSeleccionados}
						disabled={isProcessingAny || eliminandoSeleccionados}
						label="Eliminar selección"
						title="Eliminar todos los clientes seleccionados"
					>
						{eliminandoSeleccionados ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
					</IconButton>
				</div>
			</div>
		</Card>
	);
}

export default function CRMToolbar({
	progresoLote,
	deteniendo,
	seleccionadosCount,
	isProcessingAny,
	mostrarFiltros,
	mostrarMapaFiltro,
	poligonoActivo,
	exportando,
	exportandoSeleccionados,
	limpiando,
	importando,
	eliminandoSeleccionados,
	fileInputRef,
	onDetenerProceso,
	onAbrirNuevoCliente,
	onEnriquecerSeleccionados,
	onEliminarSeleccionados,
	onCrearSegmentoSeleccion,
	onExportarSeleccionadosCsv,
	onEnriquecerBbdd,
	onToggleFiltros,
	onToggleMapaFiltro,
	onExportarCsv,
	onLimpiarBaseDatos,
	onFileUpload,
}: CRMToolbarProps) {
	if (progresoLote) {
		return (
			<div className="flex w-full justify-end xl:w-auto">
				<Card className="flex flex-wrap items-center justify-end gap-3 border-[var(--app-primary-border)] bg-[var(--app-primary-soft)] px-4 py-3">
					<div className="min-w-[190px]">
						<div className="text-xs font-medium uppercase tracking-wide text-[var(--app-highlight)]">
							Enriquecimiento en curso
						</div>
						<div className="mt-0.5 text-sm font-semibold text-[var(--app-text)]">
							{progresoLote.actual} de {progresoLote.total} clientes
						</div>
					</div>

					<Button
						type="button"
						onClick={onDetenerProceso}
						disabled={deteniendo}
						variant="dangerSolid"
						leftIcon={deteniendo ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
					>
						{deteniendo ? "Deteniendo..." : "Detener proceso"}
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<>
			<FloatingSelectionBar
				seleccionadosCount={seleccionadosCount}
				isProcessingAny={isProcessingAny}
				eliminandoSeleccionados={eliminandoSeleccionados}
				onEnriquecerSeleccionados={onEnriquecerSeleccionados}
				onEliminarSeleccionados={onEliminarSeleccionados}
				exportandoSeleccionados={exportandoSeleccionados}
				onCrearSegmentoSeleccion={onCrearSegmentoSeleccion}
				onExportarSeleccionadosCsv={onExportarSeleccionadosCsv}
			/>

			<div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
				<ToolbarButton
					variant="primary"
					onClick={onAbrirNuevoCliente}
					disabled={isProcessingAny}
					title="Añadir un cliente manualmente o desde una ficha de Google Maps"
				>
					<PlusCircle size={17} />
					Añadir cliente
				</ToolbarButton>

				<div className="mx-1 hidden h-8 w-px bg-gray-200 md:block" />

				<input
					type="file"
					accept=".csv"
					className="hidden"
					ref={fileInputRef}
					onChange={onFileUpload}
				/>

				<ToolbarButton
					onClick={() => fileInputRef.current?.click()}
					disabled={isProcessingAny || importando}
					title="Importar clientes desde un CSV"
				>
					{importando ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
					Importar
				</ToolbarButton>

				<ToolbarButton
					onClick={onExportarCsv}
					disabled={exportando || isProcessingAny}
					title="Exporta todos los clientes que coinciden con los filtros actuales"
				>
					{exportando ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
					Exportar
				</ToolbarButton>

				<div className="mx-1 hidden h-8 w-px bg-gray-200 md:block" />

				<ToolbarButton active={mostrarFiltros} onClick={onToggleFiltros} title="Mostrar u ocultar filtros">
					<Filter size={17} />
					Filtros
				</ToolbarButton>

				<ToolbarButton active={mostrarMapaFiltro} onClick={onToggleMapaFiltro} title="Mostrar u ocultar filtro por zona">
					<MapPin size={17} />
					Zona
					{poligonoActivo && (
						<Badge variant="green" className="ml-0.5 px-2 py-0.5 text-[11px]">
							Activa
						</Badge>
					)}
				</ToolbarButton>

				<div className="mx-1 hidden h-8 w-px bg-gray-200 md:block" />

				<ToolbarButton
					variant="soft"
					onClick={onEnriquecerBbdd}
					disabled={isProcessingAny}
					title="Enriquecer automáticamente los clientes pendientes de la base de datos"
				>
					<Database size={17} />
					Enriquecer BBDD
				</ToolbarButton>

				<ToolbarButton
					variant="warning"
					onClick={onLimpiarBaseDatos}
					disabled={isProcessingAny || limpiando}
					title="Quita caracteres raros y elimina emails duplicados"
				>
					{limpiando ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
					Limpiar
				</ToolbarButton>
			</div>
		</>
	);
}
