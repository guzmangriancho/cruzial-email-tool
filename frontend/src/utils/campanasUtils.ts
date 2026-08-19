import type { CampanaDetalle, VariableToken } from "../types/campanas";

export const HTML_INICIAL = `
	<p>
		Hola
		<span
			data-token="{{nombre}}"
			contenteditable="false"
			class="inline-flex items-center rounded-sm bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium"
		>{{nombre}}</span>,
	</p>
	<p>Escriba aquí su mensaje...</p>
`;

export const VARIABLES: VariableToken[] = [
	{
		label: "Nombre empresa",
		token: "{{nombre}}",
		ayuda: "Nombre del cliente o empresa",
	},
	{
		label: "Ciudad",
		token: "{{ciudad}}",
		ayuda: "Ciudad/localidad del cliente",
	},
	{
		label: "Sector",
		token: "{{sector}}",
		ayuda: "Sector o categoría del cliente",
	},
	{
		label: "Email",
		token: "{{email}}",
		ayuda: "Correo del cliente",
	},
	{
		label: "Teléfono",
		token: "{{telefono}}",
		ayuda: "Teléfono si está guardado",
	},
	{
		label: "Web",
		token: "{{sitio_web}}",
		ayuda: "Sitio web si está guardado",
	},
	{
		label: "Dirección",
		token: "{{direccion}}",
		ayuda: "Dirección si está guardada",
	},
];

export const ESTADOS_BADGE: Record<string, string> = {
	Borrador: "bg-gray-100 text-[var(--app-text-muted)] border-[var(--app-border)]",
	Preparada: "bg-blue-50 text-blue-700 border-blue-200",
	"En Progreso": "bg-amber-50 text-amber-700 border-amber-200",
	Pausada: "bg-[var(--app-primary-soft)] text-[var(--app-primary-text)] border-[var(--app-primary-border)]",
	Completada: "bg-green-50 text-green-700 border-green-200",
	Error: "bg-red-50 text-red-700 border-red-200",
};

export function formatoFecha(fecha: string | null) {
	if (!fecha) return "—";

	try {
		return new Date(fecha).toLocaleString("es-ES", {
			day: "2-digit",
			month: "2-digit",
			year: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return fecha;
	}
}

export function calcularSeparadorCsv(lineaCabecera: string) {
	const puntoYComa = (lineaCabecera.match(/;/g) || []).length;
	const coma = (lineaCabecera.match(/,/g) || []).length;

	return puntoYComa >= coma ? ";" : ",";
}

export function csvPreview(file: File): Promise<{
	filas: number;
	cabeceras: string[];
}> {
	return new Promise((resolve) => {
		const reader = new FileReader();

		reader.onload = (event) => {
			const texto = String(event.target?.result || "");
			const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim());

			if (lineas.length === 0) {
				resolve({ filas: 0, cabeceras: [] });
				return;
			}

			const separador = calcularSeparadorCsv(lineas[0]);

			resolve({
				filas: Math.max(0, lineas.length - 1),
				cabeceras: lineas[0].split(separador).map((h) => h.trim()),
			});
		};

		reader.onerror = () => {
			resolve({ filas: 0, cabeceras: [] });
		};

		reader.readAsText(file, "UTF-8");
	});
}

export function sanitizarHtmlBasico(html: string) {
	if (!html) return "";

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	doc
		.querySelectorAll("script, style, iframe, object, embed")
		.forEach((el) => el.remove());

	doc.body.querySelectorAll("*").forEach((el) => {
		Array.from(el.attributes).forEach((attr) => {
			const nombre = attr.name.toLowerCase();
			const valor = attr.value || "";

			if (nombre.startsWith("on")) {
				el.removeAttribute(attr.name);
			}

			if (
				nombre === "href" &&
				!/^(https?:|mailto:|tel:|#)/i.test(valor.trim())
			) {
				el.removeAttribute(attr.name);
			}
		});
	});

	return doc.body.innerHTML;
}

export function extraerAsuntoDetalle(detalle: CampanaDetalle) {
	return detalle.asunto || detalle.plantilla?.asunto || "";
}

export function extraerCuerpoDetalle(detalle: CampanaDetalle) {
	return detalle.cuerpo_html || detalle.plantilla?.cuerpo_html || "";
}
