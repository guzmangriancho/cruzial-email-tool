import type { Dispatch, SetStateAction } from "react";
import { ArrowUpDown, FolderPlus, Search, X } from "lucide-react";
import { Button, Card, Field, Input, Select } from "../ui";
import FiltroPresenciaSelect from "./FiltroPresenciaSelect";
import type { FiltroPresencia, ServerSortField, SortDirection } from "../../types/crm";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface CRMFiltersProps {
	sectoresDisponibles: string[];
	filtroBusqueda: string;
	filtroSector: string;
	filtroValoracion: number | "";
	ordenCampo: ServerSortField;
	ordenDireccion: SortDirection;
	filtroEmail: FiltroPresencia;
	filtroTelefono: FiltroPresencia;
	filtroSitioWeb: FiltroPresencia;
	filtroDireccion: FiltroPresencia;
	filtroCiudadPresencia: FiltroPresencia;
	filtroValoracionPresencia: FiltroPresencia;
	filtroResenas: FiltroPresencia;
	filtroUrlMaps: FiltroPresencia;
	setFiltroBusqueda: Setter<string>;
	setFiltroSector: Setter<string>;
	setFiltroValoracion: Setter<number | "">;
	setOrdenCampo: Setter<ServerSortField>;
	setOrdenDireccion: Setter<SortDirection>;
	setFiltroEmail: Setter<FiltroPresencia>;
	setFiltroTelefono: Setter<FiltroPresencia>;
	setFiltroSitioWeb: Setter<FiltroPresencia>;
	setFiltroDireccion: Setter<FiltroPresencia>;
	setFiltroCiudadPresencia: Setter<FiltroPresencia>;
	setFiltroValoracionPresencia: Setter<FiltroPresencia>;
	setFiltroResenas: Setter<FiltroPresencia>;
	setFiltroUrlMaps: Setter<FiltroPresencia>;
	onResetPagina: () => void;
	onAplicarFiltroTexto: () => void;
	onLimpiarFiltros: () => void;
	onGuardarSegmento?: () => void;
}

