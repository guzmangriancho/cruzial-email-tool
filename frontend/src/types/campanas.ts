export interface CampanaResumen {
	campana_id: number;
	nombre: string;
	estado: string;
	total: number;
	pendientes: number;
	enviados: number;
	errores: number;
	omitidos: number;
	procesados: number;
	finalizado: boolean;
	fecha_creacion: string | null;
	fecha_inicio: string | null;
	fecha_fin: string | null;
	remitente: string | null;
	delay_segundos: number | null;
}

export interface EstadoCampana extends CampanaResumen {
	task_id: string | null;
	mensaje: string;
	log_actividad: string[];
	detener?: boolean;
}

export interface LogCampana {
	id: number;
	cliente_id: number | null;
	email: string | null;
	nombre: string | null;
	estado: string;
	fecha_envio: string | null;
	detalle_error: string | null;
	intentos: number | null;
}

export interface CampanaDetalle {
	campana_id?: number;
	id?: number;
	nombre?: string | null;
	asunto?: string | null;
	cuerpo_html?: string | null;
	remitente?: string | null;
	delay_segundos?: number | null;
	estado?: string | null;
	adjuntos_genericos?: string[] | null;
	adjuntos_guardados?: string[] | null;
	plantilla?: {
		asunto?: string | null;
		cuerpo_html?: string | null;
	} | null;
}

export interface VariableToken {
	label: string;
	token: string;
	ayuda: string;
}

export interface AdjuntoDisponible {
	nombre: string;
	size_bytes: number;
}
