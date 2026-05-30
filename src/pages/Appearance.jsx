import { buttonClass, Field, inputClass } from "../components/Field.jsx";
import { themePresets } from "../styles/themePresets.js";

const fonts = ["Inter", "Manrope", "Space Grotesk", "system-ui", "Arial"];

export function Appearance({ appearance, setAppearance, resetAppearance }) {
  function patch(key, value) {
    setAppearance((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applyPreset(preset) {
    setAppearance((current) => ({
      ...current,
      themePreset: preset.id,
      backgroundColor: preset.backgroundColor,
      surfaceColor: preset.surfaceColor,
      primaryColor: preset.primaryColor,
      textColor: preset.textColor
    }));
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold text-text">Appearance</h1>
        <p className="text-sm text-text/58">Theme presets and local typography controls for NovaPanel.</p>
      </div>

      <section className="space-y-4 rounded-lg border border-line bg-panel/92 p-4 shadow-[0_18px_70px_rgb(0_0_0/0.12)] backdrop-blur">
        <div>
          <h2 className="text-lg font-semibold text-text">Theme Presets</h2>
          <p className="mt-1 text-sm text-text/52">Switch the full dark palette instantly without manual color tuning.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {themePresets.map((preset) => {
            const active = appearance.themePreset === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`group rounded-lg border p-3 text-left transition duration-200 ${
                  active
                    ? "border-primary text-text"
                    : "border-line text-text/72 hover:border-primary hover:text-text"
                }`}
                style={{
                  background: `linear-gradient(135deg, ${preset.backgroundColor}, ${preset.surfaceColor})`
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{preset.name}</span>
                  <span className={`h-2 w-2 rounded-full ${active ? "bg-primary" : "bg-text/24 group-hover:bg-primary"}`} />
                </div>
                <div className="mt-4 flex gap-2">
                  {[preset.backgroundColor, preset.surfaceColor, preset.primaryColor, preset.textColor].map((color) => (
                    <span key={color} className="h-7 flex-1 rounded-md border border-text/12" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <Field label="Font size">
            <input
              className={inputClass}
              type="range"
              min="12"
              max="18"
              value={appearance.fontSize}
              onChange={(event) => patch("fontSize", Number(event.target.value))}
            />
            <p className="mt-2 text-sm text-text/52">{appearance.fontSize}px</p>
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <Field label="Font family">
            <select className={inputClass} value={appearance.fontFamily} onChange={(event) => patch("fontFamily", event.target.value)}>
              {fonts.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <button className={buttonClass} type="button" onClick={resetAppearance}>
        Reset appearance
      </button>
    </div>
  );
}
