import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	MapContainer,
	TileLayer,
	CircleMarker,
	Marker,
	Popup,
	useMap,
	useMapEvents,
} from "react-leaflet";
import { divIcon } from "leaflet";
import type { LatLngBounds } from "leaflet";
import {
	ExternalLink,
	Filter,
	Globe2,
	Layers,
	Loader2,
	Mail,
	MapPin,
	Navigation,
	Phone,
	RefreshCcw,
	Search,
	Star,
	X,
} from "lucide-react";

import { Button, Card, EmptyState, Input, PageHeader, PageShell, Select, cx, ui } from "../components/ui";
import { obtenerClientesMapa, obtenerSectores } from "../services/clientesService";
import type { ClienteFilters, ClienteMapa, FiltroPresencia } from "../types/crm";

import "leaflet/dist/leaflet.css";

type ClienteMapaConCoords = ClienteMapa & {
	latitud: number;
	longitud: number;
};

type ClienteCluster = {
	id: string;
	lat: number;
	lng: number;
	clientes: ClienteMapaConCoords[];
};

const ZOOM_MAX_CLUSTER = 13;
const DEFAULT_CENTER: [number, number] = [43.4623, -3.8099];
const DEFAULT_ZOOM = 8;
const MAPA_LAYER_STORAGE_KEY = "cruzial_mapa_layer";

type MapaLayerId = "claro" | "estandar" | "oscuro" | "satelite";

const MAPA_LAYERS: Array<{
	id: MapaLayerId;
	label: string;
	url: string;
	attribution: string;
}> = [
	{
		id: "claro",
		label: "Claro",
		url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
		attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
	},
	{
		id: "estandar",
		label: "Mapa",
		url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
		attribution: '&copy; OpenStreetMap contributors',
	},
	{
		id: "oscuro",
		label: "Oscuro",
		url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
		attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
	},
	{
		id: "satelite",
		label: "Satélite",
		url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
		attribution: 'Tiles &copy; Esri',
	},
];

function isMapaLayerId(value: string | null): value is MapaLayerId {
	return Boolean(value && MAPA_LAYERS.some((layer) => layer.id === value));
}

function leerMapaLayerGuardado(): MapaLayerId {
	if (typeof window === "undefined") return "claro";

	const guardado = window.localStorage.getItem(MAPA_LAYER_STORAGE_KEY);
	return isMapaLayerId(guardado) ? guardado : "claro";
}

function filtroPresenciaParam(valor: FiltroPresencia) {
	return valor === "todos" ? undefined : valor;
}

function construirFiltrosMapa(state: FiltrosMapaState): ClienteFilters {
	return {
		busqueda: state.busqueda.trim() || undefined,
		sector: state.sector || undefined,
		valoracion_min:
			state.valoracionMin === "" ? undefined : Number(state.valoracionMin),
		email_estado: filtroPresenciaParam(state.email),
		telefono_estado: filtroPresenciaParam(state.telefono),
		sitio_web_estado: filtroPresenciaParam(state.web),
		url_maps_estado: filtroPresenciaParam(state.maps),
		sort_by: "fecha_captacion",
		sort_dir: "desc",
	};
}

function calcularTamanoCelda(zoom: number): number {
	if (zoom <= 5) return 2.5;
	if (zoom <= 6) return 1.5;
	if (zoom <= 7) return 0.9;
	if (zoom <= 8) return 0.55;
	if (zoom <= 9) return 0.32;
	if (zoom <= 10) return 0.2;
	if (zoom <= 11) return 0.12;
	if (zoom <= 12) return 0.07;
	return 0.04;
}

