/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Neutral productivity palette per docs/UI_UX.md §6
        surface: {
          DEFAULT: "#0f1117",
          elevated: "#1a1d27",
          overlay: "#242837",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          muted: "#4f46e5",
        },
        state: {
          healthy: "#22c55e",
          degraded: "#f59e0b",
          blocked: "#ef4444",
          info: "#3b82f6",
        },
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
