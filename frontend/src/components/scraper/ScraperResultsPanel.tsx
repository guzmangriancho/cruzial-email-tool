import { CheckCircle, Loader2, MapPin, Navigation, Phone, Search, Terminal } from "lucide-react";

import { Badge, Card } from "../ui";
import type { ClienteExtraido, EstadoFila } from "../../types/scraper";

export function LogsPanel({ logs, polling }: { logs: string[]; polling: boolean }) {
	return (
		<div className="flex min-h-[220px] max-h-[340px] flex-col overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm lg:max-h-[380px] xl:max-h-[420px]">
			<div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-xs text-[var(--app-text-muted)]">
				<span className="flex items-center gap-2">
					<Terminal size={14} />
					Actividad
				</span>

				<span className={polling ? "text-[var(--intent-success-text)]" : "text-[var(--app-text-subtle)]"}>
					● {polling ? "LIVE" : "PAUSADO"}
				</span>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 font-mono text-[11px] leading-relaxed text-[var(--app-text-muted)]">
				{logs.length === 0 ? (
					<div className="h-full flex items-center justify-center text-[var(--app-text-subtle)]">
						Sin actividad todavía.
					</div>
				) : (
					logs.map((log, index) => (
						<div
							key={`${log}-${index}`}
							className={index === 0 ? "font-semibold text-[var(--app-text)]" : "text-[var(--app-text-muted)]"}
						>
							{log}
						</div>
					))
				)}
			</div>
		</div>
	);
}

export function MapPanel({
	mapUrl,
	coords,
}: {
	mapUrl: string;
	coords?: [number, number];
}) {
	return (
		<Card className="relative h-full min-h-[260px] overflow-hidden rounded-sm">
			<div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-raised)] px-3 py-2 shadow-sm">
				<MapPin size={15} className="text-red-600" />
				<div>
					<div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
						Ubicación actual
					</div>
					{coords && (
						<div className="text-[10px] font-mono text-[var(--app-text-subtle)]">
							{coords[0].toFixed(5)}, {coords[1].toFixed(5)}
						</div>
					)}
				</div>
			</div>

			{!mapUrl ? (
				<div className="h-full w-full flex flex-col items-center justify-center bg-[var(--app-surface-muted)] text-[var(--app-text-subtle)]">
					<Navigation size={28} className="mb-2" />
					<div className="text-sm font-medium">Esperando coordenadas</div>
					<div className="text-xs mt-1">
						El mapa se moverá durante la extracción.
					</div>
				</div>
			) : (
				<iframe
					title="Ubicación actual del scraper"
					className="h-full w-full border-0 grayscale-[0.15] contrast-[1.05]"
					scrolling="no"
					src={mapUrl}
				/>
			)}
		</Card>
	);
}

