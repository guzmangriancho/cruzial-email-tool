import { useCallback, useEffect, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Loader2,
	Mail,
	MapPin,
	Phone,
	Star,
	Users,
} from "lucide-react";
import type { Cliente } from "../../types/crm";
import type { Segmento } from "../../types/segmentos";
import { obtenerClientesSegmento } from "../../services/segmentosService";
import { Button, Modal } from "../ui";

interface SegmentoClientesModalProps {
	abierto: boolean;
	segmento: Segmento | null;
	onClose: () => void;
}

const LIMITE = 50;

export default function SegmentoClientesModal({
	abierto,
	segmento,
	onClose,
}: SegmentoClientesModalProps) {
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [pagina, setPagina] = useState(0);
	const [total, setTotal] = useState(0);
	const [cargando, setCargando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const cargar = useCallback(async () => {
		if (!segmento) return;

		try {
			setCargando(true);
			setError(null);
			const respuesta = await obtenerClientesSegmento(segmento.id, pagina, LIMITE);
			setClientes(respuesta.clientes);
			setTotal(respuesta.total);
		} catch (err) {
			console.error("Error cargando clientes del segmento", err);
			setError("No se pudieron cargar los clientes del segmento.");
		} finally {
			setCargando(false);
		}
	}, [pagina, segmento]);

	useEffect(() => {
		if (!abierto) return;
		setPagina(0);
	}, [abierto, segmento?.id]);

	useEffect(() => {
		if (!abierto) return;
		cargar();
	}, [abierto, cargar]);

	if (!abierto || !segmento) return null;

	const puedeAnterior = pagina > 0 && !cargando;
	const puedeSiguiente = (pagina + 1) * LIMITE < total && !cargando;

	return (
		<Modal
			open={abierto}
			onClose={onClose}
			size="xl"
			icon={<Users size={22} />}
			title={segmento.nombre}
			description={`${total.toLocaleString("es-ES")} clientes · ${
				segmento.tipo === "dinamico" ? "segmento dinámico" : "lista fija"
			}`}
			bodyClassName="flex-1 overflow-auto p-0"
			footer={
				<>
					<span className="mr-auto text-sm font-semibold text-[var(--app-text-muted)]">
						Página {pagina + 1} · {total.toLocaleString("es-ES")} clientes
					</span>

					<Button
						type="button"
						onClick={() => setPagina((prev) => Math.max(0, prev - 1))}
						disabled={!puedeAnterior}
						size="sm"
						leftIcon={<ChevronLeft size={16} />}
					>
						Anterior
					</Button>

					<Button
						type="button"
						onClick={() => setPagina((prev) => prev + 1)}
						disabled={!puedeSiguiente}
						size="sm"
						rightIcon={<ChevronRight size={16} />}
					>
						Siguiente
					</Button>
				</>
			}
		>
			<div className="flex-1 overflow-auto">
					<table className="w-full min-w-[980px] text-left text-sm text-[var(--app-text-muted)]">
						<thead className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] text-xs font-medium uppercase text-[var(--app-text-muted)]">
							<tr>
								<th className="px-5 py-3">Cliente</th>
								<th className="px-5 py-3">Contacto</th>
								<th className="px-5 py-3">Ubicación</th>
								<th className="px-5 py-3">Reputación</th>
								<th className="px-5 py-3 text-right">Links</th>
							</tr>
						</thead>

						<tbody className="divide-y divide-gray-100">
							{cargando ? (
								<tr>
									<td colSpan={5} className="px-6 py-12 text-center text-[var(--app-text-subtle)]">
										<Loader2 size={24} className="mx-auto mb-2 animate-spin text-blue-500" />
										Cargando clientes...
									</td>
								</tr>
							) : error ? (
								<tr>
									<td colSpan={5} className="px-6 py-12 text-center font-semibold text-red-500">
										{error}
									</td>
								</tr>
							) : clientes.length === 0 ? (
								<tr>
									<td colSpan={5} className="px-6 py-12 text-center text-[var(--app-text-subtle)]">
										Este segmento no tiene clientes.
									</td>
								</tr>
							) : (
								clientes.map((cliente) => (
									<tr key={cliente.id} className="align-middle hover:bg-[var(--app-surface-muted)]">
										<td className="px-5 py-4">
											<div className="font-medium text-[var(--app-text)]">{cliente.nombre || "Sin nombre"}</div>
											<div className="mt-1 text-xs text-[var(--app-text-muted)]">{cliente.sector || cliente.categoria_google || "Sin sector"}</div>
										</td>

										<td className="px-5 py-4">
											<div className="flex items-start gap-2 break-all">
												<Mail size={14} className={cliente.email ? "mt-0.5 text-blue-500" : "mt-0.5 text-gray-300"} />
												{cliente.email ? (
													<a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline">
														{cliente.email}
													</a>
												) : (
													<span className="text-xs italic text-[var(--app-text-subtle)]">Sin email</span>
												)}
											</div>

											<div className="mt-1 flex items-center gap-2 text-[var(--app-text-muted)]">
												<Phone size={14} className={cliente.telefono ? "text-green-600" : "text-gray-300"} />
												<span>{cliente.telefono || "Sin teléfono"}</span>
											</div>
										</td>

										<td className="px-5 py-4">
											<div className="font-medium text-[var(--app-text-muted)]">{cliente.ciudad || "Sin ciudad"}</div>
											{cliente.direccion && (
												<div className="mt-1 flex items-start gap-1 text-xs text-[var(--app-text-muted)]">
													<MapPin size={12} className="mt-0.5 shrink-0" />
													<span>{cliente.direccion}</span>
												</div>
											)}
										</td>

										<td className="px-5 py-4">
											{cliente.valoracion !== null && cliente.valoracion !== undefined ? (
												<div>
													<div className="flex items-center gap-1 font-medium text-[var(--app-text)]">
														<Star size={14} className="fill-amber-400 text-amber-400" />
														{cliente.valoracion}
													</div>
													<div className="mt-0.5 text-xs text-[var(--app-text-subtle)]">
														{cliente.num_resenas ? `${cliente.num_resenas.toLocaleString("es-ES")} reseñas` : "Sin reseñas"}
													</div>
												</div>
											) : (
												<span className="text-xs text-[var(--app-text-subtle)]">Sin valoración</span>
											)}
										</td>

										<td className="px-5 py-4 text-right">
											<div className="inline-flex items-center gap-2">
												{cliente.url_maps && (
													<a href={cliente.url_maps} target="_blank" rel="noreferrer" className="rounded-sm p-2 text-[var(--app-text-subtle)] hover:bg-green-50 hover:text-green-600">
														<MapPin size={17} />
													</a>
												)}

												{cliente.sitio_web && (
													<a href={cliente.sitio_web} target="_blank" rel="noreferrer" className="rounded-sm p-2 text-[var(--app-text-subtle)] hover:bg-blue-50 hover:text-blue-600">
														<ExternalLink size={17} />
													</a>
												)}
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
		</Modal>
	);
}