function crearClusters(clientes: ClienteMapaConCoords[], zoom: number): ClienteCluster[] {
	if (zoom > ZOOM_MAX_CLUSTER) {
		return clientes.map((cliente) => ({
			id: `cliente-${cliente.id}`,
			lat: cliente.latitud,
			lng: cliente.longitud,
			clientes: [cliente],
		}));
	}

	const cellSize = calcularTamanoCelda(zoom);
	const grupos = new Map<string, ClienteMapaConCoords[]>();

	clientes.forEach((cliente) => {
		const latKey = Math.floor(cliente.latitud / cellSize);
		const lngKey = Math.floor(cliente.longitud / cellSize);
		const key = `${latKey}:${lngKey}`;
		const grupo = grupos.get(key) ?? [];

		grupo.push(cliente);
		grupos.set(key, grupo);
	});

	return Array.from(grupos.entries()).map(([key, grupo]) => {
		const lat = grupo.reduce((acc, cliente) => acc + cliente.latitud, 0) / grupo.length;
		const lng = grupo.reduce((acc, cliente) => acc + cliente.longitud, 0) / grupo.length;

		return {
			id: `cluster-${key}`,
			lat,
			lng,
			clientes: grupo,
		};
	});
}

function crearIconoCluster(total: number) {
	const size = total < 10 ? 34 : total < 100 ? 42 : 52;

	return divIcon({
		className: "",
		html: `
			<div style="
				width:${size}px;
				height:${size}px;
				border-radius:var(--app-radius-full);
				background:var(--app-primary);
				border:3px solid var(--app-surface);
				box-shadow:var(--app-shadow-md);
				color:var(--app-text-inverse);
				display:flex;
				align-items:center;
				justify-content:center;
				font-weight:800;
				font-size:${total < 100 ? 13 : 12}px;
			">
				${total}
			</div>
		`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	});
}

function formatNumero(numero: number) {
	return numero.toLocaleString("es-ES");
}

function formatFecha(fecha?: string | null) {
	if (!fecha) return null;

	try {
		return new Intl.DateTimeFormat("es-ES", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		}).format(new Date(fecha));
	} catch {
		return null;
	}
}