export function ResultTable({
	clientes,
	coordsActuales,
	polling,
}: {
	clientes: ClienteExtraido[];
	coordsActuales?: [number, number];
	polling: boolean;
}) {
	return (
		<Card className="overflow-hidden">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
				<div>
					<h2 className="flex items-center gap-2 text-lg font-medium text-[var(--app-text)]">
						<CheckCircle size={18} className="text-green-600" />
						Resultados en tiempo real
					</h2>
					<p className="mt-0.5 text-sm text-[var(--app-text-muted)]">
						Fichas detectadas, enriquecidas, omitidas o ya existentes.
					</p>
				</div>

				<div className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-subtle)]">
					{polling ? "Extracción activa" : "Extracción pausada o finalizada"}
				</div>
			</div>

			<div className="max-h-[520px] overflow-auto">
				<table className="w-full min-w-[860px] text-left text-sm text-[var(--app-text-muted)]">
					<thead className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] text-xs uppercase text-[var(--app-text-muted)]">
						<tr>
							<th className="px-5 py-3 w-[34%]">Entidad</th>
							<th className="px-5 py-3 w-[28%]">Email</th>
							<th className="px-5 py-3 w-[15%]">Teléfono</th>
							<th className="px-5 py-3 w-[14%]">Localidad</th>
							<th className="px-5 py-3 text-right w-[9%]">Estado</th>
						</tr>
					</thead>

					<tbody className="divide-y divide-gray-100">
						{clientes.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-5 py-14 text-center">
									<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-gray-100 text-[var(--app-text-subtle)]">
										<Search size={22} />
									</div>
									<div className="font-medium text-[var(--app-text-muted)]">
										Aún no hay resultados
									</div>
									<div className="mt-1 text-sm text-[var(--app-text-subtle)]">
										Lanza una búsqueda para ver las fichas extraídas.
									</div>
								</td>
							</tr>
						) : (
							clientes.map((cliente, index) => {
								const isFocused =
									coordsActuales?.[0] === cliente.latitud &&
									coordsActuales?.[1] === cliente.longitud;

								return (
									<tr
										key={cliente.id_temp || `${cliente.nombre}-${index}`}
										className={`transition-colors ${
											isFocused
												? "bg-blue-50 ring-1 ring-inset ring-blue-200"
												: cliente.estado_fila === "duplicado"
													? "bg-[var(--app-primary-soft)]"
													: cliente.estado_fila === "descartado"
														? "bg-red-50/30 opacity-70"
														: "hover:bg-[var(--app-surface-muted)]"
										}`}
									>
										<td className="px-5 py-3 align-middle">
											<div className="flex items-start gap-2 min-w-0">
												{isFocused && (
													<MapPin
														size={15}
														className="mt-0.5 shrink-0 text-red-500 fill-red-500"
													/>
												)}

												<div className="min-w-0">
													<div className="font-medium text-[var(--app-text)] truncate">
														{cliente.nombre || "Sin nombre"}
													</div>
													<div className="mt-0.5 text-xs text-[var(--app-text-subtle)] truncate">
														{cliente.sector || "Sin sector"}
													</div>
												</div>
											</div>
										</td>

										<td className="px-5 py-3 align-middle font-mono text-xs">
											<EmailCell cliente={cliente} />
										</td>

										<td className="px-5 py-3 align-middle text-xs">
											<div className="flex items-center gap-1.5 text-[var(--app-text-muted)]">
												<Phone size={13} className="text-[var(--app-text-subtle)]" />
												{cliente.telefono || "-"}
											</div>
										</td>

										<td className="px-5 py-3 align-middle text-xs text-[var(--app-text-muted)]">
											{cliente.ciudad || "-"}
										</td>

										<td className="px-5 py-3 align-middle text-right">
											<EstadoBadge estado={cliente.estado_fila} />
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</Card>
	);
}

function EmailCell({ cliente }: { cliente: ClienteExtraido }) {
	if (cliente.estado_fila === "cargando") {
		return (
			<span className="inline-flex items-center gap-2 text-amber-600 italic">
				<Loader2 size={12} className="animate-spin" />
				Buscando email...
			</span>
		);
	}

	if (cliente.estado_fila === "duplicado") {
		return <span className="font-medium text-[var(--app-highlight)]">Ya existe</span>;
	}

	if (cliente.estado_fila === "descartado") {
		return <span className="text-red-400">No localizado</span>;
	}

	return (
		<span className="font-medium text-blue-600 break-all">
			{cliente.email || "Sin email"}
		</span>
	);
}

function EstadoBadge({ estado }: { estado?: EstadoFila }) {
	if (estado === "completado") {
		return (
			<Badge variant="green" className="text-[10px] uppercase tracking-wide">
				Capturado
			</Badge>
		);
	}

	if (estado === "duplicado") {
		return (
			<Badge variant="purple" className="text-[10px] uppercase tracking-wide">
				Ya existe
			</Badge>
		);
	}

	if (estado === "cargando") {
		return (
			<Badge variant="amber" className="text-[10px] uppercase tracking-wide">
				En cola
			</Badge>
		);
	}

	return (
		<Badge variant="neutral" className="text-[10px] uppercase tracking-wide text-[var(--app-text-subtle)]">
			Omitido
		</Badge>
	);
}
