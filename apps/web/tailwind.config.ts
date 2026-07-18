/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--color-bg-base)",
          elevated: "var(--color-bg-elevated)",
          overlay: "var(--color-bg-overlay)",
          raised: "var(--color-bg-surface-raised)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          muted: "var(--color-teal-soft)",
        },
        state: {
          healthy: "var(--color-status-success)",
          degraded: "var(--color-status-warning)",
          blocked: "var(--color-status-error)",
          info: "var(--color-status-info)",
          failover: "var(--color-status-failover)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-muted)",
          muted: "var(--color-text-faint)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        headline: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