function popupCliente(cliente: ClienteMapaConCoords) {
	return (
		<div className="min-w-[240px] text-sm text-[var(--app-text)]">
			<div className="text-base font-medium leading-tight text-[var(--app-text)]">
				{cliente.nombre || "Sin nombre"}
			</div>

			<div className="mt-1 text-xs text-[var(--app-text-muted)]">
				{cliente.sector || cliente.categoria_google || "Sin sector"}
				{cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
			</div>

			{cliente.valoracion !== null && cliente.valoracion !== undefined && (
				<div className="mt-2 flex items-center gap-1 text-[var(--app-text-muted)]">
					<Star size={13} className="text-amber-400 fill-amber-400" />
					<span className="font-semibold">{cliente.valoracion}</span>
					{cliente.num_resenas !== null && cliente.num_resenas !== undefined && (
						<span className="text-xs text-[var(--app-text-muted)]">
							({formatNumero(cliente.num_resenas)} reseñas)
						</span>
					)}
				</div>
			)}

			<div className="mt-3 space-y-1.5">
				{cliente.email && (
					<a
						href={`mailto:${cliente.email}`}
						className="flex items-center gap-2 break-all text-[var(--app-primary-text)] hover:underline"
					>
						<Mail size={13} />
						{cliente.email}
					</a>
				)}

				{cliente.telefono && (
					<div className="flex items-center gap-2 text-[var(--app-text-muted)]">
						<Phone size={13} />
						{cliente.telefono}
					</div>
				)}

				{cliente.direccion && (
					<div className="flex items-start gap-2 text-[var(--app-text-muted)]">
						<MapPin size={13} className="mt-0.5 shrink-0" />
						<span>{cliente.direccion}</span>
					</div>
				)}
			</div>

			<div className="mt-3 flex items-center gap-2 flex-wrap">
				{cliente.url_maps && (
					<a
						href={cliente.url_maps}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 rounded-sm bg-[var(--intent-success-bg)] px-2 py-1 font-semibold text-[var(--intent-success-text)] hover:bg-[var(--intent-success-bg-hover)]"
					>
						<MapPin size={13} />
						Maps
					</a>
				)}

				{cliente.sitio_web && (
					<a
						href={cliente.sitio_web}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 rounded-sm bg-[var(--intent-info-bg)] px-2 py-1 font-semibold text-[var(--intent-info-text)] hover:bg-[var(--intent-info-bg-hover)]"
					>
						<ExternalLink size={13} />
						Web
					</a>
				)}
			</div>
		</div>
	);
}

function PopupCluster({ clientes }: { clientes: ClienteMapaConCoords[] }) {
	const primeros = clientes.slice(0, 10);
	const restantes = clientes.length - primeros.length;

	return (
		<div className="min-w-[240px] text-sm text-[var(--app-text)]">
			<div className="mb-2 font-medium text-[var(--app-text)]">
				{formatNumero(clientes.length)} clientes en esta zona
			</div>

			<div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
				{primeros.map((cliente) => (
					<div key={cliente.id} className="border-b border-[var(--app-border)] pb-1.5 last:border-b-0">
						<div className="font-semibold text-[var(--app-text)]">
							{cliente.nombre || "Sin nombre"}
						</div>
						<div className="text-xs text-[var(--app-text-muted)]">
							{cliente.ciudad || "Sin ciudad"} · {cliente.sector || cliente.categoria_google || "Sin sector"}
						</div>
					</div>
				))}
			</div>

			{restantes > 0 && (
				<div className="mt-2 text-xs font-semibold text-[var(--app-text-muted)]">
					+{formatNumero(restantes)} más. Acerca el zoom para separarlos.
				</div>
			)}
		</div>
	);
}

function ClienteMarker({ cliente }: { cliente: ClienteMapaConCoords }) {
	return (
		<CircleMarker
			center={[cliente.latitud, cliente.longitud]}
			radius={6}
			weight={2}
			fillOpacity={0.75}
			pathOptions={{
				color: "var(--app-primary)",
				fillColor: "var(--app-primary)",
			}}
		>
			<Popup>{popupCliente(cliente)}</Popup>
		</CircleMarker>
	);
}

function ClientesClusterLayer({ clientes }: { clientes: ClienteMapaConCoords[] }) {
	const map = useMap();
	const [zoom, setZoom] = useState(map.getZoom());
	const [bounds, setBounds] = useState<LatLngBounds>(() => map.getBounds());

	useMapEvents({
		zoomend() {
			setZoom(map.getZoom());
			setBounds(map.getBounds());
		},
		moveend() {
			setBounds(map.getBounds());
		},
	});

	const clientesVisibles = useMemo(() => {
		const boundsExtendidos = bounds.pad(0.35);

		return clientes.filter((cliente) =>
			boundsExtendidos.contains([cliente.latitud, cliente.longitud]),
		);
	}, [bounds, clientes]);

	const clusters = useMemo(
		() => crearClusters(clientesVisibles, zoom),
		[clientesVisibles, zoom],
	);

	return (
		<>
			{clusters.map((cluster) => {
				if (cluster.clientes.length === 1) {
					return <ClienteMarker key={cluster.id} cliente={cluster.clientes[0]} />;
				}

				return (
					<Marker
						key={cluster.id}
						position={[cluster.lat, cluster.lng]}
						icon={crearIconoCluster(cluster.clientes.length)}
						eventHandlers={{
							click: () => {
								map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 16));
							},
						}}
					>
						<Popup>
							<PopupCluster clientes={cluster.clientes} />
						</Popup>
					</Marker>
				);
			})}
		</>
	);
}

function AjustarVistaMapa({
	clientes,
	version,
}: {
	clientes: ClienteMapaConCoords[];
	version: number;
}) {
	const map = useMap();

	useEffect(() => {
		if (clientes.length === 0) {
			map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
			return;
		}

		if (clientes.length === 1) {
			map.setView([clientes[0].latitud, clientes[0].longitud], 14);
			return;
		}

		const bounds = clientes.map((cliente) => [cliente.latitud, cliente.longitud]) as [number, number][];

		map.fitBounds(bounds, {
			padding: [36, 36],
			maxZoom: 13,
		});
	}, [clientes, map, version]);

	return null;
}

function VolarACliente({ cliente }: { cliente: ClienteMapaConCoords | null }) {
	const map = useMap();

	useEffect(() => {
		if (!cliente) return;

		map.flyTo([cliente.latitud, cliente.longitud], 16, {
			duration: 0.75,
		});
	}, [cliente, map]);

	return null;
}

