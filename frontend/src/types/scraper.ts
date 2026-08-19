export type EstadoFila = "cargando" | "completado" | "descartado" | "duplicado";

export interface ClienteExtraido {
  id_temp?: string;
  nombre: string;
  ciudad: string;
  email: string;
  telefono: string;
  sector: string;
  estado_fila?: EstadoFila;
  latitud?: number;
  longitud?: number;
  url_maps?: string;
  sitio_web?: string;
  direccion?: string;
}

export interface EstadoScraper {
  estado: string;
  busqueda: string;
  mensaje: string;
  nuevos_clientes?: number;
  clientes_actualizados?: number;
  log_actividad?: string[];
  clientes_extraidos?: ClienteExtraido[];
  coordenadas_actuales?: [number, number];
}
