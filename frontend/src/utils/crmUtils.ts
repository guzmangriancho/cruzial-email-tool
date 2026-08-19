import type {
	Cliente,
	ClienteFilterState,
	ClienteFilters,
	ClienteImportPayload,
	FiltroPresencia,
	FiltroPresenciaActivo,
	SortField,
} from "../types/crm";

function presenciaToParam(value: FiltroPresencia): FiltroPresenciaActivo | undefined {
	return value === "todos" ? undefined : value;
}

export function buildClienteFilterParams({
	filtroBusqueda,
	filtroSector,
	filtroCiudad,
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
	poligonoFiltro,
}: ClienteFilterState): ClienteFilters {
	return {
		busqueda: filtroBusqueda.trim() || undefined,
		sector: filtroSector || undefined,
		ciudad: filtroCiudad || undefined,
		valoracion_min: filtroValoracion !== "" ? filtroValoracion : undefined,
		sort_by: ordenCampo,
		sort_dir: ordenDireccion,

		email_estado: presenciaToParam(filtroEmail),
		telefono_estado: presenciaToParam(filtroTelefono),
		sitio_web_estado: presenciaToParam(filtroSitioWeb),
		direccion_estado: presenciaToParam(filtroDireccion),
		ciudad_estado: presenciaToParam(filtroCiudadPresencia),
		valoracion_estado: presenciaToParam(filtroValoracionPresencia),
		resenas_estado: presenciaToParam(filtroResenas),
		url_maps_estado: presenciaToParam(filtroUrlMaps),

		poligono:
			poligonoFiltro.length >= 3 ? JSON.stringify(poligonoFiltro) : undefined,
	};
}

export function sortClientes(
	clientes: Cliente[],
	sortField: SortField,
	sortAsc: boolean,
): Cliente[] {
	if (!sortField) return clientes;

	return [...clientes].sort((a, b) => {
		let valA = a[sortField];
		let valB = b[sortField];

		if (valA === null || valA === undefined) {
			valA = sortField === "valoracion" ? -1 : "";
		}

		if (valB === null || valB === undefined) {
			valB = sortField === "valoracion" ? -1 : "";
		}

		if (sortField === "fecha_captacion") {
			const timeA = valA ? new Date(String(valA)).getTime() : 0;
			const timeB = valB ? new Date(String(valB)).getTime() : 0;

			if (timeA < timeB) return sortAsc ? -1 : 1;
			if (timeA > timeB) return sortAsc ? 1 : -1;
			return 0;
		}

		if (valA < valB) return sortAsc ? -1 : 1;
		if (valA > valB) return sortAsc ? 1 : -1;
		return 0;
	});
}

export function formatFechaCaptacion(fecha?: string | null): string | null {
	if (!fecha) return null;

	const date = new Date(fecha);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return new Intl.DateTimeFormat("es-ES", {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	}).format(date);
}

export function parseClientesCsv(texto: string): ClienteImportPayload[] {
	const lineas = texto.split("\n");
	const clientesAImportar: ClienteImportPayload[] = [];

	for (let i = 1; i < lineas.length; i++) {
		const linea = lineas[i].trim();
		if (!linea) continue;

		const columnas = linea.split(";");

		if (columnas.length >= 7) {
			clientesAImportar.push({
				nombre: columnas[2].trim(),
				sector: columnas[3].trim(),
				latitud: parseFloat(columnas[4].replace(",", ".")) || null,
				longitud: parseFloat(columnas[5].replace(",", ".")) || null,
				email: columnas[6].trim(),
			});
		}
	}

	return clientesAImportar;
}

export function getCsvFilename(
	contentDisposition: string | undefined,
	defaultName = "clientes_export.csv",
): string {
	if (!contentDisposition) return defaultName;

	const match = contentDisposition.match(/filename="?([^\"]+)"?/i);
	return match?.[1] || defaultName;
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();

	window.URL.revokeObjectURL(url);
}