type FiltrosMapaState = {
	busqueda: string;
	sector: string;
	valoracionMin: number | "";
	email: FiltroPresencia;
	telefono: FiltroPresencia;
	web: FiltroPresencia;
	maps: FiltroPresencia;
};

const filtrosIniciales: FiltrosMapaState = {
	busqueda: "",
	sector: "",
	valoracionMin: "",
	email: "todos",
	telefono: "todos",
	web: "todos",
	maps: "todos",
};

export default function MapaPage() {
	const [clientes, setClientes] = useState<ClienteMapa[]>([]);
	const [sectores, setSectores] = useState<string[]>([]);
	const [filtros, setFiltros] = useState<FiltrosMapaState>(filtrosIniciales);
	const [cargando, setCargando] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [mostrarPanel, setMostrarPanel] = useState(true);
	const [mapaLayerId, setMapaLayerId] = useState<MapaLayerId>(() => leerMapaLayerGuardado());
	const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);
	const [fitVersion, setFitVersion] = useState(0);

	const clientesConCoords = useMemo(
		() =>
			clientes.filter(
				(cliente): cliente is ClienteMapaConCoords =>
					cliente.latitud !== null && cliente.longitud !== null,
			),
		[clientes],
	);

	const clienteSeleccionado = useMemo(
		() => clientesConCoords.find((cliente) => cliente.id === selectedClienteId) ?? null,
		[clientesConCoords, selectedClienteId],
	);

	const resumen = useMemo(() => {
		const conEmail = clientesConCoords.filter((cliente) => Boolean(cliente.email)).length;
		const conTelefono = clientesConCoords.filter((cliente) => Boolean(cliente.telefono)).length;
		const conWeb = clientesConCoords.filter((cliente) => Boolean(cliente.sitio_web)).length;
		const conMaps = clientesConCoords.filter((cliente) => Boolean(cliente.url_maps)).length;

		return { conEmail, conTelefono, conWeb, conMaps };
	}, [clientesConCoords]);

	const mapaLayer = useMemo(
		() => MAPA_LAYERS.find((layer) => layer.id === mapaLayerId) ?? MAPA_LAYERS[0],
		[mapaLayerId],
	);

	const cargarMapa = useCallback(async () => {
		try {
			setCargando(true);
			setError(null);

			const data = await obtenerClientesMapa(construirFiltrosMapa(filtros));
			setClientes(data);
			setSelectedClienteId(null);
			setFitVersion((prev) => prev + 1);
		} catch (err) {
			console.error("Error cargando mapa:", err);
			setError("No se pudieron cargar los puntos del mapa.");
		} finally {
			setCargando(false);
		}
	}, [filtros]);

	useEffect(() => {
		obtenerSectores()
			.then(setSectores)
			.catch((err) => console.error("Error cargando sectores:", err));
	}, []);

	useEffect(() => {
		cargarMapa();
	}, [cargarMapa]);

	useEffect(() => {
		window.localStorage.setItem(MAPA_LAYER_STORAGE_KEY, mapaLayerId);
	}, [mapaLayerId]);

	const limpiarFiltros = () => {
		setFiltros(filtrosIniciales);
	};

	return (
		<PageShell fill className="flex flex-col overflow-hidden">
			<PageHeader
				title="Mapa"
				description="Vista geográfica de todos los clientes con coordenadas."
				actions={
					<>
						<StatPill label="Puntos" value={clientesConCoords.length} />
						<StatPill label="Email" value={resumen.conEmail} />
						<StatPill label="Teléfono" value={resumen.conTelefono} />
						<StatPill label="Web" value={resumen.conWeb} />

						<Button
							onClick={() => setMostrarPanel((prev) => !prev)}
							variant="secondary"
							size="sm"
							leftIcon={<Filter size={17} />}
						>
							{mostrarPanel ? "Ocultar filtros" : "Mostrar filtros"}
						</Button>

						<Button
							onClick={cargarMapa}
							disabled={cargando}
							variant="primary"
							size="sm"
							isLoading={cargando}
							leftIcon={<RefreshCcw size={17} />}
						>
							Recargar
						</Button>
					</>
				}
			/>

			<Card className={ui.map.workspace}>
				{mostrarPanel && (
					<aside className={ui.map.panel}>
						<div className={ui.map.panelHeader}>
							<div className="mb-3 flex items-center justify-between">
								<h2 className="flex items-center gap-2 font-medium text-[var(--app-text)]">
									<Layers size={17} />
									Filtros del mapa
								</h2>

								<Button
									onClick={limpiarFiltros}
									variant="ghost"
									size="xs"
									leftIcon={<X size={14} />}
								>
									Limpiar
								</Button>
							</div>

							<div className="space-y-3">
								<Input
									leftIcon={<Search size={16} />}
									value={filtros.busqueda}
									onChange={(e) => setFiltros((prev) => ({ ...prev, busqueda: e.target.value }))}
									onKeyDown={(e) => e.key === "Enter" && cargarMapa()}
									placeholder="Buscar nombre, email, ciudad, sector..."
									variant="compact"
								/>

								<Select
									value={filtros.sector}
									onChange={(e) => setFiltros((prev) => ({ ...prev, sector: e.target.value }))}
									variant="compact"
								>
									<option value="">Todos los sectores</option>
									{sectores.map((sector) => (
										<option key={sector} value={sector}>
											{sector}
										</option>
									))}
								</Select>

								<Select
									value={filtros.valoracionMin}
									onChange={(e) =>
										setFiltros((prev) => ({
											...prev,
											valoracionMin: e.target.value === "" ? "" : Number(e.target.value),
										}))
									}
									variant="compact"
								>
									<option value="">Cualquier valoración</option>
									<option value={3}>⭐ 3.0+</option>
									<option value={4}>⭐ 4.0+</option>
									<option value={4.5}>⭐ 4.5+</option>
								</Select>

								<div className="grid grid-cols-2 gap-2">
									<PresenciaSelect
										label="Email"
										value={filtros.email}
										onChange={(value) => setFiltros((prev) => ({ ...prev, email: value }))}
									/>
									<PresenciaSelect
										label="Teléfono"
										value={filtros.telefono}
										onChange={(value) => setFiltros((prev) => ({ ...prev, telefono: value }))}
									/>
									<PresenciaSelect
										label="Web"
										value={filtros.web}
										onChange={(value) => setFiltros((prev) => ({ ...prev, web: value }))}
									/>
									<PresenciaSelect
										label="Maps"
										value={filtros.maps}
										onChange={(value) => setFiltros((prev) => ({ ...prev, maps: value }))}
									/>
								</div>

								<Button
									onClick={cargarMapa}
									disabled={cargando}
									variant="primary"
									className="w-full"
									isLoading={cargando}
									leftIcon={<Navigation size={17} />}
								>
									Aplicar al mapa
								</Button>
							</div>
						</div>

						<div className={ui.map.panelStats}>
							<MiniStat icon={<Mail size={14} />} label="Email" value={resumen.conEmail} />
							<MiniStat icon={<Phone size={14} />} label="Teléfono" value={resumen.conTelefono} />
							<MiniStat icon={<Globe2 size={14} />} label="Web" value={resumen.conWeb} />
							<MiniStat icon={<MapPin size={14} />} label="Maps" value={resumen.conMaps} />
						</div>

						<div className={ui.map.panelList}>
							{clientesConCoords.length === 0 && !cargando ? (
								<EmptyState
									icon={<MapPin size={22} />}
									title="Sin puntos"
									description="No hay clientes con coordenadas para estos filtros."
									className="border-0 bg-transparent px-3 py-8"
								/>
							) : (
								clientesConCoords.slice(0, 120).map((cliente) => {
									const fechaCaptacion = formatFecha(cliente.fecha_captacion);

									return (
										<button
											key={cliente.id}
											onClick={() => setSelectedClienteId(cliente.id)}
											className={cx(
												ui.map.listItem,
												selectedClienteId === cliente.id && ui.map.listItemActive,
											)}
										>
											<div className="line-clamp-1 text-sm font-medium text-[var(--app-text)]">
												{cliente.nombre || "Sin nombre"}
											</div>
											<div className="mt-0.5 line-clamp-1 text-xs text-[var(--app-text-muted)]">
												{cliente.ciudad || "Sin ciudad"} · {cliente.sector || cliente.categoria_google || "Sin sector"}
											</div>
											<div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--app-text-subtle)]">
												{cliente.email && <Mail size={13} className="text-[var(--intent-info-solid)]" />}
												{cliente.telefono && <Phone size={13} className="text-[var(--intent-success-solid)]" />}
												{cliente.sitio_web && <Globe2 size={13} className="text-[var(--intent-accent-solid)]" />}
												{fechaCaptacion && <span>{fechaCaptacion}</span>}
											</div>
										</button>
									);
								})
							)}

							{clientesConCoords.length > 120 && (
								<div className="py-2 text-center text-xs text-[var(--app-text-muted)]">
									Mostrando 120 de {formatNumero(clientesConCoords.length)} en la lista lateral. Todos están en el mapa.
								</div>
							)}
						</div>
					</aside>
				)}

				<div className="relative min-h-[420px] min-w-0 flex-1 lg:min-h-0">
					{error && (
						<div className={cx(ui.map.notice, ui.map.noticeError)}>
							{error}
						</div>
					)}

					{cargando && (
						<div className={cx(ui.map.notice, ui.map.noticeLoading, "flex items-center gap-2")}>
							<Loader2 size={16} className="animate-spin text-[var(--app-primary)]" />
							Cargando puntos...
						</div>
					)}

					<div className={ui.map.layerControl} aria-label="Selector de capa del mapa">
						{MAPA_LAYERS.map((layer) => {
							const activo = mapaLayerId === layer.id;

							return (
								<button
									type="button"
									key={layer.id}
									onClick={() => setMapaLayerId(layer.id)}
									className={cx(
										ui.map.layerButton,
										activo ? ui.map.layerButtonActive : ui.map.layerButtonInactive,
									)}
									aria-pressed={activo}
								>
									{layer.label}
								</button>
							);
						})}
					</div>

					<MapContainer
						center={DEFAULT_CENTER}
						zoom={DEFAULT_ZOOM}
						scrollWheelZoom
						className="h-full w-full"
					>
						<TileLayer
							key={mapaLayer.id}
							attribution={mapaLayer.attribution}
							url={mapaLayer.url}
						/>

						<AjustarVistaMapa clientes={clientesConCoords} version={fitVersion} />
						<VolarACliente cliente={clienteSeleccionado} />
						<ClientesClusterLayer clientes={clientesConCoords} />
					</MapContainer>
				</div>
			</Card>
		</PageShell>
	);
}

function StatPill({ label, value }: { label: string; value: number }) {
	return (
		<Card className="rounded-sm px-3 py-2">
			<div className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-subtle)]">
				{label}
			</div>
			<div className="text-sm font-semibold text-[var(--app-text)]">{formatNumero(value)}</div>
		</Card>
	);
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
	return (
		<Card className="rounded-sm px-2.5 py-2">
			<div className="flex items-center gap-1.5 font-semibold text-[var(--app-text-muted)]">
				{icon}
				{label}
			</div>
			<div className="mt-0.5 font-semibold text-[var(--app-text)]">{formatNumero(value)}</div>
		</Card>
	);
}

function PresenciaSelect({
	label,
	value,
	onChange,
}: {
	label: string;
	value: FiltroPresencia;
	onChange: (value: FiltroPresencia) => void;
}) {
	return (
		<label className="block">
			<span className={ui.text.label}>{label}</span>
			<Select
				value={value}
				onChange={(e) => onChange(e.target.value as FiltroPresencia)}
				variant="compact"
			>
				<option value="todos">Todos</option>
				<option value="con">Con</option>
				<option value="sin">Sin</option>
			</Select>
		</label>
	);
}
