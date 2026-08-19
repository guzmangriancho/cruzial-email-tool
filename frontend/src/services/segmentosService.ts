import { api } from "./api";
import type {
	Segmento,
	SegmentoClientesResponse,
	SegmentoCreatePayload,
	SegmentoUpdatePayload,
} from "../types/segmentos";

export async function obtenerSegmentos(): Promise<Segmento[]> {
	const respuesta = await api.get<Segmento[]>("/segmentos/");
	return respuesta.data;
}

export async function obtenerSegmento(id: number): Promise<Segmento> {
	const respuesta = await api.get<Segmento>(`/segmentos/${id}`);
	return respuesta.data;
}

export async function crearSegmento(payload: SegmentoCreatePayload): Promise<Segmento> {
	const respuesta = await api.post<Segmento>("/segmentos/", payload);
	return respuesta.data;
}

export async function actualizarSegmento(
	id: number,
	payload: SegmentoUpdatePayload,
): Promise<Segmento> {
	const respuesta = await api.put<Segmento>(`/segmentos/${id}`, payload);
	return respuesta.data;
}

export async function eliminarSegmento(id: number): Promise<string> {
	const respuesta = await api.delete<{ mensaje: string }>(`/segmentos/${id}`);
	return respuesta.data.mensaje;
}

export async function obtenerClientesSegmento(
	id: number,
	pagina: number,
	limitePorPagina: number,
): Promise<SegmentoClientesResponse> {
	const respuesta = await api.get<SegmentoClientesResponse>(`/segmentos/${id}/clientes`, {
		params: {
			skip: pagina * limitePorPagina,
			limit: limitePorPagina,
		},
	});

	return respuesta.data;
}

export async function obtenerIdsClientesSegmento(id: number): Promise<number[]> {
	const respuesta = await api.get<{ ids: number[] }>(`/segmentos/${id}/clientes-ids`);
	return respuesta.data.ids;
}

export async function materializarSegmento(id: number): Promise<Segmento> {
	const respuesta = await api.post<Segmento>(`/segmentos/${id}/materializar`);
	return respuesta.data;
}

export async function exportarSegmentoCsv(
	id: number,
): Promise<{ data: Blob; contentDisposition?: string }> {
	const respuesta = await api.get<Blob>(`/segmentos/${id}/exportar-csv`, {
		responseType: "blob",
	});

	const contentDisposition = respuesta.headers?.["content-disposition"];

	return {
		data: respuesta.data,
		contentDisposition:
			typeof contentDisposition === "string" ? contentDisposition : undefined,
	};
}
