export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        ui: ["var(--font-family)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#07070b",
        panel: "rgba(18, 18, 28, 0.76)",
        line: "rgba(255, 255, 255, 0.08)",
        text: "var(--text-color)",
        primary: "var(--primary-color)"
      }
    }
  },
  plugins: []
};
