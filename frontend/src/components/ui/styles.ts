export type ClassValue = string | false | null | undefined;

export function cx(...classes: ClassValue[]) {
	return classes.filter(Boolean).join(" ");
}

export const ui = {
	focus:
		"outline-none transition focus:border-[var(--app-primary)] focus:ring-2 focus:ring-[var(--app-ring)] disabled:cursor-not-allowed disabled:opacity-50",

	app: {
		shell:
			"flex h-screen overflow-hidden bg-[var(--app-bg)] font-sans text-[var(--app-text)]",
		sidebar:
			"flex shrink-0 flex-col border-r border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-bg)] text-[var(--app-sidebar-text)] transition-[width] duration-150 ease-[var(--app-ease)]",
		sidebarExpanded: "w-56",
		sidebarCollapsed: "w-16",
		sidebarHeader:
			"flex items-center gap-2 border-b border-[var(--app-sidebar-border)] px-3 py-3",
		sidebarHeaderCollapsed:
			"flex-col justify-center gap-2 px-2 py-3",
		sidebarLogo:
			"flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]",
		sidebarBrand: "truncate text-base font-semibold text-[var(--app-sidebar-brand)]",
		sidebarDescription: "mt-0.5 truncate text-[0.68rem] font-medium text-[var(--app-sidebar-muted)]",
		sidebarNav:
			"app-scrollbar-hidden flex-1 space-y-1 overflow-y-auto px-2 py-2",
		sidebarNavCollapsed: "items-center px-2",
		sidebarFooter:
			"flex items-center justify-between gap-2 border-t border-[var(--app-sidebar-border)] px-3 py-3",
		sidebarFooterCollapsed: "flex-col justify-center px-2",
		sidebarFooterText: "block truncate text-[0.7rem] font-semibold text-[var(--app-sidebar-muted)]",
		sidebarFooterSubtext: "mt-0.5 truncate text-[0.65rem] text-[var(--app-sidebar-muted)]",
		main: "flex-1 overflow-y-auto",
	},

	nav: {
		group: "space-y-0.5",
		groupButton:
			"flex w-full items-center gap-2 rounded-sm border-l-2 border-transparent px-2.5 py-2 text-left transition-colors duration-100",
		groupButtonCollapsed: "h-10 justify-center px-0 py-0",
		groupActive:
			"[border-left-color:var(--app-primary)] bg-[var(--app-sidebar-active-bg)] text-[var(--app-sidebar-active-text)]",
		groupInactive:
			"text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-bg-hover)] hover:text-[var(--app-text)]",
		groupIcon: "flex h-7 w-7 shrink-0 items-center justify-center text-[var(--app-text-muted)]",
		groupLabel: "block truncate text-[0.8rem] font-medium tracking-[-0.01em]",
		groupDescription: "hidden",
		chevron: "shrink-0 transition-transform duration-200 ease-[var(--app-ease)]",
		chevronOpen: "rotate-180",
		submenu:
			"ml-3 space-y-0.5 border-l border-[var(--app-sidebar-border)] pl-2",
		item:
			"flex items-center gap-2 rounded-none px-2.5 py-2 transition-all duration-200 ease-[var(--app-ease)]",
		active:
			"[border-left-color:var(--app-primary)] bg-[var(--app-sidebar-active-bg)] text-[var(--app-sidebar-active-text)]",
		inactive:
			"text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-bg-hover)] hover:text-[var(--app-text)]",
		disabledItem:
			"flex w-full cursor-not-allowed items-center gap-2 rounded-none px-2.5 py-2 text-left text-[var(--app-sidebar-disabled)] opacity-70",
		itemIcon: "flex h-6 w-6 shrink-0 items-center justify-center rounded-none bg-[color-mix(in_srgb,currentColor_10%,transparent)]",
		itemLabel: "block truncate text-[0.82rem] font-medium",
		itemDescription: "hidden",
		icon:
			"flex h-8 w-8 shrink-0 items-center justify-center rounded-none transition-all duration-200 ease-[var(--app-ease)]",
		iconActive: "bg-[var(--app-sidebar-active-bg)] text-[var(--app-sidebar-active-text)]",
		iconInactive:
			"text-[var(--app-sidebar-muted)] hover:bg-[var(--app-sidebar-bg-hover)] hover:text-[var(--app-text)]",
		collapseButton:
			"ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[var(--app-sidebar-muted)] transition-colors hover:bg-[var(--app-sidebar-bg-hover)] hover:text-[var(--app-text)]",
		collapseButtonCollapsed:
			"ml-0 h-8 w-8",
	},

	page: {
		base: "min-h-screen bg-transparent p-4 lg:p-5",
		constrained: "mx-auto min-h-screen max-w-7xl bg-transparent p-4 lg:p-5",
		fill: "h-full min-h-0 bg-transparent p-4 lg:p-5",
		header:
			"mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
		title: "text-2xl font-semibold text-[var(--app-text)]",
		description: "mt-1 text-sm text-[var(--app-text-muted)]",
	},

	home: {
		accountBar:
			"mb-5 grid grid-cols-1 items-center gap-3 rounded-none border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-[var(--app-shadow-sm)] md:grid-cols-[1fr_1fr_1fr_auto]",
		accountItem: "flex min-w-0 items-center gap-2.5 rounded-none bg-[var(--app-surface-muted)] px-3 py-2",
		accountIcon: "flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-[var(--app-primary-soft)] text-[var(--app-primary-text)]",
		accountLabel: "block text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]",
		accountValue: "block truncate text-sm font-semibold text-[var(--app-text)]",
		grid: "grid grid-cols-1 gap-4 xl:grid-cols-2",
		sectionCard: "overflow-hidden p-4",
		sectionHeader: "mb-4 flex items-start gap-3",
		sectionIcon: "flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-[var(--app-surface-muted)] text-[var(--app-text)]",
		sectionTitle: "text-lg font-semibold tracking-tight text-[var(--app-text)]",
		sectionDescription: "mt-1 line-clamp-2 text-sm text-[var(--app-text-muted)]",
		linkGrid: "grid grid-cols-1 gap-2 sm:grid-cols-2",
		linkBase: "group flex min-h-[68px] items-center gap-2.5 rounded-none border px-3 py-2.5 transition-all duration-200 ease-[var(--app-ease)]",
		linkEnabled: "border-[var(--app-border)] bg-[var(--app-surface-muted)] hover:-translate-y-0.5 hover:border-[var(--app-primary-border)] hover:bg-[var(--app-surface)] hover:shadow-[var(--app-shadow-sm)]",
		linkDisabled: "border-dashed border-[var(--app-border)] bg-[var(--app-bg)] opacity-70",
		linkIcon: "flex h-8 w-8 shrink-0 items-center justify-center rounded-none",
		linkIconEnabled: "bg-[var(--app-primary-soft)] text-[var(--app-primary-text)]",
		linkIconDisabled: "bg-[var(--intent-muted-bg)] text-[var(--intent-muted-text)]",
		linkTitle: "block truncate text-sm font-semibold text-[var(--app-text)]",
		linkDescription: "mt-0.5 block line-clamp-1 text-xs font-medium text-[var(--app-text-muted)]",
		linkArrow: "text-[var(--app-text-subtle)] transition-transform group-hover:translate-x-0.5",
		linkLock: "text-[var(--app-text-subtle)]",
	},

	map: {
		workspace:
			"relative flex min-h-[520px] flex-1 flex-col overflow-hidden lg:flex-row",
		panel:
			"z-[500] flex w-full shrink-0 flex-col border-b border-[var(--app-border)] bg-[var(--app-surface)] lg:w-[360px] lg:border-b-0 lg:border-r",
		panelHeader: "border-b border-[var(--app-border)] p-4",
		panelStats:
			"grid grid-cols-2 gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-xs",
		panelList: "flex-1 space-y-2 overflow-y-auto p-3",
		listItem:
			"w-full rounded-none border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--app-surface-muted)]",
		listItemActive:
			"border-[var(--app-primary-border)] bg-[var(--app-primary-soft)]",
		notice:
			"absolute left-4 top-4 z-[1000] rounded-none border px-3 py-2 text-sm font-semibold shadow-[var(--app-shadow-sm)]",
		noticeLoading:
			"border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_95%,transparent)] text-[var(--app-text-muted)]",
		noticeError:
			"border-[var(--intent-danger-border)] bg-[var(--intent-danger-bg)] text-[var(--intent-danger-text)]",
		layerControl:
			"absolute right-4 top-4 z-[1000] flex overflow-hidden rounded-none border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface)_92%,transparent)] p-1 shadow-[var(--app-shadow-md)]",
		layerButton:
			"rounded-none px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-[var(--app-ease)]",
		layerButtonActive:
			"bg-[var(--app-primary)] text-[var(--app-text-inverse)] shadow-[var(--app-shadow-sm)]",
		layerButtonInactive:
			"text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]",
	},

	campaign: {
		selectedPanel:
			"campaign-selected-panel overflow-hidden rounded-none border p-5 shadow-[var(--app-shadow-sm)]",
		selectedSubtext: "text-[var(--campaign-panel-muted)]",
		selectedProgressTrack:
			"h-2.5 w-full overflow-hidden rounded-none bg-[var(--campaign-panel-track)]",
		selectedProgressBar:
			"h-full bg-[var(--campaign-panel-accent)] transition-all duration-500",
		selectedMetric:
			"rounded-none bg-[var(--campaign-panel-metric-bg)] p-3 ring-1 ring-[var(--app-border)]",
		selectedMetricLabel: "text-[var(--campaign-panel-muted)]",
		selectedMetricValue: "font-semibold text-lg",
		selectedIconButton:
			"rounded-sm bg-[var(--campaign-panel-metric-bg)] text-[var(--app-text)] hover:bg-[var(--campaign-panel-metric-bg-hover)]",
	},

	text: {
		label:
			"mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]",
		description: "mt-1 text-sm text-[var(--app-text-muted)]",
		error: "mt-1 text-sm font-semibold text-[var(--intent-danger-text)]",
		subtle: "text-[var(--app-text-subtle)]",
		muted: "text-[var(--app-text-muted)]",
		body: "text-[var(--app-text)]",
	},

	field: {
		base:
			"w-full rounded-none border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-medium text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]",
		compact:
			"w-full rounded-none border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)]",
		white:
			"w-full rounded-none border border-[var(--app-border)] bg-[var(--app-surface-raised)] px-3 py-2 text-sm font-medium text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)]",
		error:
			"border-[var(--intent-danger-border)] bg-[var(--intent-danger-bg)] focus:border-[var(--intent-danger-solid)] focus:ring-[var(--intent-danger-border)]",
		withLeftIcon: "pl-9",
		withRightIcon: "pr-9",
		icon: "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--app-text-subtle)]",
	},

	dropdown: {
        sidebar:
            "flex h-10 w-full items-center justify-between rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[0.72rem] font-medium text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)]",
        
        menu: 
            "absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-none border border-[var(--app-border)] bg-[var(--app-surface-raised)] p-1.5 shadow-[var(--app-shadow-lg)] animate-in fade-in zoom-in-95 duration-200",
        menuItem:
            "flex w-full items-center gap-2 rounded-none px-3 py-2 text-[0.72rem] font-semibold text-[var(--app-text)] transition-all hover:bg-[var(--app-sidebar-bg-hover)] hover:text-[var(--app-primary)]",
        menuItemActive:
            "bg-[var(--app-primary)] !text-white",
    },

	button: {
		base:
			"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50",
		variant: {
			primary:
				"border border-[var(--app-primary)] bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-hover)]",
			primaryGradient:
				"border border-[var(--app-primary)] bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary-hover)]",
			secondary:
				"border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]",
			ghost:
				"text-[var(--app-text-muted)] hover:bg-[var(--intent-neutral-bg)] hover:text-[var(--app-text)]",
			danger:
				"border border-[var(--intent-danger-border)] bg-[var(--intent-danger-bg)] text-[var(--intent-danger-text)] hover:bg-[var(--intent-danger-bg-hover)]",
			dangerSolid:
				"bg-[var(--intent-danger-solid)] text-[var(--app-text-inverse)] shadow-[var(--app-shadow-sm)] hover:brightness-95",
			warning:
				"border border-[var(--intent-warning-border)] bg-[var(--intent-warning-bg)] text-[var(--intent-warning-text)] hover:bg-[var(--intent-warning-bg-hover)]",
			success:
				"border border-[var(--intent-success-border)] bg-[var(--intent-success-bg)] text-[var(--intent-success-text)] hover:bg-[var(--intent-success-bg-hover)]",
			outline:
				"border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]",
		},
		size: {
			xs: "h-8 px-3 text-xs",
			sm: "h-9 px-3 text-sm",
			md: "h-10 px-4 text-sm",
			lg: "h-11 px-5 text-sm",
			iconXs: "h-8 w-8 p-0",
			iconSm: "h-9 w-9 p-0",
			icon: "h-10 w-10 p-0",
		},
	},

	card: {
		base:
			"rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)]",
		padded:
			"rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]",
		header: "border-b border-[var(--app-border)] px-6 py-5",
		content: "px-6 py-5",
		footer: "border-t border-[var(--app-border)] bg-[var(--app-surface-muted)]/80 px-6 py-4",
		title: "text-lg font-semibold text-[var(--app-text)]",
		description: "mt-1 text-sm text-[var(--app-text-muted)]",
	},

	modal: {
		overlay:
			"fixed inset-0 z-[3000] flex items-center justify-center bg-[var(--app-overlay)] p-4",
		panel:
			"flex max-h-[92vh] w-full flex-col overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-bg-elevated)] shadow-[var(--app-shadow-lg)]",
		header:
			"flex items-start justify-between gap-4 border-b border-[var(--app-border)] px-6 py-5",
		body: "overflow-y-auto px-6 py-5",
		footer:
			"flex flex-col-reverse gap-3 border-t border-[var(--app-border)] bg-[var(--app-surface-muted)] px-6 py-4 sm:flex-row sm:justify-end",
		icon:
			"flex h-11 w-11 shrink-0 items-center justify-center rounded-none border border-[var(--app-primary-border)] bg-[var(--app-primary-soft)] text-[var(--app-primary-text)]",
	},

	badge: {
		base: "inline-flex items-center gap-1 rounded-none border border-transparent px-2.5 py-1 text-xs font-semibold",
		variant: {
			neutral: "bg-[var(--intent-neutral-bg)] text-[var(--intent-neutral-text)]",
			slate: "bg-[var(--intent-muted-bg)] text-[var(--intent-muted-text)]",
			blue: "bg-[var(--intent-info-bg)] text-[var(--intent-info-text)]",
			green: "bg-[var(--intent-success-bg)] text-[var(--intent-success-text)]",
			purple: "bg-[var(--intent-accent-bg)] text-[var(--intent-accent-text)]",
			amber: "bg-[var(--intent-warning-bg)] text-[var(--intent-warning-text)]",
			red: "bg-[var(--intent-danger-bg)] text-[var(--intent-danger-text)]",
			white: "bg-[var(--app-surface)] text-[var(--app-text-muted)] shadow-[var(--app-shadow-sm)]",
		},
	},

	tone: {
		neutral:
			"border-[var(--intent-neutral-border)] bg-[var(--intent-neutral-bg)] text-[var(--intent-neutral-text)]",
		info:
			"border-[var(--intent-info-border)] bg-[var(--intent-info-bg)] text-[var(--intent-info-text)]",
		success:
			"border-[var(--intent-success-border)] bg-[var(--intent-success-bg)] text-[var(--intent-success-text)]",
		warning:
			"border-[var(--intent-warning-border)] bg-[var(--intent-warning-bg)] text-[var(--intent-warning-text)]",
		danger:
			"border-[var(--intent-danger-border)] bg-[var(--intent-danger-bg)] text-[var(--intent-danger-text)]",
		accent:
			"border-[var(--intent-accent-border)] bg-[var(--intent-accent-bg)] text-[var(--intent-accent-text)]",
		muted:
			"border-[var(--intent-muted-border)] bg-[var(--intent-muted-bg)] text-[var(--intent-muted-text)]",
	},

	solidTone: {
		neutral: "bg-[var(--intent-neutral-solid)] text-[var(--app-text-inverse)]",
		info: "bg-[var(--intent-info-solid)] text-[var(--app-text-inverse)]",
		success: "bg-[var(--intent-success-solid)] text-[var(--app-text-inverse)]",
		warning: "bg-[var(--intent-warning-solid)] text-[var(--app-text-inverse)]",
		danger: "bg-[var(--intent-danger-solid)] text-[var(--app-text-inverse)]",
		accent: "bg-[var(--intent-accent-solid)] text-[var(--app-text-inverse)]",
		muted: "bg-[var(--intent-muted-solid)] text-[var(--app-text-inverse)]",
	},

	progress: {
		info: "bg-[var(--chart-1)]",
		success: "bg-[var(--chart-2)]",
		warning: "bg-[var(--chart-3)]",
		accent: "bg-[var(--chart-4)]",
		danger: "bg-[var(--chart-5)]",
		muted: "bg-[var(--chart-6)]",
	},

	status: {
		draft:
			"border-[var(--intent-neutral-border)] bg-[var(--intent-neutral-bg)] text-[var(--intent-neutral-text)]",
		ready:
			"border-[var(--intent-info-border)] bg-[var(--intent-info-bg)] text-[var(--intent-info-text)]",
		running:
			"border-[var(--intent-warning-border)] bg-[var(--intent-warning-bg)] text-[var(--intent-warning-text)]",
		paused:
			"border-[var(--intent-accent-border)] bg-[var(--intent-accent-bg)] text-[var(--intent-accent-text)]",
		completed:
			"border-[var(--intent-success-border)] bg-[var(--intent-success-bg)] text-[var(--intent-success-text)]",
		error:
			"border-[var(--intent-danger-border)] bg-[var(--intent-danger-bg)] text-[var(--intent-danger-text)]",
		unknown:
			"border-[var(--intent-muted-border)] bg-[var(--intent-muted-bg)] text-[var(--intent-muted-text)]",
	},
};

export type UiTone = keyof typeof ui.tone;

export function toneClass(tone: UiTone = "info") {
	return ui.tone[tone];
}

export function progressClass(tone: UiTone = "info") {
	return ui.progress[tone as keyof typeof ui.progress] || ui.progress.info;
}
