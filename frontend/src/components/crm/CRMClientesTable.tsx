import type { ReactNode } from "react";
import {
	ArrowUpDown,
	CalendarDays,
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Loader2,
	Mail,
	MapPin,
	Phone,
	Pencil,
	Square,
	Star,
	Trash2,
} from "lucide-react";
import type { Cliente, SortField } from "../../types/crm";
import { formatFechaCaptacion } from "../../utils/crmUtils";
import { Button, Card, IconButton } from "../ui";

interface CRMClientesTableProps {
	clientes: Cliente[];
	sortedClientes: Cliente[];
	cargando: boolean;
	error: string | null;
	seleccionados: number[];
	enriqueciendoId: number | null;
	isProcessingAny: boolean;
	pagina: number;
	limitePorPagina: number;
	poligonoActivo: boolean;
	onSort: (field: SortField) => void;
	onToggleSeleccion: (id: number) => void;
	onToggleSeleccionarTodo: () => void;
	onEditarCliente: (cliente: Cliente) => void;
	onEliminarCliente: (id: number, nombre: string) => void;
	onPaginaAnterior: () => void;
	onPaginaSiguiente: () => void;
}

function IconAction({
	children,
	title,
	onClick,
	disabled,
	className = "text-[var(--app-text-subtle)] hover:text-blue-600",
}: {
	children: ReactNode;
	title: string;
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<IconButton
			label={title}
			onClick={onClick}
			disabled={disabled}
			buttonSize="xs"
			className={className}
		>
			{children}
		</IconButton>
	);
}

