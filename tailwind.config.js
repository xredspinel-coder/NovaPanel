export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        ui: ["var(--font-family)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "rgb(var(--background-rgb) / <alpha-value>)",
        panel: "rgb(var(--surface-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / 0.12)",
        text: "rgb(var(--text-rgb) / <alpha-value>)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)"
      }
    }
  },
  plugins: []
};
