export interface Cliente {
	id: number;
	nombre: string | null;
	email: string | null;
	telefono: string | null;
	sitio_web: string | null;
	direccion: string | null;
	ciudad: string | null;
	latitud: number | null;
	longitud: number | null;
	url_maps: string | null;
	valoracion: number | null;
	num_resenas: number | null;
	categoria_google: string | null;
	sector: string | null;
	fecha_captacion?: string | null;
}

export interface ClienteMapa {
	id: number;
	nombre: string | null;
	email: string | null;
	telefono?: string | null;
	sitio_web?: string | null;
	direccion?: string | null;
	ciudad: string | null;
	latitud: number | null;
	longitud: number | null;
	url_maps?: string | null;
	valoracion?: number | null;
	num_resenas?: number | null;
	categoria_google?: string | null;
	sector: string | null;
	fecha_captacion?: string | null;
}

export type SortField = "nombre" | "valoracion" | "ciudad" | "fecha_captacion" | null;
export type ServerSortField = "fecha_captacion" | "nombre" | "valoracion" | "ciudad";
export type SortDirection = "asc" | "desc";
export type PoligonoCoords = [number, number][];
export type FiltroPresencia = "todos" | "con" | "sin";
export type FiltroPresenciaActivo = Exclude<FiltroPresencia, "todos">;
export type ClienteFormMode = "crear" | "editar";

export interface ProgresoLote {
	actual: number;
	total: number;
}

export interface ClienteFilters {
	busqueda?: string;
	sector?: string;
	ciudad?: string;
	valoracion_min?: number;
	sort_by?: ServerSortField;
	sort_dir?: SortDirection;
	email_estado?: FiltroPresenciaActivo;
	telefono_estado?: FiltroPresenciaActivo;
	sitio_web_estado?: FiltroPresenciaActivo;
	direccion_estado?: FiltroPresenciaActivo;
	ciudad_estado?: FiltroPresenciaActivo;
	valoracion_estado?: FiltroPresenciaActivo;
	resenas_estado?: FiltroPresenciaActivo;
	url_maps_estado?: FiltroPresenciaActivo;
	poligono?: string;
}

export interface ClienteImportPayload {
	nombre: string;
	sector: string;
	latitud: number | null;
	longitud: number | null;
	email: string;
}

export interface ClienteUpsertPayload {
	nombre?: string | null;
	email?: string | null;
	telefono?: string | null;
	sitio_web?: string | null;
	direccion?: string | null;
	ciudad?: string | null;
	latitud?: number | null;
	longitud?: number | null;
	url_maps?: string | null;
	valoracion?: number | null;
	num_resenas?: number | null;
	categoria_google?: string | null;
	sector?: string | null;
}

export interface ClienteFormSubmitOptions {
	enriquecerAutomaticamente: boolean;
}

export interface ClienteFilterState {
	filtroBusqueda: string;
	filtroSector: string;
	filtroCiudad: string;
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
	poligonoFiltro: PoligonoCoords;
}