export default function CRMClientesTable({
	clientes,
	sortedClientes,
	cargando,
	error,
	seleccionados,
	enriqueciendoId,
	isProcessingAny,
	pagina,
	limitePorPagina,
	poligonoActivo,
	onSort,
	onToggleSeleccion,
	onToggleSeleccionarTodo,
	onEditarCliente,
	onEliminarCliente,
	onPaginaAnterior,
	onPaginaSiguiente,
}: CRMClientesTableProps) {
	return (
		<Card className="flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-sm">
			<div className="overflow-auto flex-1">
				<table className="w-full min-w-[1240px] table-fixed text-left text-sm text-[var(--app-text-muted)] relative">
					<colgroup>
						<col className="w-[52px]" />
						<col className="w-[27%]" />
						<col className="w-[31%]" />
						<col className="w-[22%]" />
						<col className="w-[128px]" />
						<col className="w-[176px]" />
					</colgroup>

					<thead className="bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] font-semibold border-b border-[var(--app-border)] sticky top-0 z-10 shadow-sm">
						<tr>
							<th className="px-3 py-3 text-center align-middle">
								<IconButton
									label="Seleccionar todos los clientes de esta página"
									onClick={onToggleSeleccionarTodo}
									disabled={clientes.length === 0}
									buttonSize="xs"
									className="text-[var(--app-text-muted)] hover:bg-[var(--app-surface-raised)] hover:text-blue-600"
								>
									{clientes.length > 0 && seleccionados.length === clientes.length ? (
										<CheckSquare size={18} />
									) : (
										<Square size={18} />
									)}
								</IconButton>
							</th>

							<th
								className="px-5 py-3 cursor-pointer hover:bg-gray-100 transition-colors align-middle"
								onClick={() => onSort("nombre")}
							>
								<div className="flex items-center gap-1">
									Negocio / Entidad <ArrowUpDown size={14} className="text-[var(--app-text-subtle)]" />
								</div>
							</th>

							<th className="px-5 py-3 align-middle">Contacto</th>

							<th
								className="px-5 py-3 cursor-pointer hover:bg-gray-100 transition-colors align-middle"
								onClick={() => onSort("ciudad")}
							>
								<div className="flex items-center gap-1">
									Ubicación <ArrowUpDown size={14} className="text-[var(--app-text-subtle)]" />
								</div>
							</th>

							<th
								className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors align-middle"
								onClick={() => onSort("valoracion")}
							>
								<div className="flex items-center gap-1">
									Reputación <ArrowUpDown size={14} className="text-[var(--app-text-subtle)]" />
								</div>
							</th>

							<th className="px-4 py-3 text-right align-middle">Acciones</th>
						</tr>
					</thead>

					<tbody className="divide-y divide-gray-100">
						{cargando ? (
							<tr>
								<td colSpan={6} className="px-6 py-12 text-center text-[var(--app-text-subtle)]">
									<Loader2 className="animate-spin mx-auto mb-2 text-blue-500" size={24} />
									Cargando datos...
								</td>
							</tr>
						) : error ? (
							<tr>
								<td colSpan={6} className="px-6 py-12 text-center text-red-500 font-medium">
									{error}
								</td>
							</tr>
						) : sortedClientes.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-6 py-12 text-center text-[var(--app-text-subtle)]">
									No hay clientes con estos filtros.
								</td>
							</tr>
						) : (
							sortedClientes.map((cliente) => {
								const estaSeleccionado = seleccionados.includes(cliente.id);
								const fechaCaptacion = formatFechaCaptacion(cliente.fecha_captacion);

								return (
									<tr
										key={cliente.id}
										className={`transition-colors ${
											estaSeleccionado
												? "bg-blue-50/50"
												: enriqueciendoId === cliente.id
													? "bg-[var(--app-primary-soft)]"
													: "hover:bg-[var(--app-surface-muted)]"
										}`}
									>
										<td className="px-3 py-3 text-center align-middle">
											<IconButton
												label={estaSeleccionado ? "Quitar selección" : "Seleccionar cliente"}
												onClick={() => onToggleSeleccion(cliente.id)}
												buttonSize="xs"
												className="text-[var(--app-text-subtle)] hover:bg-[var(--app-surface-raised)] hover:text-blue-600"
											>
												{estaSeleccionado ? (
													<CheckSquare size={18} className="text-blue-600" />
												) : (
													<Square size={18} />
												)}
											</IconButton>
										</td>

										<td className="px-5 py-3 align-middle">
											<div className="font-medium text-[var(--app-text)] text-base leading-snug break-words">
												{cliente.nombre || "Sin nombre"}
											</div>

											<div className="text-xs text-[var(--app-text-muted)] mt-1 leading-snug">
												{cliente.sector || cliente.categoria_google || "Sin sector"}
											</div>
										</td>

										<td className="px-5 py-3 align-middle">
											<div className="flex items-center gap-2 min-w-0">
												<Mail
													size={14}
													className={`${cliente.email ? "text-blue-500" : "text-red-500"} shrink-0`}
												/>

												{cliente.email ? (
													<a
														href={`mailto:${cliente.email}`}
														className="hover:underline text-blue-600 break-all leading-snug"
														title={cliente.email}
													>
														{cliente.email}
													</a>
												) : (
													<span className="text-red-500 text-xs font-medium italic">Sin email</span>
												)}
											</div>

											{cliente.telefono ? (
												<div className="flex items-center gap-2 mt-1 text-[var(--app-text-muted)] whitespace-nowrap">
													<Phone size={14} className="text-green-600 shrink-0" /> {cliente.telefono}
												</div>
											) : (
												<div className="flex items-center gap-2 mt-1 text-[var(--app-text-subtle)] text-xs italic">
													<Phone size={14} className="shrink-0" /> Sin teléfono
												</div>
											)}
										</td>

										<td className="px-5 py-3 text-[var(--app-text-muted)] align-middle">
											{cliente.ciudad ? (
												<div className="font-medium leading-snug break-words">{cliente.ciudad}</div>
											) : (
												<div className="text-[var(--app-text-subtle)] text-xs italic">Sin ciudad</div>
											)}

											{cliente.direccion && (
												<div className="flex items-start gap-1 mt-1 text-xs text-[var(--app-text-muted)] min-w-0">
													<MapPin size={12} className="mt-0.5 shrink-0" />
													<span className="break-words leading-snug" title={cliente.direccion}>
														{cliente.direccion}
													</span>
												</div>
											)}
										</td>

										<td className="px-4 py-3 align-middle">
											{cliente.valoracion !== null && cliente.valoracion !== undefined ? (
												<div>
													<div className="flex items-center gap-1 font-medium text-[var(--app-text)]">
														<Star size={14} className="text-amber-400 fill-amber-400" /> {cliente.valoracion}
													</div>

													<div className="text-xs text-[var(--app-text-subtle)] mt-0.5 leading-snug">
														{cliente.num_resenas !== null && cliente.num_resenas !== undefined
															? `(${cliente.num_resenas.toLocaleString("es-ES")} reseñas)`
															: "Sin nº reseñas"}
													</div>
												</div>
											) : (
												<span className="text-[var(--app-text-subtle)] text-xs">-</span>
											)}
										</td>

										<td className="px-4 py-3 text-right align-middle">
											<div className="flex items-center justify-end gap-1.5">
												{fechaCaptacion && (
													<span
														className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-gray-300"
														title={`Captado ${fechaCaptacion}`}
													>
														<CalendarDays size={16} />
													</span>
												)}

												<IconAction
													onClick={() => onEditarCliente(cliente)}
													disabled={isProcessingAny}
													title="Editar cliente manualmente"
												>
													<Pencil size={18} />
												</IconAction>

												{cliente.url_maps && (
													<a
														href={cliente.url_maps}
														target="_blank"
														rel="noreferrer"
														className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-[var(--app-text-subtle)] transition-colors hover:text-green-600"
														title="Abrir en Google Maps"
													>
														<MapPin size={18} />
													</a>
												)}

												{cliente.sitio_web && (
													<a
														href={cliente.sitio_web}
														target="_blank"
														rel="noreferrer"
														className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-[var(--app-text-subtle)] transition-colors hover:text-blue-600"
														title="Ir a la web"
													>
														<ExternalLink size={18} />
													</a>
												)}

												<IconAction
													onClick={() => onEliminarCliente(cliente.id, cliente.nombre || "Sin nombre")}
													disabled={isProcessingAny}
													title="Eliminar"
													className="text-[var(--app-text-subtle)] hover:text-red-600"
												>
													<Trash2 size={18} />
												</IconAction>
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			<div className="bg-[var(--app-surface-muted)] border-t border-[var(--app-border)] p-4 flex items-center justify-between">
				<span className="text-sm font-semibold text-[var(--app-text-muted)]">
					Página {pagina + 1}
					{poligonoActivo && <span className="ml-2 text-green-700">· filtro por zona activo</span>}
				</span>

				<div className="flex gap-2">
					<Button
						type="button"
						onClick={onPaginaAnterior}
						disabled={pagina === 0 || isProcessingAny}
						size="sm"
						leftIcon={<ChevronLeft size={16} />}
					>
						Anterior
					</Button>

					<Button
						type="button"
						onClick={onPaginaSiguiente}
						disabled={clientes.length < limitePorPagina || isProcessingAny}
						size="sm"
						rightIcon={<ChevronRight size={16} />}
					>
						Siguiente
					</Button>
				</div>
			</div>
		</Card>
	);
}
