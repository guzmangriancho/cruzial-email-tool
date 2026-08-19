export type ApiRequestConfig = {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  responseType?: "json" | "blob" | "text";
};

export type ApiResponse<T = unknown> = { data: T; status: number; headers: Headers };

const viteApiUrl = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
const defaultOrigin =
  typeof window !== "undefined" && window.location.port !== "5173"
    ? window.location.origin
    : "http://127.0.0.1:8000";
const API_BASE_URL = (viteApiUrl || `${defaultOrigin}/api`).replace(/\/$/, "");

function buildUrl(path: string, params?: Record<string, unknown>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") url.searchParams.append(key, String(item));
      });
    } else {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function buildHeaders(data?: unknown, customHeaders?: Record<string, string>) {
  const headers: Record<string, string> = { Accept: "application/json", ...customHeaders };
  if (data !== undefined && data !== null && !(data instanceof FormData) && !(data instanceof Blob)) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function parseResponse<T>(response: Response, responseType: ApiRequestConfig["responseType"]): Promise<T> {
  if (responseType === "blob") return (await response.blob()) as T;
  if (responseType === "text") return (await response.text()) as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { return text as T; }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => typeof item === "string" ? item : (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : JSON.stringify(item))).join("\n");
  }
  return fallback;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown, message?: string) {
    super(message || getErrorMessage(payload, `Error HTTP ${status}`));
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T = unknown>(method: string, path: string, data?: unknown, config: ApiRequestConfig = {}): Promise<ApiResponse<T>> {
  const response = await fetch(buildUrl(path, config.params), {
    method,
    headers: buildHeaders(data, config.headers),
    body: method === "GET" || method === "HEAD" ? undefined : data instanceof FormData || data instanceof Blob ? data : data === undefined || data === null ? undefined : JSON.stringify(data),
  });
  const parsed = await parseResponse<T>(response, config.responseType || "json");
  if (!response.ok) throw new ApiError(response.status, parsed);
  return { data: parsed, status: response.status, headers: response.headers };
}

export const api = {
  get: <T = unknown>(path: string, config?: ApiRequestConfig) => request<T>("GET", path, undefined, config),
  post: <T = unknown>(path: string, data?: unknown, config?: ApiRequestConfig) => request<T>("POST", path, data, config),
  put: <T = unknown>(path: string, data?: unknown, config?: ApiRequestConfig) => request<T>("PUT", path, data, config),
  patch: <T = unknown>(path: string, data?: unknown, config?: ApiRequestConfig) => request<T>("PATCH", path, data, config),
  delete: <T = unknown>(path: string, config?: ApiRequestConfig) => request<T>("DELETE", path, undefined, config),
};
