import { api } from "./api";

import type {
	AdjuntoDisponible,
	CampanaDetalle,
	CampanaResumen,
	EstadoCampana,
	LogCampana,
} from "../types/campanas";

interface DatosCampanaConAdjuntos {
	nombre: string;
	remitente: string;
	asunto: string;
	cuerpo_html: string;
	delay_segundos: number;
	adjuntos_genericos: string[];
	adjuntos_upload: File[];
}

function crearFormDataCampana(data: DatosCampanaConAdjuntos) {
	const formData = new FormData();

	formData.append("nombre", data.nombre);
	formData.append("remitente", data.remitente);
	formData.append("asunto", data.asunto);
	formData.append("cuerpo_html", data.cuerpo_html);
	formData.append("delay_segundos", String(data.delay_segundos));
	formData.append(
		"adjuntos_genericos",
		JSON.stringify(data.adjuntos_genericos),
	);

	data.adjuntos_upload.forEach((file) => {
		formData.append("adjuntos_upload", file);
	});

	return formData;
}

export const campanasService = {
	async listar() {
		const res = await api.get<CampanaResumen[]>("/campanas/");
		return res.data || [];
	},

	async obtenerEstado(campanaId: number) {
		const res = await api.get<EstadoCampana>(`/campanas/${campanaId}/estado`);
		return res.data;
	},

	async obtenerLogs(campanaId: number, limit = 80) {
		const res = await api.get<LogCampana[]>(`/campanas/${campanaId}/logs`, {
			params: { limit },
		});

		return res.data || [];
	},

	async obtenerDetalle(campanaId: number) {
		const res = await api.get<CampanaDetalle>(`/campanas/${campanaId}`);
		return res.data || {};
	},

	async listarAdjuntosDisponibles() {
		const res = await api.get<AdjuntoDisponible[]>(
			"/campanas/adjuntos-disponibles",
		);

		return res.data || [];
	},

	async enviarPrueba(data: {
		email_destino: string;
		nombre: string;
		remitente: string;
		asunto: string;
		cuerpo_html: string;
		adjuntos_genericos: string[];
		adjuntos_upload: File[];
	}) {
		const formData = new FormData();

		formData.append("email_destino", data.email_destino);
		formData.append("nombre", data.nombre);
		formData.append("remitente", data.remitente);
		formData.append("asunto", data.asunto);
		formData.append("cuerpo_html", data.cuerpo_html);
		formData.append(
			"adjuntos_genericos",
			JSON.stringify(data.adjuntos_genericos),
		);

		data.adjuntos_upload.forEach((file) => {
			formData.append("adjuntos_upload", file);
		});

		const res = await api.post("/campanas/enviar-prueba", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});

		return res.data;
	},

	async actualizar(campanaId: number, data: DatosCampanaConAdjuntos) {
		const formData = crearFormDataCampana(data);

		const res = await api.put(`/campanas/${campanaId}`, formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});

		return res.data;
	},

	async crearDesdeCsv(
		data: DatosCampanaConAdjuntos & {
			lanzar_inmediatamente: boolean;
			csv_file: File;
		},
	) {
		const formData = crearFormDataCampana(data);

		formData.append(
			"lanzar_inmediatamente",
			data.lanzar_inmediatamente ? "true" : "false",
		);
		formData.append("csv_file", data.csv_file);

		const res = await api.post("/campanas/crear-csv", formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
		});

		return res.data;
	},

	async lanzar(campanaId: number) {
		const res = await api.post(`/campanas/${campanaId}/lanzar`);
		return res.data;
	},

	async detener(campanaId: number) {
		const res = await api.post(`/campanas/${campanaId}/detener`);
		return res.data;
	},

	async reanudar(campanaId: number) {
		const res = await api.post(`/campanas/${campanaId}/reanudar`);
		return res.data;
	},

	async eliminar(campanaId: number) {
		await api.delete(`/campanas/${campanaId}`);
	},
};
