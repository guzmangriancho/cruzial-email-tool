import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import {
	APP_THEME_STORAGE_KEY,
	applyThemeModeToDocument,
	getStoredThemeMode,
	isAppThemeMode,
	persistThemeMode,
	type AppThemeMode,
} from "./appTheme";

type ThemeContextValue = {
	themeMode: AppThemeMode;
	setThemeMode: (mode: AppThemeMode) => void;
	isDarkMode: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [themeMode, setThemeModeState] = useState<AppThemeMode>(() =>
		getStoredThemeMode(),
	);

	useEffect(() => {
		applyThemeModeToDocument(themeMode);
		persistThemeMode(themeMode);
	}, [themeMode]);

	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== APP_THEME_STORAGE_KEY || !isAppThemeMode(event.newValue)) {
				return;
			}
			setThemeModeState(event.newValue);
		};

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const setThemeMode = useCallback((mode: AppThemeMode) => {
		setThemeModeState(mode);
	}, []);

	const value = useMemo<ThemeContextValue>(
		() => ({ themeMode, setThemeMode, isDarkMode: themeMode === "dark" }),
		[themeMode, setThemeMode],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme debe usarse dentro de ThemeProvider");
	}
	return context;
}
