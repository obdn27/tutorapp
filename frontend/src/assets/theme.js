// src/assets/theme.js

export const lightTheme = {
	// -------------------------
	// Tokens (use these to build component strings)
	// -------------------------
	tokens: {
		radius: {
			sm: "rounded-lg",
			md: "rounded-xl",
			lg: "rounded-2xl",
			pill: "rounded-full",
		},
		ring: {
			focus: "focus:ring-2 focus:ring-indigo-500/20 focus:outline-none",
		},
		transition: {
			base: "transition-colors duration-150",
			all: "transition-all duration-150",
		},
	},

	// -------------------------
	// Colors
	// -------------------------
	colors: {
		brand: {
			fg: "text-indigo-700",
			fgHover: "hover:text-indigo-800",
			bgSoft: "bg-indigo-50",
			bgSoftHover: "hover:bg-indigo-100",
			bg: "bg-indigo-600",
			bgHover: "hover:bg-indigo-700",
			borderSoft: "border-indigo-100",
			border: "border-indigo-200",
			on: "text-white",
		},

		text: {
			primary: "text-slate-900",
			secondary: "text-slate-700",
			muted: "text-slate-500",
			faint: "text-slate-400",
			inverse: "text-white",
		},

		surface: {
			page: "bg-slate-50",
			base: "bg-white",
			muted: "bg-slate-100",
			soft: "bg-slate-50",
			inverse: "bg-slate-900",
			overlay: "bg-slate-900/40",
		},

		border: {
			hairline: "border-slate-100",
			base: "border-slate-200",
			strong: "border-slate-300",
			focus: "border-indigo-500",
		},

		status: {
			success: "text-green-700 bg-green-50 border-green-200",
			error: "text-red-700 bg-red-50 border-red-200",
			warning: "text-orange-700 bg-orange-50 border-orange-200",
			info: "text-blue-700 bg-blue-50 border-blue-200",
		},
	},

	// -------------------------
	// Typography
	// -------------------------
	typography: {
		huge: "text-4xl font-extrabold tracking-tight text-slate-900",
		h1: "text-3xl font-extrabold tracking-tight text-slate-900",
		h2: "text-2xl font-bold tracking-tight text-slate-900",
		h3: "text-xl font-bold text-slate-900",
		heading: "text-slate-900 font-bold",
		body: "text-slate-700 leading-relaxed",
		muted: "text-slate-500 text-sm",
		faint: "text-slate-400 text-sm",
		mono: "font-mono text-sm text-slate-700",

		link:
			"text-indigo-700 font-semibold underline underline-offset-4 hover:text-indigo-800 " +
			"decoration-indigo-200 hover:decoration-indigo-300 transition-colors",
	},

	// -------------------------
	// Components
	// -------------------------
	components: {
		// Layout wrappers
		container: {
			page: "min-h-screen bg-slate-50",
			content: "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8",
			narrow: "mx-auto w-full max-w-2xl px-4 sm:px-6",
			section: "py-6 sm:py-8",
		},

		// Surfaces
		card: {
			base:
				"bg-white border border-slate-200 rounded-2xl overflow-hidden",
			subtle:
				"bg-white border border-slate-100 rounded-2xl overflow-hidden",
			interactive:
				"bg-white border border-slate-200 rounded-2xl overflow-hidden " +
				"hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors cursor-pointer",
			muted:
				"bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden",
		},

		panel: {
			// for sidebars / right rails
			base: "bg-white border border-slate-200 rounded-2xl",
			stickyRight: "bg-white border-l border-slate-200",
		},

		// Dividers / separators
		divider: {
			hr: "border-t border-slate-200",
			soft: "border-t border-slate-100",
		},

		// Buttons
		button: {
			base:
				"inline-flex items-center justify-center gap-2 font-semibold " +
				"px-4 py-2.5 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
			sm: "px-3 py-2 text-sm rounded-lg",
			lg: "px-5 py-3 text-base rounded-xl",

			primary:
				"bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700",
			secondary:
				"bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50",
			neutral:
				"bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
			ghost:
				"bg-transparent text-slate-600 border-transparent hover:bg-slate-100",
			danger:
				"bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700",
			dangerSoft:
				"bg-red-50 text-red-700 border-red-200 hover:bg-red-100",

			// For icon-only buttons
			icon:
				"inline-flex items-center justify-center rounded-xl border border-slate-200 " +
				"text-slate-600 hover:bg-slate-50 transition-colors",
			iconSm: "h-9 w-9",
			iconMd: "h-10 w-10",
		},

		// Inputs
		input: {
			base:
				"w-full px-4 py-3 bg-white border border-slate-200 rounded-xl " +
				"text-slate-900 placeholder:text-slate-400 " +
				"focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none",
			soft:
				"w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl " +
				"text-slate-900 placeholder:text-slate-400 " +
				"focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none",
			label:
				"text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2 block",
			helper: "text-xs text-slate-500 mt-2 ml-1",
			error: "border-red-300 focus:border-red-500 focus:ring-red-500/20",
		},

		select: {
			base:
				"w-full px-4 py-3 bg-white border border-slate-200 rounded-xl " +
				"text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none",
		},

		// Badges / pills
		badge: {
			base: "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border",
			neutral: "bg-slate-50 text-slate-700 border-slate-200",
			brand: "bg-indigo-50 text-indigo-700 border-indigo-200",
			success: "bg-green-50 text-green-700 border-green-200",
			warning: "bg-orange-50 text-orange-700 border-orange-200",
			error: "bg-red-50 text-red-700 border-red-200",
			info: "bg-blue-50 text-blue-700 border-blue-200",
		},

		// Alerts
		alert: {
			base: "rounded-2xl border px-4 py-3 text-sm",
			success: "bg-green-50 border-green-200 text-green-800",
			error: "bg-red-50 border-red-200 text-red-800",
			warning: "bg-orange-50 border-orange-200 text-orange-800",
			info: "bg-blue-50 border-blue-200 text-blue-800",
		},

		// Navigation / tabs
		nav: {
			link:
				"px-3 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors",
			linkActive:
				"px-3 py-2 rounded-xl font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200",
			pill:
				"inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 " +
				"text-slate-700 hover:bg-slate-50 transition-colors",
		},

		tabs: {
			wrapper: "inline-flex gap-2 rounded-2xl bg-slate-100 p-1",
			tab:
				"px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors",
			tabActive: "bg-white border border-slate-200 text-slate-900",
		},

		// Tables (useful for bookings lists later)
		table: {
			wrapper: "overflow-hidden rounded-2xl border border-slate-200 bg-white",
			table: "w-full text-sm",
			th:
				"text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200",
			td: "px-4 py-3 border-b border-slate-100 text-slate-700",
			trHover: "hover:bg-slate-50 transition-colors",
		},

		// Modals / overlays
		modal: {
			overlay: "fixed inset-0 bg-slate-900/40",
			panel:
				"w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-5",
			header: "flex items-start justify-between gap-3",
			title: "text-lg font-bold text-slate-900",
			body: "mt-3 text-sm text-slate-700",
			footer: "mt-5 flex items-center justify-end gap-2",
		},

		// Misc
		link: "text-indigo-700 font-semibold hover:text-indigo-800 transition-colors",
		avatar: "rounded-2xl object-cover border border-slate-200",
		kbd:
			"inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700",

		scroll: {
			wrap: "min-h-0 flex-1", // critical: allows the inner area to actually shrink
			view: "pr-2",           // space for scrollbar
			trackV: "w-2 right-0 top-0 bottom-0 rounded-full bg-transparent",
			thumbV:
				"rounded-full bg-slate-200 hover:bg-slate-300 transition-colors",
		},
	},
};