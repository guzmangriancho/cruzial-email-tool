import { useMemo } from "react";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	FileText,
	Loader2,
	PauseCircle,
	PlayCircle,
	RefreshCw,
	Send,
	Trash2,
	Users,
	XCircle,
} from "lucide-react";

import type {
	CampanaResumen,
	EstadoCampana,
	LogCampana,
} from "../../types/campanas";

import {
	ESTADOS_BADGE,
	formatoFecha,
} from "../../utils/campanasUtils";
import { Badge, Card, IconButton } from "../ui";

interface CampanasPanelProps {
	campanas: CampanaResumen[];
	campanaSeleccionadaId: number | null;
	estadoCampana: EstadoCampana | null;
	logs: LogCampana[];

	cargandoCampanas: boolean;
	cargandoDetalle: boolean;
	accionando: boolean;
	error: string | null;

	onSeleccionarCampana: (campanaId: number) => void;
	onRefresh: () => void;
	onLanzar: () => void;
	onDetener: () => void;
	onReanudar: () => void;
	onEditar: () => void;
	onEliminar: () => void;
}

export function CampanasPanel({
	campanas,
	campanaSeleccionadaId,
	estadoCampana,
	logs,
	cargandoCampanas,
	cargandoDetalle,
	accionando,
	error,
	onSeleccionarCampana,
	onRefresh,
	onLanzar,
	onDetener,
	onReanudar,
	onEditar,
	onEliminar,
}: CampanasPanelProps) {
	const estadoActual = estadoCampana?.estado || "—";

	const progreso = useMemo(() => {
		if (!estadoCampana || estadoCampana.total === 0) {
			return 0;
		}

		return Math.min(
			100,
			Math.round((estadoCampana.procesados / estadoCampana.total) * 100),
		);
	}, [estadoCampana]);

	const esEnProgreso = estadoActual === "En Progreso";
	const puedeReanudar = estadoActual === "Pausada";
	const puedeLanzar =
		estadoActual === "Preparada" ||
		estadoActual === "Borrador" ||
		estadoActual === "Pausada";

	const puedeEliminar = estadoActual !== "En Progreso";
	const puedeEditar = estadoActual !== "En Progreso" && !!campanaSeleccionadaId;

	return (
		<div className="col-span-12 xl:col-span-4 flex flex-col gap-4 min-w-0 min-h-0">
			<Card className="flex h-[33%] min-h-[230px] flex-col overflow-hidden rounded-sm">
				<div className="px-4 py-3 border-b border-gray-100 bg-[var(--app-surface-muted)] flex items-center justify-between">
					<h2 className="font-medium text-[var(--app-text)] flex items-center gap-2">
						<Users size={18} className="text-blue-600" />
						Campañas
					</h2>

					<IconButton
						label="Actualizar"
						onClick={onRefresh}
						buttonSize="sm"
						className="text-[var(--app-text-muted)] hover:bg-gray-200"
					>
						<RefreshCw size={16} />
					</IconButton>
				</div>

				<div className="flex-1 overflow-y-auto p-2">
					{cargandoCampanas ? (
						<div className="p-6 text-center text-[var(--app-text-subtle)]">
							<Loader2 className="animate-spin mx-auto mb-2" />
							Cargando campañas...
						</div>
					) : error ? (
						<div className="p-6 text-center text-red-500">{error}</div>
					) : campanas.length === 0 ? (
						<div className="p-6 text-center text-[var(--app-text-subtle)]">
							Aún no hay campañas.
						</div>
					) : (
						<div className="space-y-2">
							{campanas.map((campana) => (
								<div
									key={campana.campana_id}
									className={`rounded-sm border transition-colors ${
										campanaSeleccionadaId === campana.campana_id
											? "border-blue-200 bg-blue-50"
											: "border-gray-100 hover:bg-[var(--app-surface-muted)]"
									}`}
								>
									<button
										type="button"
										onClick={() => onSeleccionarCampana(campana.campana_id)}
										className="w-full text-left p-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="font-medium text-[var(--app-text)] truncate">
													{campana.nombre}
												</p>

												<p className="text-xs text-[var(--app-text-muted)] mt-1">
													{formatoFecha(campana.fecha_creacion)} · {campana.total}{" "}
													destinatarios
												</p>

												<div className="mt-2 h-1.5 bg-gray-200 rounded-sm overflow-hidden">
													<div
														className="h-full bg-blue-500"
														style={{
															width:
																campana.total > 0
																	? `${Math.min(
																			100,
																			Math.round(
																				(campana.procesados / campana.total) *
																					100,
																			),
																		)}%`
																	: "0%",
														}}
													/>
												</div>
											</div>

											<Badge
												className={`border ${
													ESTADOS_BADGE[campana.estado] ||
													"bg-gray-100 text-[var(--app-text-muted)] border-[var(--app-border)]"
												}`}
											>
												{campana.estado}
											</Badge>
										</div>
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</Card>

			<Card className="p-4">
				<div className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] pb-3">
					<div className="min-w-0">
						<h2 className="truncate text-base font-semibold text-[var(--app-text)]">
							{estadoCampana?.nombre || "Selecciona una campaña"}
						</h2>
						<p className="mt-1 text-sm text-[var(--app-text-muted)]">
							{estadoCampana
								? `${estadoCampana.procesados}/${estadoCampana.total} procesados`
								: "Sin campaña seleccionada"}
						</p>
					</div>

					{estadoCampana && (
						<Badge
							className={`border ${
								ESTADOS_BADGE[estadoActual] ||
								"bg-gray-100 text-[var(--app-text-muted)] border-[var(--app-border)]"
							}`}
						>
							{estadoActual}
						</Badge>
					)}
				</div>

				{estadoCampana && (
					<div className="pt-4">
						<div className="mb-4 h-2 w-full overflow-hidden rounded-sm bg-[var(--campaign-panel-track)]">
							<div
								className="h-full bg-[var(--app-primary)] transition-[width] duration-300"
								style={{ width: `${progreso}%` }}
							/>
						</div>

						<div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-border)] sm:grid-cols-4">
							<div className="bg-[var(--app-surface-muted)] p-3">
								<div className="text-xs text-[var(--app-text-muted)]">Enviados</div>
								<div className="mt-1 text-lg font-semibold text-[var(--intent-success-text)]">{estadoCampana.enviados}</div>
							</div>
							<div className="bg-[var(--app-surface-muted)] p-3">
								<div className="text-xs text-[var(--app-text-muted)]">Errores</div>
								<div className="mt-1 text-lg font-semibold text-[var(--intent-danger-text)]">{estadoCampana.errores}</div>
							</div>
							<div className="bg-[var(--app-surface-muted)] p-3">
								<div className="text-xs text-[var(--app-text-muted)]">Omitidos</div>
								<div className="mt-1 text-lg font-semibold text-[var(--intent-warning-text)]">{estadoCampana.omitidos}</div>
							</div>
							<div className="bg-[var(--app-surface-muted)] p-3">
								<div className="text-xs text-[var(--app-text-muted)]">Pendientes</div>
								<div className="mt-1 text-lg font-semibold text-[var(--app-text)]">{estadoCampana.pendientes}</div>
							</div>
						</div>

						<div className="flex gap-2">
							{esEnProgreso ? (
								<button
									type="button"
									onClick={onDetener}
									disabled={accionando}
									className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-[var(--intent-danger-border)] bg-[var(--intent-danger-bg)] px-4 py-2.5 text-sm font-medium text-[var(--intent-danger-text)] hover:bg-[var(--intent-danger-bg-hover)] disabled:opacity-50"
								>
									{accionando ? <Loader2 className="animate-spin" size={18} /> : <PauseCircle size={18} />}
									Detener
								</button>
							) : puedeReanudar ? (
								<button
									type="button"
									onClick={onReanudar}
									disabled={accionando}
									className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-[var(--app-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--app-primary-hover)] disabled:opacity-50"
								>
									{accionando ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
									Reanudar
								</button>
							) : puedeLanzar ? (
								<button
									type="button"
									onClick={onLanzar}
									disabled={accionando}
									className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-[var(--app-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--app-primary-hover)] disabled:opacity-50"
								>
									{accionando ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
									Lanzar
								</button>
							) : (
								<button type="button" disabled className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-2.5 text-sm font-medium text-[var(--app-text-subtle)]">
									<CheckCircle2 size={18} />
									Sin acciones
								</button>
							)}

							<IconButton label="Actualizar estado" onClick={onRefresh} disabled={accionando} buttonSize="md">
								<RefreshCw size={18} />
							</IconButton>
							<IconButton label="Editar campaña" onClick={onEditar} disabled={accionando || cargandoDetalle || !puedeEditar} buttonSize="md">
								{cargandoDetalle ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
							</IconButton>
							{puedeEliminar && (
								<IconButton label="Eliminar campaña" onClick={onEliminar} disabled={accionando} buttonSize="md" variant="danger">
									<Trash2 size={18} />
								</IconButton>
							)}
						</div>
					</div>
				)}
			</Card>

			<Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm">
				<div className="px-4 py-3 border-b border-gray-100 bg-[var(--app-surface-muted)] flex items-center justify-between">
					<h2 className="font-medium text-[var(--app-text)] flex items-center gap-2">
						<Clock size={18} className="text-blue-600" />
						Logs
					</h2>

					{estadoCampana?.mensaje && (
						<span className="text-xs text-[var(--app-text-muted)] truncate max-w-[260px]">
							{estadoCampana.mensaje}
						</span>
					)}
				</div>

				<div className="flex-1 overflow-y-auto p-3 space-y-2">
					{estadoCampana?.log_actividad?.length ? (
						estadoCampana.log_actividad.map((linea, index) => (
							<div
								key={`${linea}-${index}`}
								className="text-xs font-mono text-[var(--app-text-muted)] bg-[var(--app-surface-muted)] border border-gray-100 rounded px-2 py-1"
							>
								{linea}
							</div>
						))
					) : logs.length ? (
						logs.map((log) => (
							<div
								key={log.id}
								className="flex items-start gap-2 text-xs border border-gray-100 rounded-sm p-2"
							>
								{log.estado === "Éxito" ? (
									<CheckCircle2 size={15} className="text-green-500 mt-0.5" />
								) : log.estado === "Error" ? (
									<XCircle size={15} className="text-red-500 mt-0.5" />
								) : (
									<AlertCircle size={15} className="text-[var(--app-text-subtle)] mt-0.5" />
								)}

								<div className="min-w-0">
									<p className="font-semibold text-[var(--app-text-muted)] truncate">
										{log.email || log.nombre || `Cliente ${log.cliente_id}`}
									</p>

									<p className="text-[var(--app-text-muted)]">
										{log.estado} · {formatoFecha(log.fecha_envio)}
										{log.detalle_error ? ` · ${log.detalle_error}` : ""}
									</p>
								</div>
							</div>
						))
					) : (
						<div className="text-center text-[var(--app-text-subtle)] py-8 text-sm">
							Sin logs todavía.
						</div>
					)}
				</div>
			</Card>
		</div>
	);
}
