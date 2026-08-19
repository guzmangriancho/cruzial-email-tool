export const STORAGE_KEYS = {
	negocios: "scraper_negocios",
	ubicaciones: "scraper_ubicaciones",
	ubicacionPresets: "scraper_ubicacion_presets",
	modo: "scraper_modo",
	taskId: "scraper_task_id",
};

export const ESTADOS_FINALIZADOS = [
	"Completado",
	"Detenido",
	"Error",
	"No encontrado",
];

export type UbicacionPreset = {
	id: string;
	nombre: string;
	descripcion: string;
	items: string[];
};

export const UBICACION_PRESETS: UbicacionPreset[] = [
	{
		id: "norte",
		nombre: "Norte de España",
		descripcion: "Cornisa norte y comunidades cercanas.",
		items: [
			"Cantabria",
			"Asturias",
			"Galicia",
			"País Vasco",
			"Navarra",
			"La Rioja",
		],
	},
	{
		id: "cornisa",
		nombre: "Cornisa Cantábrica",
		descripcion: "Zonas costeras del norte para búsquedas muy locales.",
		items: ["Cantabria", "Asturias", "Bizkaia", "Gipuzkoa", "A Coruña", "Lugo"],
	},
	{
		id: "castilla-leon",
		nombre: "Castilla y León",
		descripcion: "Provincias útiles para ayuntamientos y servicios públicos.",
		items: [
			"León",
			"Palencia",
			"Burgos",
			"Valladolid",
			"Salamanca",
			"Zamora",
			"Segovia",
			"Soria",
			"Ávila",
		],
	},
	{
		id: "centro",
		nombre: "Centro",
		descripcion: "Madrid y provincias interiores próximas.",
		items: [
			"Madrid",
			"Toledo",
			"Guadalajara",
			"Cuenca",
			"Ciudad Real",
			"Ávila",
			"Segovia",
		],
	},
	{
		id: "nordeste",
		nombre: "Nordeste",
		descripcion: "Cataluña, Aragón, Navarra y La Rioja.",
		items: [
			"Barcelona",
			"Girona",
			"Lleida",
			"Tarragona",
			"Zaragoza",
			"Huesca",
			"Teruel",
			"Navarra",
			"La Rioja",
		],
	},
	{
		id: "levante",
		nombre: "Levante",
		descripcion: "Mediterráneo oriental e islas Baleares.",
		items: ["Castellón", "Valencia", "Alicante", "Murcia", "Illes Balears"],
	},
	{
		id: "sur",
		nombre: "Sur",
		descripcion: "Andalucía y Extremadura.",
		items: [
			"Sevilla",
			"Córdoba",
			"Málaga",
			"Granada",
			"Jaén",
			"Almería",
			"Cádiz",
			"Huelva",
			"Badajoz",
			"Cáceres",
		],
	},
	{
		id: "islas",
		nombre: "Islas",
		descripcion: "Baleares y Canarias.",
		items: ["Illes Balears", "Las Palmas", "Santa Cruz de Tenerife"],
	},
];

export const PROVINCIAS_FRECUENTES = Array.from(
	new Set(UBICACION_PRESETS.flatMap((preset) => preset.items)),
).sort((a, b) => a.localeCompare(b, "es"));

export function presetPorId(id: string) {
	return UBICACION_PRESETS.find((preset) => preset.id === id);
}

export function presetActivoPorItems(
	preset: UbicacionPreset,
	presetIdsSeleccionados: string[],
	ubicacionesSeleccionadas: string[],
) {
	return (
		presetIdsSeleccionados.includes(preset.id) ||
		contieneTodas(ubicacionesSeleccionadas, preset.items)
	);
}

export function normalizarComparacion(texto: string) {
	return texto
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

export function contieneTodas(lista: string[], items: string[]) {
	const normalizadas = new Set(lista.map(normalizarComparacion));
	return items.every((item) => normalizadas.has(normalizarComparacion(item)));
}

export function unirUbicacionesSinDuplicados(...grupos: string[][]) {
	const vistas = new Set<string>();
	const resultado: string[] = [];

	grupos.flat().forEach((ubicacion) => {
		const formateada = capitalizarTexto(ubicacion);
		if (!formateada) return;

		const clave = normalizarComparacion(formateada);
		if (vistas.has(clave)) return;

		vistas.add(clave);
		resultado.push(formateada);
	});

	return resultado;
}

export function leerListaStorage(key: string): string[] {
	if (typeof window === "undefined") return [];

	try {
		const raw = localStorage.getItem(key);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
	} catch {
		return [];
	}
}

export function leerBooleanStorage(key: string, fallback = false): boolean {
	if (typeof window === "undefined") return fallback;

	try {
		const raw = localStorage.getItem(key);
		return raw ? Boolean(JSON.parse(raw)) : fallback;
	} catch {
		return fallback;
	}
}

export function leerStringStorage(key: string): string | null {
	if (typeof window === "undefined") return null;

	return localStorage.getItem(key);
}

export function capitalizarTexto(texto: string) {
	const limpio = texto.trim().replace(/\s+/g, " ");

	if (!limpio) return "";

	return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

