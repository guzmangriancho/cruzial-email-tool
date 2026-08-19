/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	Database,
	Download,
	Edit3,
	Filter,
	FolderPlus,
	Loader2,
	RefreshCw,
	Search,
	Trash2,
	Users,
} from "lucide-react";

import CRMFilters from "../components/crm/CRMFilters";
import SegmentoClientesModal from "../components/segmentos/SegmentoClientesModal";
import SegmentoFormModal from "../components/segmentos/SegmentoFormModal";
import { Badge, Button, Card, IconButton, Input, PageHeader, PageShell, cx, ui, useDialog, type UiTone } from "../components/ui";
import { obtenerSectores } from "../services/clientesService";
import {
	actualizarSegmento,
	crearSegmento,
	eliminarSegmento,
	exportarSegmentoCsv,
	materializarSegmento,
	obtenerSegmentos,
} from "../services/segmentosService";
import type {
	ClienteFilters,
	FiltroPresencia,
	ServerSortField,
	SortDirection,
} from "../types/crm";
import type { Segmento, SegmentoCreatePayload } from "../types/segmentos";
import {
	buildClienteFilterParams,
	downloadBlob,
	getCsvFilename,
} from "../utils/crmUtils";

const SEGMENT_COLOR_TONES: Record<string, UiTone> = {
	blue: "info",
	green: "success",
	purple: "accent",
	amber: "warning",
	red: "danger",
	slate: "muted",
};

function fechaRelativa(fecha?: string | null) {
	if (!fecha) return "Sin fecha";

	try {
		const date = new Date(fecha);
		const diffMs = Date.now() - date.getTime();
		const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDias <= 0) return "Hoy";
		if (diffDias === 1) return "Ayer";
		if (diffDias < 30) return `Hace ${diffDias} días`;

		return date.toLocaleDateString("es-ES", {
			day: "2-digit",
			month: "2-digit",
			year: "2-digit",
		});
	} catch {
		return "Sin fecha";
	}
}

function filtrosActivosCount(filtros?: ClienteFilters | null) {
	if (!filtros) return 0;

	return Object.values(filtros).filter(
		(value) => value !== undefined && value !== null && value !== "",
	).length;
}

function MetricCard({
	label,
	value,
	icon,
	tone = "info",
}: {
	label: string;
	value: string | number;
	icon: ReactNode;
	tone?: UiTone;
}) {
	return (
		<Card className="p-5">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-[var(--app-text-muted)]">{label}</p>
					<p className="mt-2 text-3xl font-medium text-[var(--app-text)]">{value}</p>
				</div>
				<div className={cx("rounded-sm p-3", ui.tone[tone])}>{icon}</div>
			</div>
		</Card>
	);
}

