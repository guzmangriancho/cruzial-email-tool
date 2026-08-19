import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import {
	Activity,
	AlertTriangle,
	Bug,
	CheckCircle,
	Clock3,
	Database,
	Loader2,
	MapPin,
	Play,
	Plus,
	RotateCcw,
	Search,
	StopCircle,
	X,
} from "lucide-react";

import { Badge, Button, Card, IconButton, Input, PageHeader, PageShell, cx, ui, useDialog, type UiTone } from "../components/ui";
import { api } from "../services/api";
import type { EstadoScraper, ClienteExtraido } from "../types/scraper";
import { LogsPanel, MapPanel, ResultTable } from "../components/scraper/ScraperResultsPanel";
import {
	ChipInput,
	MapaUbicacionesModal,
	MetricCard,
	StatusPill,
	UbicacionesPresetButton,
} from "../components/scraper/ScraperFormParts";


import {
	ESTADOS_FINALIZADOS,
	PROVINCIAS_FRECUENTES,
	STORAGE_KEYS,
	UBICACION_PRESETS,
	capitalizarTexto,
	leerBooleanStorage,
	leerListaStorage,
	leerStringStorage,
	normalizarComparacion,
	presetActivoPorItems,
	presetPorId,
	unirUbicacionesSinDuplicados,
	type UbicacionPreset,
} from "../config/scraperPresets";

function estadoVisual(estado?: string) {
	if (!estado || estado === "No encontrado") {
		return {
			label: "Sin tarea",
			className: ui.status.unknown,
			dot: "bg-[var(--intent-neutral-solid)]",
		};
	}

	if (estado === "Ejecutando") {
		return {
			label: "Ejecutando",
			className: ui.status.completed,
			dot: "bg-[var(--intent-success-solid)] animate-pulse",
		};
	}

	if (estado === "Iniciando") {
		return {
			label: "Iniciando",
			className: ui.status.ready,
			dot: "bg-[var(--intent-info-solid)] animate-pulse",
		};
	}

	if (estado === "Error") {
		return {
			label: "Error",
			className: ui.status.error,
			dot: "bg-[var(--intent-danger-solid)]",
		};
	}

	if (estado === "Detenido") {
		return {
			label: "Detenido",
			className: ui.status.paused,
			dot: "bg-[var(--intent-warning-solid)]",
		};
	}

	return {
		label: estado,
		className: ui.status.unknown,
		dot: "bg-[var(--intent-muted-solid)]",
	};
}

