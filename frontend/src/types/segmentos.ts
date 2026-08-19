import type { Cliente, ClienteFilters } from "./crm";

export type SegmentoTipo = "dinamico" | "estatico";

export interface Segmento {
	id: number;
	nombre: string;
	descripcion: string | null;
	tipo: SegmentoTipo;
	filtros: ClienteFilters | null;
	color: string | null;
	total_clientes: number;
	fecha_creacion: string | null;
	fecha_actualizacion: string | null;
}

export interface SegmentoCreatePayload {
	nombre: string;
	descripcion?: string | null;
	tipo: SegmentoTipo;
	filtros?: ClienteFilters | null;
	cliente_ids?: number[];
	color?: string | null;
}

export interface SegmentoUpdatePayload {
	nombre?: string;
	descripcion?: string | null;
	tipo?: SegmentoTipo;
	filtros?: ClienteFilters | null;
	cliente_ids?: number[];
	color?: string | null;
}

export interface SegmentoClientesResponse {
	segmento: Segmento;
	clientes: Cliente[];
	total: number;
	skip: number;
	limit: number;
}
