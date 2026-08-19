import { api } from "./api";
import type { Cliente, ClienteFilters, ClienteImportPayload, ClienteMapa, ClienteUpsertPayload } from "../types/crm";

export async function obtenerClientes(
	pagina: number,
	limitePorPagina: number,
	filtros: ClienteFilters,
): Promise<Cliente[]> {
	const respuesta = await api.get<Cliente[]>("/clientes/", {
		params: {
			skip: pagina * limitePorPagina,
			limit: limitePorPagina,
			...filtros,
		},
	});

	return respuesta.data;
}


export async function obtenerClientesMapa(filtros: ClienteFilters): Promise<ClienteMapa[]> {
	const respuesta = await api.get<ClienteMapa[]>("/clientes/mapa", {
		params: filtros,
	});

	return respuesta.data;
}

export async function obtenerSectores(): Promise<string[]> {
	const respuesta = await api.get<string[]>("/clientes/sectores");
	return respuesta.data;
}

export async function exportarClientesCsv(
	filtros: ClienteFilters,
): Promise<{ data: Blob; contentDisposition?: string }> {
	const respuesta = await api.get<Blob>("/clientes/exportar-csv", {
		params: filtros,
		responseType: "blob",
	});

	const contentDisposition = respuesta.headers?.["content-disposition"];

	return {
		data: respuesta.data,
		contentDisposition:
			typeof contentDisposition === "string" ? contentDisposition : undefined,
	};
}

export async function limpiarClientesBd(): Promise<string> {
	const respuesta = await api.post<{ mensaje: string }>("/clientes/limpiar-bd");
	return respuesta.data.mensaje;
}


export async function crearCliente(payload: ClienteUpsertPayload): Promise<Cliente> {
	const respuesta = await api.post<Cliente>("/clientes/", payload);
	return respuesta.data;
}

export async function actualizarCliente(
	id: number,
	payload: ClienteUpsertPayload,
): Promise<Cliente> {
	const respuesta = await api.put<Cliente>(`/clientes/${id}`, payload);
	return respuesta.data;
}

export async function eliminarClientePorId(id: number): Promise<void> {
	await api.delete(`/clientes/${id}`);
}

export async function eliminarClientesMasivo(ids: number[]): Promise<string> {
	const respuesta = await api.post<{ mensaje: string }>(
		"/clientes/eliminar-masivo",
		{ ids },
	);

	return respuesta.data.mensaje;
}

export async function importarClientesMasivo(
	clientes: ClienteImportPayload[],
): Promise<string> {
	const respuesta = await api.post<{ mensaje: string }>(
		"/clientes/importacion_masiva",
		clientes,
	);

	return respuesta.data.mensaje;
}

export async function enriquecerCliente(id: number): Promise<Cliente> {
	const respuesta = await api.post<Cliente>(`/scraper/enriquecer/${id}`);
	return respuesta.data;
}

export async function obtenerIdsPendientes(): Promise<number[]> {
	const respuesta = await api.get<number[]>("/clientes/pendientes-ids");
	return respuesta.data;
}
