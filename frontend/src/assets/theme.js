// export const lightTheme = {
//   pageBg: "bg-gray-100",
//   cardBg: "bg-white",
//   cardBorder: "border border-gray-200",
//   cardShadow: "shadow-sm",

//   textPrimary: "text-gray-900",
//   textSecondary: "text-gray-700",

//   inputBase:
//     "p-2 rounded-md bg-white text-gray-900 border border-gray-300",
//   inputFocus:
//     "focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300",

//   button:
//     "bg-gray-900 text-white hover:bg-gray-800 transition rounded-md",
// };


export const lightTheme = {
  colors: {
    brand: {
      light: 'indigo-50',
      base: 'indigo-600',
      dark: 'indigo-700',
      onBase: 'white',
      onLight: 'indigo-700'
    },
    surface: {
      page: 'bg-slate-50',
      card: 'bg-white',
      header: 'bg-white',
      sidebar: 'bg-white',
      muted: 'bg-slate-100',
      inverse: 'bg-slate-900'
    },
    border: {
      light: 'border-slate-100',
      base: 'border-slate-200',
      brand: 'border-indigo-100',
      focus: 'border-indigo-500',
    },
    status: {
      success: 'text-green-600 bg-green-50 border-green-100',
      error: 'text-red-600 bg-red-50 border-red-100',
      warning: 'text-orange-600 bg-orange-50 border-orange-100',
      info: 'text-blue-600 bb-blue-50 border-blue-100',
    }
  },
  typography: {
    huge: 'text-indigo-500 font-bold text-4xl',
    heading: 'text-slate-900 font-bold',
    body: 'text-slate-600 leading-relaxed',
    muted: 'text-slate-400 text-sm',
    inverse: 'text-white',
    link: 'text-indigo-600 font-semibold hover:tex-indigo-700 transition-colors'
  },
  components: {
    button: {
      primary: 'bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2',
      secondary: 'bg-white text-indigo-600 border border-indigo-100 font-bold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2',
      ghostBase: 'font-semibold px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2',
      ghostHover: 'hover:bg-slate-100 hover:text-slate-90',
      ghostSelected: 'bg-slate-100 text-slate-900',
      ghost: 'text-slate-500',
      danger: 'bg-red-50 text-red-600 font-bold px-6 py-3 rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-2',
    },
    input: {
      base: 'w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:bg-white focus:border-indigo-500 text-slate-900 placeholder:text-slate-400',
      label: 'text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-2.5 block',
    },
    card: {
      base: 'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden',
      interactive: 'bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer overflow-hidden',
    },
    link: 'text-slate-500 underline font-semibold ',
    badge: 'px-3 py-1 rounded-full text-xs font-bold',
    avatar: 'rounded-2xl object-cover border-2 border-white shadow-sm'
  }
}