export default function ScraperPage() {
	const { confirm } = useDialog();

	const [inputNegocio, setInputNegocio] = useState("");
	const [inputUbicacion, setInputUbicacion] = useState("");
	const [listaNegocios, setListaNegocios] = useState<string[]>(() =>
		leerListaStorage(STORAGE_KEYS.negocios),
	);
	const [listaUbicaciones, setListaUbicaciones] = useState<string[]>(() =>
		leerListaStorage(STORAGE_KEYS.ubicaciones),
	);
	const [presetsUbicacionSeleccionados, setPresetsUbicacionSeleccionados] =
		useState<string[]>(() =>
			leerListaStorage(STORAGE_KEYS.ubicacionPresets).filter((id) =>
				UBICACION_PRESETS.some((preset) => preset.id === id),
			),
		);
	const [modoPrueba, setModoPrueba] = useState(() =>
		leerBooleanStorage(STORAGE_KEYS.modo),
	);
	const [taskId, setTaskId] = useState<string | null>(() =>
		leerStringStorage(STORAGE_KEYS.taskId),
	);
	const [estadoActual, setEstadoActual] = useState<EstadoScraper | null>(null);
	const [polling, setPolling] = useState(() =>
		Boolean(leerStringStorage(STORAGE_KEYS.taskId)),
	);
	const [errorConexion, setErrorConexion] = useState<string | null>(null);
	const [selectorZonasAbierto, setSelectorZonasAbierto] = useState(false);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.negocios, JSON.stringify(listaNegocios));
	}, [listaNegocios]);

	useEffect(() => {
		localStorage.setItem(
			STORAGE_KEYS.ubicaciones,
			JSON.stringify(listaUbicaciones),
		);
	}, [listaUbicaciones]);

	useEffect(() => {
		localStorage.setItem(
			STORAGE_KEYS.ubicacionPresets,
			JSON.stringify(presetsUbicacionSeleccionados),
		);
	}, [presetsUbicacionSeleccionados]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.modo, JSON.stringify(modoPrueba));
	}, [modoPrueba]);

	useEffect(() => {
		if (taskId) localStorage.setItem(STORAGE_KEYS.taskId, taskId);
		else localStorage.removeItem(STORAGE_KEYS.taskId);
	}, [taskId]);

	const clientesExtraidos = useMemo(
		() => estadoActual?.clientes_extraidos ?? [],
		[estadoActual],
	);
	const visualEstado = estadoVisual(estadoActual?.estado);

	const sectoresFinales = useMemo(() => {
		const lista = [...listaNegocios];
		const pendiente = capitalizarTexto(inputNegocio);
		if (pendiente && !lista.includes(pendiente)) lista.push(pendiente);
		return lista;
	}, [inputNegocio, listaNegocios]);

	const ubicacionesFinales = useMemo(() => {
		const itemsPreset = presetsUbicacionSeleccionados
			.map((id) => presetPorId(id))
			.filter((preset): preset is UbicacionPreset => Boolean(preset))
			.flatMap((preset) => preset.items);
		const pendiente = capitalizarTexto(inputUbicacion);

		return unirUbicacionesSinDuplicados(
			listaUbicaciones,
			itemsPreset,
			pendiente ? [pendiente] : [],
		);
	}, [inputUbicacion, listaUbicaciones, presetsUbicacionSeleccionados]);

	const presetsSeleccionados = useMemo(
		() =>
			presetsUbicacionSeleccionados
				.map((id) => presetPorId(id))
				.filter((preset): preset is UbicacionPreset => Boolean(preset)),
		[presetsUbicacionSeleccionados],
	);

	const ubicacionesCubiertasPorPreset = useMemo(() => {
		return new Set(
			presetsSeleccionados.flatMap((preset) =>
				preset.items.map(normalizarComparacion),
			),
		);
	}, [presetsSeleccionados]);

	const ubicacionChipsVisibles = useMemo(() => {
		const ubicacionesSueltas = listaUbicaciones.filter(
			(ubicacion) =>
				!ubicacionesCubiertasPorPreset.has(normalizarComparacion(ubicacion)),
		);

		return [
			...presetsSeleccionados.map((preset) => preset.nombre),
			...ubicacionesSueltas,
		];
	}, [listaUbicaciones, presetsSeleccionados, ubicacionesCubiertasPorPreset]);

	const metricas = useMemo(() => {
		const completados = clientesExtraidos.filter(
			(cliente) => cliente.estado_fila === "completado",
		).length;
		const duplicados = clientesExtraidos.filter(
			(cliente) => cliente.estado_fila === "duplicado",
		).length;
		const omitidos = clientesExtraidos.filter(
			(cliente) => cliente.estado_fila === "descartado",
		).length;
		const enCola = clientesExtraidos.filter(
			(cliente) => cliente.estado_fila === "cargando",
		).length;

		return {
			totalConfigurado: sectoresFinales.length * ubicacionesFinales.length,
			totalFilas: clientesExtraidos.length,
			completados,
			duplicados,
			omitidos,
			enCola,
			guardados: estadoActual?.nuevos_clientes ?? completados,
			actualizados: estadoActual?.clientes_actualizados ?? 0,
		};
	}, [clientesExtraidos, estadoActual, sectoresFinales, ubicacionesFinales]);

	const puedeEjecutar =
		!polling && sectoresFinales.length > 0 && ubicacionesFinales.length > 0;

	const agregarNegocio = (event?: FormEvent | KeyboardEvent) => {
		event?.preventDefault();

		const formateado = capitalizarTexto(inputNegocio);
		if (!formateado) return;

		setListaNegocios((prev) =>
			prev.includes(formateado) ? prev : [...prev, formateado],
		);
		setInputNegocio("");
	};

	const agregarUbicacion = (event?: FormEvent | KeyboardEvent) => {
		event?.preventDefault();

		const formateado = capitalizarTexto(inputUbicacion);
		if (!formateado) return;

		setListaUbicaciones((prev) =>
			prev.includes(formateado) ? prev : [...prev, formateado],
		);
		setInputUbicacion("");
	};

	const eliminarNegocio = (negocio: string) => {
		setListaNegocios((prev) => prev.filter((item) => item !== negocio));
	};

	const eliminarUbicacion = (ubicacion: string) => {
		setListaUbicaciones((prev) => prev.filter((item) => item !== ubicacion));
	};

	const eliminarUbicacionChip = (chip: string) => {
		const preset = presetsSeleccionados.find((item) => item.nombre === chip);

		if (preset) {
			desactivarPresetUbicaciones(preset);
			return;
		}

		eliminarUbicacion(chip);
	};

	const agregarUbicaciones = (ubicaciones: string[]) => {
		if (polling) return;

		setListaUbicaciones((prev) => {
			const existentes = new Set(prev.map(normalizarComparacion));
			const siguientes = [...prev];

			ubicaciones.forEach((ubicacion) => {
				const formateada = capitalizarTexto(ubicacion);

				if (!formateada) return;

				const clave = normalizarComparacion(formateada);

				if (!existentes.has(clave)) {
					siguientes.push(formateada);
					existentes.add(clave);
				}
			});

			return siguientes;
		});

		setInputUbicacion("");
	};


	const desactivarPresetUbicaciones = (preset: UbicacionPreset) => {
		if (polling) return;

		const restantesIds = presetsUbicacionSeleccionados.filter(
			(id) => id !== preset.id,
		);
		const itemsDeOtrosPresets = new Set(
			restantesIds
				.map((id) => presetPorId(id))
				.filter((item): item is UbicacionPreset => Boolean(item))
				.flatMap((item) => item.items.map(normalizarComparacion)),
		);
		const itemsPreset = new Set(preset.items.map(normalizarComparacion));

		setPresetsUbicacionSeleccionados(restantesIds);
		setListaUbicaciones((prev) =>
			prev.filter((ubicacion) => {
				const clave = normalizarComparacion(ubicacion);
				return !itemsPreset.has(clave) || itemsDeOtrosPresets.has(clave);
			}),
		);
	};

	const alternarPresetUbicaciones = (preset: UbicacionPreset) => {
		if (polling) return;

		if (presetsUbicacionSeleccionados.includes(preset.id)) {
			desactivarPresetUbicaciones(preset);
			return;
		}

		setPresetsUbicacionSeleccionados((prev) =>
			prev.includes(preset.id) ? prev : [...prev, preset.id],
		);
		setInputUbicacion("");
	};

	const alternarUbicacionIndividual = (ubicacion: string) => {
		if (polling) return;

		const clave = normalizarComparacion(ubicacion);
		const yaExiste = listaUbicaciones.some(
			(item) => normalizarComparacion(item) === clave,
		);

		if (yaExiste) {
			setPresetsUbicacionSeleccionados((prev) =>
				prev.filter((id) => {
					const preset = presetPorId(id);
					return !preset?.items.some(
						(item) => normalizarComparacion(item) === clave,
					);
				}),
			);
			setListaUbicaciones((prev) =>
				prev.filter((item) => normalizarComparacion(item) !== clave),
			);
			return;
		}

		agregarUbicaciones([ubicacion]);
	};

	const limpiarUbicaciones = () => {
		if (polling) return;
		setListaUbicaciones([]);
		setPresetsUbicacionSeleccionados([]);
		setInputUbicacion("");
	};

	const limpiarTodo = async () => {
		if (
			!(await confirm({
				title: "Reiniciar búsqueda",
				description: "¿Reiniciar la búsqueda y limpiar los campos del scraper?",
				tone: "warning",
				confirmLabel: "Reiniciar",
			}))
		) {
			return;
		}

		setListaNegocios([]);
		setListaUbicaciones([]);
		setPresetsUbicacionSeleccionados([]);
		setInputNegocio("");
		setInputUbicacion("");
		setTaskId(null);
		setEstadoActual(null);
		setPolling(false);
		setErrorConexion(null);

		Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
	};

	const iniciarBusqueda = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (sectoresFinales.length === 0 || ubicacionesFinales.length === 0) {
			setErrorConexion("Añade al menos un sector y una ubicación.");
			return;
		}

		try {
			setErrorConexion(null);
			setEstadoActual(null);

			const respuesta = await api.post("/scraper/iniciar", null, {
				params: {
					palabras_clave: sectoresFinales.join(","),
					ubicaciones: ubicacionesFinales.join(","),
					modo_prueba: modoPrueba,
				},
			});

			setListaNegocios(sectoresFinales);
			setListaUbicaciones(ubicacionesFinales);
			setInputNegocio("");
			setInputUbicacion("");
			setTaskId(respuesta.data.task_id);
			setPolling(true);
		} catch (error) {
			console.error("Error iniciando scraper:", error);
			setErrorConexion("No se pudo iniciar la búsqueda. Revisa el backend.");
		}
	};

	const detenerBusqueda = async () => {
		if (!taskId) return;

		try {
			await api.post(`/scraper/detener/${taskId}`);
		} catch (error) {
			console.error("Error deteniendo búsqueda:", error);
			setPolling(false);
		}
	};

	useEffect(() => {
		let intervalo: ReturnType<typeof window.setInterval> | undefined;

		const consultarEstado = async () => {
			if (!taskId) return;

			try {
				const res = await api.get<EstadoScraper>(`/scraper/estado/${taskId}`);
				setEstadoActual(res.data);
				setErrorConexion(null);

				if (ESTADOS_FINALIZADOS.includes(res.data.estado)) {
					setPolling(false);
				}
			} catch (error) {
				console.error("Error consultando estado:", error);
				setErrorConexion("Se perdió la conexión con el estado de la tarea.");
				setPolling(false);
			}
		};

		if (polling && taskId) {
			consultarEstado();
			intervalo = window.setInterval(consultarEstado, 1500);
		}

		return () => {
			if (intervalo) window.clearInterval(intervalo);
		};
	}, [polling, taskId]);

	const getMapUrl = () => {
		if (!estadoActual?.coordenadas_actuales) return "";

		const [lat, lon] = estadoActual.coordenadas_actuales;
		const zoom = 0.01;

		return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - zoom},${lat - zoom},${lon + zoom},${lat + zoom}&layer=mapnik&marker=${lat},${lon}`;
	};

	return (
		<PageShell>
			<PageHeader
				title="Buscador de negocios en Google Maps"
				description="Busca negocios por sector y ubicación, muestra el avance y guarda los resultados en la base de clientes."
				actions={
					<>
						<StatusPill estado={visualEstado} />

					{taskId &&
						!polling &&
						estadoActual &&
						!ESTADOS_FINALIZADOS.includes(estadoActual.estado) && (
							<Button
								type="button"
								onClick={() => setPolling(true)}
								variant="secondary"
								leftIcon={<Activity size={16} />}
							>
								Reanudar seguimiento
							</Button>
						)}

					<Button
						type="button"
						onClick={limpiarTodo}
						disabled={polling}
						variant="secondary"
						leftIcon={<RotateCcw size={16} />}
						>
							Reiniciar
						</Button>
					</>
				}
			/>

			{errorConexion && (
				<div className={cx("mb-6 flex items-center gap-2 rounded-sm border px-4 py-3 text-sm font-semibold", ui.tone.danger)}>
					<AlertTriangle size={17} />
					{errorConexion}
				</div>
			)}

			{selectorZonasAbierto && (
				<MapaUbicacionesModal
					ubicacionesSeleccionadas={ubicacionesFinales}
					presetsSeleccionados={presetsUbicacionSeleccionados}
					disabled={polling}
					onClose={() => setSelectorZonasAbierto(false)}
					onTogglePreset={alternarPresetUbicaciones}
					onToggleUbicacion={alternarUbicacionIndividual}
					onClear={limpiarUbicaciones}
				/>
			)}

			<section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<MetricCard
					icon={<Search size={20} />}
					label="Combinaciones"
					value={metricas.totalConfigurado}
					description={`${sectoresFinales.length} sectores · ${ubicacionesFinales.length} ubicaciones`}
				/>

				<MetricCard
					icon={<CheckCircle size={20} />}
					label="Guardados"
					value={metricas.guardados}
					description={`${metricas.actualizados} actualizados`}
					tone="success"
				/>

				<MetricCard
					icon={<Clock3 size={20} />}
					label="En proceso"
					value={metricas.enCola}
					description={`${metricas.totalFilas} filas detectadas`}
					tone="warning"
				/>

				<MetricCard
					icon={<Database size={20} />}
					label="Omitidos"
					value={metricas.duplicados + metricas.omitidos}
					description={`${metricas.duplicados} duplicados · ${metricas.omitidos} descartados`}
					tone="muted"
				/>
			</section>

			<div className="mb-6 grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
				<section className="flex xl:col-span-4">
					<Card className="flex h-full w-full flex-col overflow-hidden">
						<div className="border-b border-gray-100 bg-[var(--app-surface-raised)] px-5 py-4">
							<h2 className="text-lg font-medium text-[var(--app-text)]">
								Configurar búsqueda
							</h2>
							<p className="mt-0.5 text-sm text-[var(--app-text-muted)]">
								Añade varios sectores y ubicaciones para crear una matriz.
							</p>
						</div>

						<form
							onSubmit={iniciarBusqueda}
							className="flex flex-1 flex-col gap-5 p-5"
						>
							<ChipInput
								label="Sectores"
								placeholder="Ej: Ayuntamientos"
								value={inputNegocio}
								onValueChange={setInputNegocio}
								items={listaNegocios}
								onAdd={agregarNegocio}
								onRemove={eliminarNegocio}
								disabled={polling}
								variant="blue"
							/>

							<ChipInput
								label="Ubicaciones"
								placeholder="Ej: Cantabria"
								value={inputUbicacion}
								onValueChange={setInputUbicacion}
								items={ubicacionChipsVisibles}
								onAdd={agregarUbicacion}
								onRemove={eliminarUbicacionChip}
								disabled={polling}
								variant="emerald"
							/>

							<UbicacionesPresetButton
								ubicacionesSeleccionadas={ubicacionesFinales}
								presetsSeleccionados={presetsUbicacionSeleccionados}
								disabled={polling}
								onOpenMap={() => setSelectorZonasAbierto(true)}
								onClear={limpiarUbicaciones}
							/>

							<button
								type="button"
								onClick={() => setModoPrueba((prev) => !prev)}
								disabled={polling}
								className={`w-full rounded-sm border px-4 py-3 text-left transition-colors ${
									modoPrueba
										? "border-amber-200 bg-amber-50"
										: "border-[var(--app-border)] bg-[var(--app-surface-muted)] hover:bg-gray-100"
								} disabled:opacity-60`}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex gap-3">
										<div
											className={`mt-0.5 rounded-sm p-2 ${
												modoPrueba
													? "bg-amber-100 text-amber-700"
													: "bg-[var(--app-surface-raised)] text-[var(--app-text-muted)]"
											}`}
										>
											<Bug size={17} />
										</div>

										<div>
											<div className="text-sm font-medium text-[var(--app-text)]">
												Modo prueba
											</div>
											<div className="text-xs text-[var(--app-text-muted)] mt-0.5">
												Limita la extracción para comprobar que todo funciona.
											</div>
										</div>
									</div>

									<div
										className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
											modoPrueba ? "bg-amber-500" : "bg-gray-300"
										}`}
									>
										<div
											className={`h-5 w-5 rounded-full bg-[var(--app-surface-raised)] shadow transition-transform ${
												modoPrueba ? "translate-x-5" : "translate-x-0"
											}`}
										/>
									</div>
								</div>
							</button>

							<div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
								<Button
									type="submit"
									disabled={!puedeEjecutar}
									variant="primary"
									size="lg"
									isLoading={polling}
									leftIcon={<Play size={17} />}
								>
									Ejecutar
								</Button>

								<Button
									type="button"
									onClick={detenerBusqueda}
									disabled={!polling || !taskId}
									variant="danger"
									size="lg"
									leftIcon={<StopCircle size={17} />}
								>
									Detener
								</Button>
							</div>
						</form>
					</Card>
				</section>

				<section className="flex xl:col-span-8">
					<Card className="flex h-full w-full flex-col overflow-hidden">
						<div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
							<div>
								<h2 className="text-lg font-medium text-[var(--app-text)]">
									Monitor de tarea
								</h2>
								<p className="mt-0.5 text-sm text-[var(--app-text-muted)]">
									{estadoActual?.busqueda ||
										"Todavía no hay búsqueda en ejecución."}
								</p>
							</div>

							{polling && (
								<div className={cx("inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium", ui.tone.success)}>
									<Loader2 size={14} className="animate-spin" />
									Actualizando cada 1,5s
								</div>
							)}
						</div>

						<div className="flex min-h-0 flex-1 flex-col p-5">
							<div className="mb-4 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
								<div className="flex items-start gap-3">
									<div className="rounded-sm bg-[var(--app-surface-raised)] border border-[var(--app-border)] p-2 text-blue-600">
										<Activity size={18} />
									</div>

									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium text-[var(--app-text)]">
											{estadoActual?.mensaje ||
												"Preparado para lanzar una búsqueda."}
										</div>
										<div className="text-xs text-[var(--app-text-muted)] mt-1 truncate">
											{taskId ? `Task ID: ${taskId}` : "Sin tarea activa"}
										</div>
									</div>
								</div>
							</div>

							<div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
								<LogsPanel
									logs={estadoActual?.log_actividad ?? []}
									polling={polling}
								/>

								<MapPanel
									mapUrl={getMapUrl()}
									coords={estadoActual?.coordenadas_actuales}
								/>
							</div>
						</div>
					</Card>
				</section>
			</div>

			<ResultTable
				clientes={clientesExtraidos}
				coordsActuales={estadoActual?.coordenadas_actuales}
				polling={polling}
			/>
		</PageShell>
	);
}