export default function CRMFilters({
	sectoresDisponibles,
	filtroBusqueda,
	filtroSector,
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
	setFiltroBusqueda,
	setFiltroSector,
	setFiltroValoracion,
	setOrdenCampo,
	setOrdenDireccion,
	setFiltroEmail,
	setFiltroTelefono,
	setFiltroSitioWeb,
	setFiltroDireccion,
	setFiltroCiudadPresencia,
	setFiltroValoracionPresencia,
	setFiltroResenas,
	setFiltroUrlMaps,
	onResetPagina,
	onAplicarFiltroTexto,
	onLimpiarFiltros,
	onGuardarSegmento,
}: CRMFiltersProps) {
	const updatePresencia =
		(setter: Setter<FiltroPresencia>, options?: { limpiaValoracionMinima?: boolean }) =>
		(value: FiltroPresencia) => {
			setter(value);

			if (options?.limpiaValoracionMinima && value === "sin") {
				setFiltroValoracion("");
			}

			onResetPagina();
		};

	const handleBusquedaChange = (value: string) => {
		setFiltroBusqueda(value);
		onResetPagina();
	};

	return (
		<Card className="mb-6 p-5 animate-in fade-in slide-in-from-top-2">
			<div className="flex flex-wrap items-end gap-4">
				<Field label="Buscar en todo" className="min-w-[280px] flex-[2]">
					<Input
						variant="compact"
						type="text"
						placeholder="Nombre, email, teléfono, ciudad, dirección, sector, web..."
						value={filtroBusqueda}
						onChange={(e) => handleBusquedaChange(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && onAplicarFiltroTexto()}
						leftIcon={<Search size={16} />}
					/>
				</Field>

				<Field label="Sector" className="w-48">
					<Select
						variant="compact"
						value={filtroSector}
						onChange={(e) => {
							setFiltroSector(e.target.value);
							onResetPagina();
						}}
					>
						<option value="">Todos los sectores</option>
						{sectoresDisponibles.map((sector) => (
							<option key={sector} value={sector}>
								{sector}
							</option>
						))}
					</Select>
				</Field>

				<Field label="Nota Mínima" className="w-40">
					<Select
						variant="compact"
						value={filtroValoracion}
						disabled={filtroValoracionPresencia === "sin"}
						onChange={(e) => {
							const value = e.target.value === "" ? "" : Number(e.target.value);
							setFiltroValoracion(value);

							if (value !== "") {
								setFiltroValoracionPresencia("con");
							}

							onResetPagina();
						}}
					>
						<option value="">Cualquiera</option>
						<option value={3}>⭐ 3.0+</option>
						<option value={4}>⭐ 4.0+</option>
						<option value={4.5}>⭐ 4.5+</option>
					</Select>
				</Field>

				<Field label="Ordenar" className="w-48">
					<Select
						variant="compact"
						value={`${ordenCampo}:${ordenDireccion}`}
						leftIcon={<ArrowUpDown size={15} />}
						onChange={(e) => {
							const [campo, direccion] = e.target.value.split(":") as [
								ServerSortField,
								SortDirection,
							];

							setOrdenCampo(campo);
							setOrdenDireccion(direccion);
							onResetPagina();
						}}
					>
						<option value="fecha_captacion:desc">Más recientes</option>
						<option value="fecha_captacion:asc">Más antiguos</option>
						<option value="nombre:asc">Nombre A-Z</option>
						<option value="nombre:desc">Nombre Z-A</option>
						<option value="valoracion:desc">Mejor valoración</option>
						<option value="ciudad:asc">Ciudad A-Z</option>
					</Select>
				</Field>

				<div className="ml-auto flex flex-wrap gap-2">
					<Button variant="ghost" onClick={onLimpiarFiltros} leftIcon={<X size={16} />}>
						Limpiar
					</Button>

					{onGuardarSegmento && (
						<Button variant="outline" onClick={onGuardarSegmento} leftIcon={<FolderPlus size={16} />}>
							Guardar segmento
						</Button>
					)}

					<Button variant="primary" onClick={onAplicarFiltroTexto}>
						Buscar
					</Button>
				</div>
			</div>

			<div className="mt-4 border-t border-gray-100 pt-4">
				<div className="mb-2 text-xs font-medium uppercase text-[var(--app-text-muted)]">
					Disponibilidad de datos
				</div>

				<div className="flex flex-wrap items-end gap-4">
					<FiltroPresenciaSelect
						label="Email"
						value={filtroEmail}
						onChange={updatePresencia(setFiltroEmail)}
					/>

					<FiltroPresenciaSelect
						label="Teléfono"
						value={filtroTelefono}
						onChange={updatePresencia(setFiltroTelefono)}
					/>

					<FiltroPresenciaSelect
						label="Sitio web"
						value={filtroSitioWeb}
						onChange={updatePresencia(setFiltroSitioWeb)}
					/>

					<FiltroPresenciaSelect
						label="Dirección"
						value={filtroDireccion}
						onChange={updatePresencia(setFiltroDireccion)}
					/>

					<FiltroPresenciaSelect
						label="Ciudad"
						value={filtroCiudadPresencia}
						onChange={updatePresencia(setFiltroCiudadPresencia)}
						conLabel="Con ciudad guardada"
						sinLabel="Sin ciudad guardada"
					/>

					<FiltroPresenciaSelect
						label="Valoración"
						value={filtroValoracionPresencia}
						onChange={updatePresencia(setFiltroValoracionPresencia, {
							limpiaValoracionMinima: true,
						})}
					/>

					<FiltroPresenciaSelect
						label="Reseñas"
						value={filtroResenas}
						onChange={updatePresencia(setFiltroResenas)}
					/>

					<FiltroPresenciaSelect
						label="Maps"
						value={filtroUrlMaps}
						onChange={updatePresencia(setFiltroUrlMaps)}
						conLabel="Con URL Maps"
						sinLabel="Sin URL Maps"
					/>
				</div>
			</div>
		</Card>
	);
}
