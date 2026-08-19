import { api } from "./api";

export type LocalStatus = {
  database_path: string;
  database_ok: boolean;
  database_message: string;
  log_path: string;
  app_mode: string;
};

export type SmtpStatus = {
  configured: boolean;
  source: string;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_security?: string | null;
  smtp_username?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  reply_to?: string | null;
  last_test_success: boolean;
  last_test_at?: string | null;
  last_test_error?: string | null;
  can_edit: boolean;
};

export type SmtpPayload = {
  smtp_username: string;
  smtp_password: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_security?: string;
  auto_discover?: boolean;
};

export type SmtpTest = { ok: boolean; message: string; smtp_host?: string | null; smtp_port?: number | null; smtp_security?: string | null };

export type AiPromptStatus = {
  prompt: string;
  is_default: boolean;
};

export const configuracionService = {
  async estado() { return (await api.get<LocalStatus>("/configuracion/estado")).data; },
  async promptIa() { return (await api.get<AiPromptStatus>("/configuracion/prompt-ia")).data; },
  async promptIaGuardar(prompt: string) { return (await api.put<AiPromptStatus>("/configuracion/prompt-ia", { prompt })).data; },
  async promptIaRestaurar() { return (await api.delete<AiPromptStatus>("/configuracion/prompt-ia")).data; },
  async smtpEstado() { return (await api.get<SmtpStatus>("/configuracion/smtp")).data; },
  async smtpProbar(payload: SmtpPayload) { return (await api.post<SmtpTest>("/configuracion/smtp/probar", payload)).data; },
  async smtpGuardar(payload: SmtpPayload) { return (await api.put<SmtpStatus>("/configuracion/smtp", payload)).data; },
  async smtpEliminar() { return (await api.delete<{ mensaje: string }>("/configuracion/smtp")).data; },
};