export default function SegmentosPage() {
	const { alert, confirm } = useDialog();

	const [segmentos, setSegmentos] = useState<Segmento[]>([]);
	const [cargando, setCargando] = useState(true);
	const [guardando, setGuardando] = useState(false);
	const [exportandoId, setExportandoId] = useState<number | null>(null);
	const [materializandoId, setMaterializandoId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busquedaLocal, setBusquedaLocal] = useState("");
	const [sectoresDisponibles, setSectoresDisponibles] = useState<string[]>([]);

	const [modalAbierto, setModalAbierto] = useState(false);
	const [segmentoEditando, setSegmentoEditando] = useState<Segmento | null>(
		null,
	);
	const [segmentoViendo, setSegmentoViendo] = useState<Segmento | null>(null);

	const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");
	const [filtroSector, setFiltroSector] = useState<string>("");
	const [filtroCiudad] = useState<string>("");
	const [filtroValoracion, setFiltroValoracion] = useState<number | "">("");
	const [ordenCampo, setOrdenCampo] =
		useState<ServerSortField>("fecha_captacion");
	const [ordenDireccion, setOrdenDireccion] = useState<SortDirection>("desc");
	const [filtroEmail, setFiltroEmail] = useState<FiltroPresencia>("todos");
	const [filtroTelefono, setFiltroTelefono] =
		useState<FiltroPresencia>("todos");
	const [filtroSitioWeb, setFiltroSitioWeb] =
		useState<FiltroPresencia>("todos");
	const [filtroDireccion, setFiltroDireccion] =
		useState<FiltroPresencia>("todos");
	const [filtroCiudadPresencia, setFiltroCiudadPresencia] =
		useState<FiltroPresencia>("todos");
	const [filtroValoracionPresencia, setFiltroValoracionPresencia] =
		useState<FiltroPresencia>("todos");
	const [filtroResenas, setFiltroResenas] = useState<FiltroPresencia>("todos");
	const [filtroUrlMaps, setFiltroUrlMaps] = useState<FiltroPresencia>("todos");

	const filtrosActuales = useCallback((): ClienteFilters => {
		return buildClienteFilterParams({
			filtroBusqueda,
			filtroSector,
			filtroCiudad,
			filtroValoracion,
			ordenCampo,
			ordenDireccion,
			filtroEmail,
			filtroTelefono,
			filtroSitioWeb,
			filtroDireccion,
			filtroCiudadPresencia,
			filtroValoracionPresencia,
			filtroResenas,
			filtroUrlMaps,
			poligonoFiltro: [],
		});
	}, [
		filtroBusqueda,
		filtroSector,
		filtroCiudad,
		filtroValoracion,
		ordenCampo,
		ordenDireccion,
		filtroEmail,
		filtroTelefono,
		filtroSitioWeb,
		filtroDireccion,
		filtroCiudadPresencia,
		filtroValoracionPresencia,
		filtroResenas,
		filtroUrlMaps,
	]);

	const cargarSegmentos = useCallback(async () => {
		try {
			setCargando(true);
			setError(null);
			const data = await obtenerSegmentos();
			setSegmentos(data);
		} catch (err) {
			console.error("Error cargando segmentos", err);
			setError("No se pudieron cargar los segmentos.");
		} finally {
			setCargando(false);
		}
	}, []);

	useEffect(() => {
		cargarSegmentos();
	}, [cargarSegmentos]);

	useEffect(() => {
		const cargarSectores = async () => {
			try {
				setSectoresDisponibles(await obtenerSectores());
			} catch (err) {
				console.error("Error cargando sectores", err);
			}
		};

		cargarSectores();
	}, []);

	const segmentosFiltrados = useMemo(() => {
		const term = busquedaLocal.trim().toLowerCase();

		if (!term) return segmentos;

		return segmentos.filter((segmento) => {
			return [segmento.nombre, segmento.descripcion, segmento.tipo]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(term));
		});
	}, [busquedaLocal, segmentos]);

	const totalClientesSegmentados = segmentos.reduce(
		(acc, segmento) => acc + segmento.total_clientes,
		0,
	);
	const totalDinamicos = segmentos.filter(
		(segmento) => segmento.tipo === "dinamico",
	).length;
	const totalEstaticos = segmentos.filter(
		(segmento) => segmento.tipo === "estatico",
	).length;

	const abrirCrearDesdeFiltros = () => {
		setSegmentoEditando(null);
		setModalAbierto(true);
	};

	const abrirEditar = (segmento: Segmento) => {
		setSegmentoEditando(segmento);
		setModalAbierto(true);
	};

	const cerrarModal = () => {
		if (guardando) return;
		setModalAbierto(false);
		setSegmentoEditando(null);
	};

	const guardarSegmento = async (payload: SegmentoCreatePayload) => {
		try {
			setGuardando(true);

			if (segmentoEditando) {
				await actualizarSegmento(segmentoEditando.id, payload);
			} else {
				await crearSegmento(payload);
			}

			setModalAbierto(false);
			setSegmentoEditando(null);
			await cargarSegmentos();
		} catch (err: any) {
			console.error("Error guardando segmento", err);
			alert(err?.response?.data?.detail || "No se pudo guardar el segmento.");
		} finally {
			setGuardando(false);
		}
	};

	const eliminar = async (segmento: Segmento) => {
		if (
			!(await confirm({
				title: "Eliminar segmento",
				description: `¿Seguro que quieres eliminar el segmento "${segmento.nombre}"?`,
				tone: "danger",
				confirmLabel: "Eliminar",
			}))
		) {
			return;
		}

		try {
			await eliminarSegmento(segmento.id);
			await cargarSegmentos();
		} catch (err: any) {
			console.error("Error eliminando segmento", err);
			alert(err?.response?.data?.detail || "No se pudo eliminar el segmento.");
		}
	};

	const exportar = async (segmento: Segmento) => {
		try {
			setExportandoId(segmento.id);
			const respuesta = await exportarSegmentoCsv(segmento.id);
			const filename = getCsvFilename(respuesta.contentDisposition);
			const blob = new Blob([respuesta.data], {
				type: "text/csv;charset=utf-8;",
			});
			downloadBlob(blob, filename);
		} catch (err) {
			console.error("Error exportando segmento", err);
			alert("No se pudo exportar el segmento.");
		} finally {
			setExportandoId(null);
		}
	};

	const materializar = async (segmento: Segmento) => {
		if (
			!(await confirm({
				title: "Convertir en lista fija",
				description: `Esto convertirá "${segmento.nombre}" en una lista fija con los clientes actuales. ¿Continuar?`,
				tone: "warning",
				confirmLabel: "Convertir",
			}))
		) {
			return;
		}

		try {
			setMaterializandoId(segmento.id);
			await materializarSegmento(segmento.id);
			await cargarSegmentos();
		} catch (err: any) {
			console.error("Error materializando segmento", err);
			alert(
				err?.response?.data?.detail ||
					"No se pudo convertir el segmento en lista fija.",
			);
		} finally {
			setMaterializandoId(null);
		}
	};

	const limpiarFiltros = () => {
		setFiltroBusqueda("");
		setFiltroSector("");
		setFiltroValoracion("");
		setOrdenCampo("fecha_captacion");
		setOrdenDireccion("desc");
		setFiltroEmail("todos");
		setFiltroTelefono("todos");
		setFiltroSitioWeb("todos");
		setFiltroDireccion("todos");
		setFiltroCiudadPresencia("todos");
		setFiltroValoracionPresencia("todos");
		setFiltroResenas("todos");
		setFiltroUrlMaps("todos");
	};

	return (
		<PageShell>
			<PageHeader
				title="Segmentos y Listas"
				description="Guarda filtros reutilizables o listas fijas para campañas, exportaciones y limpieza de datos."
				actions={
					<Button
						type="button"
						onClick={cargarSegmentos}
						disabled={cargando}
						variant="secondary"
						isLoading={cargando}
						leftIcon={<RefreshCw size={17} />}
					>
						Actualizar
					</Button>
				}
			/>

			<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
				<MetricCard
					label="Segmentos"
					value={segmentos.length}
					icon={<FolderPlus size={22} />}
					tone="info"
				/>

				<MetricCard
					label="Clientes segmentados"
					value={totalClientesSegmentados.toLocaleString("es-ES")}
					icon={<Users size={22} />}
					tone="success"
				/>

				<MetricCard
					label="Dinámicos"
					value={totalDinamicos}
					icon={<Filter size={22} />}
					tone="accent"
				/>

				<MetricCard
					label="Listas fijas"
					value={totalEstaticos}
					icon={<Database size={22} />}
					tone="warning"
				/>
			</div>

			<Card className={cx("mb-6 p-4", ui.tone.info)}>
				<div className="mb-3 flex items-center gap-2 text-sm font-medium">
					<Filter size={17} />
					Constructor rápido de segmentos dinámicos
				</div>

				<CRMFilters
					sectoresDisponibles={sectoresDisponibles}
					filtroBusqueda={filtroBusqueda}
					filtroSector={filtroSector}
					filtroValoracion={filtroValoracion}
					ordenCampo={ordenCampo}
					ordenDireccion={ordenDireccion}
					filtroEmail={filtroEmail}
					filtroTelefono={filtroTelefono}
					filtroSitioWeb={filtroSitioWeb}
					filtroDireccion={filtroDireccion}
					filtroCiudadPresencia={filtroCiudadPresencia}
					filtroValoracionPresencia={filtroValoracionPresencia}
					filtroResenas={filtroResenas}
					filtroUrlMaps={filtroUrlMaps}
					setFiltroBusqueda={setFiltroBusqueda}
					setFiltroSector={setFiltroSector}
					setFiltroValoracion={setFiltroValoracion}
					setOrdenCampo={setOrdenCampo}
					setOrdenDireccion={setOrdenDireccion}
					setFiltroEmail={setFiltroEmail}
					setFiltroTelefono={setFiltroTelefono}
					setFiltroSitioWeb={setFiltroSitioWeb}
					setFiltroDireccion={setFiltroDireccion}
					setFiltroCiudadPresencia={setFiltroCiudadPresencia}
					setFiltroValoracionPresencia={setFiltroValoracionPresencia}
					setFiltroResenas={setFiltroResenas}
					setFiltroUrlMaps={setFiltroUrlMaps}
					onResetPagina={() => undefined}
					onAplicarFiltroTexto={abrirCrearDesdeFiltros}
					onLimpiarFiltros={limpiarFiltros}
					onGuardarSegmento={abrirCrearDesdeFiltros}
				/>
			</Card>

			<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<Input
					containerClassName="w-full md:max-w-md"
					leftIcon={<Search size={16} />}
					value={busquedaLocal}
					onChange={(e) => setBusquedaLocal(e.target.value)}
					placeholder="Buscar segmentos por nombre, descripción o tipo..."
					variant="white"
				/>
			</div>

			<Card>
				{cargando ? (
					<div className="px-6 py-16 text-center text-[var(--app-text-subtle)]">
						<Loader2
							size={26}
							className="mx-auto mb-2 animate-spin text-blue-500"
						/>
						Cargando segmentos...
					</div>
				) : error ? (
					<div className="px-6 py-16 text-center font-semibold text-red-500">
						{error}
					</div>
				) : segmentosFiltrados.length === 0 ? (
					<div className="px-6 py-16 text-center text-[var(--app-text-subtle)]">
						<FolderPlus size={30} className="mx-auto mb-3 text-gray-300" />
						No hay segmentos con esa búsqueda.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
						{segmentosFiltrados.map((segmento) => {
							const colorTone = SEGMENT_COLOR_TONES[segmento.color || "blue"] || "info";
							const filtrosCount = filtrosActivosCount(segmento.filtros);

							return (
								<Card
									key={segmento.id}
									className="flex min-h-[230px] flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<Badge className={cx("border text-[11px] uppercase", ui.tone[colorTone])}>
													{segmento.tipo === "dinamico"
														? "Dinámico"
														: "Lista fija"}
												</Badge>
												<span className="text-xs font-medium text-[var(--app-text-subtle)]">
													{fechaRelativa(segmento.fecha_actualizacion)}
												</span>
											</div>

											<h3 className="mt-3 break-words text-lg font-medium text-[var(--app-text)]">
												{segmento.nombre}
											</h3>
											<p className="mt-1 line-clamp-2 text-sm text-[var(--app-text-muted)]">
												{segmento.descripcion || "Sin descripción."}
											</p>
										</div>

										<div className="rounded-sm bg-[var(--app-surface-muted)] px-3 py-2 text-right">
											<div className="text-2xl font-medium text-[var(--app-text)]">
												{segmento.total_clientes.toLocaleString("es-ES")}
											</div>
											<div className="text-[11px] font-semibold uppercase text-[var(--app-text-subtle)]">
												clientes
											</div>
										</div>
									</div>

									<div className="mt-4 flex flex-wrap gap-2">
										{segmento.tipo === "dinamico" ? (
											<span className="rounded-sm bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--app-text-muted)]">
												{filtrosCount} {filtrosCount === 1 ? "regla" : "reglas"}{" "}
												guardadas
											</span>
										) : (
											<span className="rounded-sm bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--app-text-muted)]">
												Lista estática
											</span>
										)}
									</div>

									<div className="mt-auto flex flex-wrap justify-between gap-2 pt-5">
										<Button
											type="button"
											onClick={() => setSegmentoViendo(segmento)}
											variant="primary"
											size="sm"
											leftIcon={<Users size={16} />}
										>
											Ver clientes
										</Button>

										<div className="flex flex-wrap justify-end gap-2">
											<IconButton
												type="button"
												onClick={() => exportar(segmento)}
												disabled={exportandoId === segmento.id}
												variant="secondary"
												buttonSize="sm"
												label="Exportar segmento a CSV"
											>
												{exportandoId === segmento.id ? (
													<Loader2 size={17} className="animate-spin" />
												) : (
													<Download size={17} />
												)}
											</IconButton>

											{segmento.tipo === "dinamico" && (
												<IconButton
													type="button"
													onClick={() => materializar(segmento)}
													disabled={materializandoId === segmento.id}
													variant="secondary"
													buttonSize="sm"
													label="Convertir en lista fija"
												>
													{materializandoId === segmento.id ? (
														<Loader2 size={17} className="animate-spin" />
													) : (
														<Database size={17} />
													)}
												</IconButton>
											)}

											<IconButton
												type="button"
												onClick={() => abrirEditar(segmento)}
												variant="secondary"
												buttonSize="sm"
												label="Editar segmento"
											>
												<Edit3 size={17} />
											</IconButton>

											<IconButton
												type="button"
												onClick={() => eliminar(segmento)}
												variant="danger"
												buttonSize="sm"
												label="Eliminar segmento"
											>
												<Trash2 size={17} />
											</IconButton>
										</div>
									</div>
								</Card>
							);
						})}
					</div>
				)}
			</Card>

			<SegmentoFormModal
				abierto={modalAbierto}
				segmento={segmentoEditando}
				tipoInicial="dinamico"
				filtros={filtrosActuales()}
				guardando={guardando}
				onClose={cerrarModal}
				onSubmit={guardarSegmento}
			/>

			<SegmentoClientesModal
				abierto={Boolean(segmentoViendo)}
				segmento={segmentoViendo}
				onClose={() => setSegmentoViendo(null)}
			/>
		</PageShell>
	);
}
