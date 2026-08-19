export type AppThemeMode = "dark" | "light";

export const APP_THEME_STORAGE_KEY = "cruzial_theme_mode_simple_v1";
export const DEFAULT_APP_THEME: AppThemeMode = "light";

export const APP_THEME_OPTIONS: Array<{
	value: AppThemeMode;
	label: string;
	description: string;
}> = [
	{
		value: "dark",
		label: "Oscuro",
		description: "Modo heredado. La interfaz local mantiene una apariencia clara y sobria.",
	},
	{
		value: "light",
		label: "Claro",
		description: "Interfaz clara, compacta y pensada para trabajo diario.",
	},
];

export function isAppThemeMode(value: unknown): value is AppThemeMode {
	return value === "dark" || value === "light";
}

export function getStoredThemeMode(): AppThemeMode {
	if (typeof window === "undefined") {
		return DEFAULT_APP_THEME;
	}

	try {
		const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
		return isAppThemeMode(stored) ? stored : DEFAULT_APP_THEME;
	} catch {
		return DEFAULT_APP_THEME;
	}
}

export function persistThemeMode(mode: AppThemeMode) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(APP_THEME_STORAGE_KEY, mode);
	} catch {
		// localStorage puede estar deshabilitado en modo privado o políticas corporativas.
	}
}

export function applyThemeModeToDocument(mode: AppThemeMode) {
	if (typeof document === "undefined") {
		return;
	}

	const root = document.documentElement;
	root.dataset.cruzialTheme = mode;
	root.style.colorScheme = mode;
}

export function applyStoredThemeMode() {
	const mode = getStoredThemeMode();
	applyThemeModeToDocument(mode);
	return mode;
}
