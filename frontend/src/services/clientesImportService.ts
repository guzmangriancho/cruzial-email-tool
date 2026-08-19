import { api } from "./api";

export type ImportacionClientesResultado = {
	mensaje: string;
	procesados: number;
	creados: number;
	actualizados: number;
	omitidos: number;
	avisos?: string[];
	errores?: string[];
};

export async function importarClientesCsvArchivo(file: File) {
	const formData = new FormData();
	formData.append("file", file);

	const response = await api.post<ImportacionClientesResultado>(
		"/clientes/importacion_csv_archivo",
		formData,
	);

	return response.data;
}
