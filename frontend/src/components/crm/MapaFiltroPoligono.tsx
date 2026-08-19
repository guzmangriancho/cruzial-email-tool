import { useEffect, useMemo, useState } from "react";
import {
	MapContainer,
	TileLayer,
	CircleMarker,
	Marker,
	Popup,
	useMap,
	useMapEvents,
	Polyline,
	Polygon,
} from "react-leaflet";
import { divIcon } from "leaflet";
import type { LatLngBounds, LatLngExpression } from "leaflet";
import type { Map as LeafletMap } from "leaflet";
import { Check, Loader2, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";

import { Badge, Button, Card } from "../ui";
import type { ClienteMapa } from "../../types/crm";

import "leaflet/dist/leaflet.css";

interface Props {
	clientes: ClienteMapa[];
	cargando?: boolean;
	poligono: [number, number][];
	onPoligonoChange: (coords: [number, number][]) => void;
	onLimpiarPoligono: () => void;
}

interface ControlDibujoManualProps {
	activo: boolean;
	onAddPoint: (punto: [number, number]) => void;
}

type ClienteMapaConCoords = ClienteMapa & {
	latitud: number;
	longitud: number;
};

interface ClienteCluster {
	id: string;
	lat: number;
	lng: number;
	clientes: ClienteMapaConCoords[];
}

const ZOOM_MAX_CLUSTER = 13;

function bloquearMovimientoMapa(map: LeafletMap) {
	map.dragging.disable();
	map.touchZoom.disable();
	map.doubleClickZoom.disable();
	map.scrollWheelZoom.disable();
	map.boxZoom.disable();
	map.keyboard.disable();

	if ((map as any).tap) {
		(map as any).tap.disable();
	}

	map.getContainer().style.cursor = "crosshair";
}

function desbloquearMovimientoMapa(map: LeafletMap) {
	map.dragging.enable();
	map.touchZoom.enable();
	map.doubleClickZoom.enable();
	map.scrollWheelZoom.enable();
	map.boxZoom.enable();
	map.keyboard.enable();

	if ((map as any).tap) {
		(map as any).tap.enable();
	}

	map.getContainer().style.cursor = "";
}

function BloqueadorMovimientoMapa({ activo }: { activo: boolean }) {
	const map = useMap();

	useEffect(() => {
		if (!activo) {
			desbloquearMovimientoMapa(map);
			return;
		}

		bloquearMovimientoMapa(map);

		return () => {
			desbloquearMovimientoMapa(map);
		};
	}, [activo, map]);

	return null;
}

function ControlDibujoManual({ activo, onAddPoint }: ControlDibujoManualProps) {
	useMapEvents({
		click(e) {
			if (!activo) return;

			onAddPoint([e.latlng.lat, e.latlng.lng]);
		},
	});

	return null;
}

function AjustarVistaMapa({
	puntos,
	desactivado,
}: {
	puntos: ClienteMapaConCoords[];
	desactivado: boolean;
}) {
	const map = useMap();
	const puntosKey = useMemo(
		() => puntos.map((punto) => `${punto.id}:${punto.latitud}:${punto.longitud}`).join("|"),
		[puntos],
	);

	useEffect(() => {
		if (desactivado || puntos.length === 0) return;

		if (puntos.length === 1) {
			map.setView([puntos[0].latitud, puntos[0].longitud], 14);
			return;
		}

		const bounds = puntos.map((punto) => [punto.latitud, punto.longitud]) as [number, number][];
		map.fitBounds(bounds, {
			padding: [32, 32],
			maxZoom: 13,
		});
	}, [desactivado, map, puntos, puntosKey]);

	return null;
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
	const size = total < 10 ? 34 : total < 100 ? 42 : 50;

	return divIcon({
		className: "",
		html: `
			<div style="
				width:${size}px;
				height:${size}px;
				border-radius:9999px;
				background:#2563eb;
				border:3px solid white;
				box-shadow:0 8px 18px rgba(15,23,42,.25);
				color:white;
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

function popupCliente(cliente: ClienteMapaConCoords) {
	return (
		<div className="text-sm">
			<div className="font-medium">{cliente.nombre || "Sin nombre"}</div>
			<div>{cliente.email || "Sin email"}</div>
			<div className="text-[var(--app-text-muted)]">{cliente.ciudad || "Sin ciudad"}</div>
			<div className="text-[var(--app-text-muted)]">{cliente.sector || "Sin sector"}</div>
		</div>
	);
}

function PopupCluster({ clientes }: { clientes: ClienteMapaConCoords[] }) {
	const primerosClientes = clientes.slice(0, 8);
	const restantes = clientes.length - primerosClientes.length;

	return (
		<div className="text-sm min-w-[220px]">
			<div className="font-medium text-[var(--app-text)] mb-2">
				{clientes.length} clientes en esta zona
			</div>

			<div className="space-y-1 max-h-56 overflow-y-auto pr-1">
				{primerosClientes.map((cliente) => (
					<div key={cliente.id} className="border-b border-gray-100 pb-1 last:border-b-0">
						<div className="font-semibold text-[var(--app-text)]">
							{cliente.nombre || "Sin nombre"}
						</div>
						<div className="text-xs text-[var(--app-text-muted)]">
							{cliente.ciudad || "Sin ciudad"} · {cliente.sector || "Sin sector"}
						</div>
					</div>
				))}
			</div>

			{restantes > 0 && (
				<div className="text-xs font-semibold text-[var(--app-text-muted)] mt-2">
					+{restantes} clientes más. Acerca el zoom para separarlos.
				</div>
			)}
		</div>
	);
}

function ClienteMarker({ cliente, dibujando }: { cliente: ClienteMapaConCoords; dibujando: boolean }) {
	return (
		<CircleMarker
			center={[cliente.latitud, cliente.longitud]}
			radius={6}
			weight={2}
			fillOpacity={0.75}
			interactive={!dibujando}
		>
			<Popup>{popupCliente(cliente)}</Popup>
		</CircleMarker>
	);
}

function ClientesClusterLayer({
	clientes,
	dibujando,
}: {
	clientes: ClienteMapaConCoords[];
	dibujando: boolean;
}) {
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
					return (
						<ClienteMarker
							key={cluster.id}
							cliente={cluster.clientes[0]}
							dibujando={dibujando}
						/>
					);
				}

				return (
					<Marker
						key={cluster.id}
						position={[cluster.lat, cluster.lng]}
						icon={crearIconoCluster(cluster.clientes.length)}
						interactive={!dibujando}
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

export default function MapaFiltroPoligono({
	clientes,
	cargando = false,
	poligono,
	onPoligonoChange,
	onLimpiarPoligono,
}: Props) {
	const [dibujando, setDibujando] = useState(false);
	const [puntosDibujo, setPuntosDibujo] = useState<[number, number][]>([]);

	const clientesConCoords = useMemo(
		() =>
			clientes.filter(
				(cliente): cliente is ClienteMapaConCoords =>
					cliente.latitud !== null && cliente.longitud !== null,
			),
		[clientes],
	);

	const centro: [number, number] =
		clientesConCoords.length > 0
			? [clientesConCoords[0].latitud, clientesConCoords[0].longitud]
			: [43.4623, -3.8099]; // Santander por defecto

	const empezarDibujo = () => {
		setPuntosDibujo([]);
		setDibujando(true);
	};

	const cancelarDibujo = () => {
		setPuntosDibujo([]);
		setDibujando(false);
	};

	const addPoint = (punto: [number, number]) => {
		setPuntosDibujo((prev) => [...prev, punto]);
	};

	const deshacerUltimoPunto = () => {
		setPuntosDibujo((prev) => prev.slice(0, -1));
	};

	const terminarZona = () => {
		if (puntosDibujo.length < 3) return;

		onPoligonoChange(puntosDibujo);
		setDibujando(false);
		setPuntosDibujo([]);
	};

	const limpiarZona = () => {
		setDibujando(false);
		setPuntosDibujo([]);
		onLimpiarPoligono();
	};

	const polygonActivo: LatLngExpression[] = poligono.map(([lat, lng]) => [
		lat,
		lng,
	]);

	const lineaDibujo: LatLngExpression[] = puntosDibujo.map(([lat, lng]) => [
		lat,
		lng,
	]);

	return (
		<Card className="mb-6 overflow-hidden rounded-sm">
			<div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 gap-4">
				<div>
					<h2 className="font-medium text-[var(--app-text)]">Filtro por zona</h2>
					<p className="text-xs text-[var(--app-text-muted)]">
						El mapa carga todos los clientes con coordenadas que coinciden con los filtros actuales.
					</p>
					<p className="text-xs text-[var(--app-text-muted)]">
						Pulsa <strong>Dibujar zona</strong>, marca tantos puntos como necesites y termina con{" "}
						<strong>Terminar zona</strong>.
					</p>
				</div>

				<div className="flex items-center gap-2 flex-wrap justify-end">
					<Badge variant="neutral">
						{clientesConCoords.length.toLocaleString("es-ES")} punto
						{clientesConCoords.length === 1 ? "" : "s"}
					</Badge>

					{poligono.length >= 3 && !dibujando && (
						<Badge variant="green">Zona activa</Badge>
					)}

					{dibujando && (
						<Badge variant="blue">
							{puntosDibujo.length} punto
							{puntosDibujo.length === 1 ? "" : "s"}
						</Badge>
					)}

					{dibujando ? (
						<>
							<Button
								onClick={deshacerUltimoPunto}
								disabled={puntosDibujo.length === 0}
								variant="secondary"
								size="xs"
								leftIcon={<RotateCcw size={16} />}
							>
								Deshacer punto
							</Button>

							<Button
								onClick={terminarZona}
								disabled={puntosDibujo.length < 3}
								variant="success"
								size="xs"
								leftIcon={<Check size={16} />}
							>
								Terminar zona
							</Button>

							<Button
								onClick={cancelarDibujo}
								variant="danger"
								size="xs"
								leftIcon={<XCircle size={16} />}
							>
								Cancelar
							</Button>
						</>
					) : (
						<Button
							onClick={empezarDibujo}
							variant="success"
							size="xs"
							leftIcon={<Pencil size={16} />}
						>
							Dibujar zona
						</Button>
					)}

					<Button
						onClick={limpiarZona}
						disabled={poligono.length === 0 && puntosDibujo.length === 0}
						variant="secondary"
						size="xs"
						leftIcon={<Trash2 size={16} />}
					>
						Limpiar zona
					</Button>
				</div>
			</div>

			<div className="relative h-[420px]">
				{cargando && (
					<div className="absolute left-4 top-4 z-[1000] bg-[var(--app-surface-raised)] border border-[var(--app-border)] text-[var(--app-text-muted)] shadow-sm rounded-sm px-3 py-2 text-sm font-semibold flex items-center gap-2">
						<Loader2 size={16} className="animate-spin text-blue-500" />
						Cargando todos los puntos del mapa...
					</div>
				)}

				{dibujando && (
					<div className="absolute left-4 top-4 z-[1000] bg-[var(--app-surface-raised)] border border-green-200 text-green-800 shadow-sm rounded-sm px-3 py-2 text-sm font-semibold max-w-[420px]">
						Haz clic en el mapa para añadir puntos. Puedes usar todos los puntos que quieras. Cuando acabes, pulsa{" "}
						<span className="font-medium">Terminar zona</span>.
					</div>
				)}

				<MapContainer
					center={centro}
					zoom={11}
					scrollWheelZoom={!dibujando}
					doubleClickZoom={!dibujando}
					className="h-full w-full"
				>
					<TileLayer
						attribution="&copy; OpenStreetMap contributors"
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>

					<AjustarVistaMapa puntos={clientesConCoords} desactivado={dibujando || cargando} />

					<BloqueadorMovimientoMapa activo={dibujando} />

					<ControlDibujoManual activo={dibujando} onAddPoint={addPoint} />

					{!dibujando && polygonActivo.length >= 3 && (
						<Polygon
							positions={polygonActivo}
							pathOptions={{
								weight: 2,
								fillOpacity: 0.15,
							}}
						/>
					)}

					{dibujando && lineaDibujo.length >= 2 && (
						<Polyline
							positions={lineaDibujo}
							pathOptions={{
								weight: 3,
							}}
						/>
					)}

					{dibujando && lineaDibujo.length >= 3 && (
						<Polygon
							positions={lineaDibujo}
							pathOptions={{
								weight: 2,
								fillOpacity: 0.08,
							}}
						/>
					)}

					{dibujando &&
						puntosDibujo.map(([lat, lng], index) => (
							<CircleMarker
								key={`${lat}-${lng}-${index}`}
								center={[lat, lng]}
								radius={5}
								weight={2}
								fillOpacity={1}
								interactive={false}
							>
								<Popup>
									<div className="text-sm font-semibold">Punto {index + 1}</div>
								</Popup>
							</CircleMarker>
						))}

					<ClientesClusterLayer clientes={clientesConCoords} dibujando={dibujando} />
				</MapContainer>
			</div>
		</Card>
	);
}
