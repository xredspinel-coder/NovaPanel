import { buttonClass, Field, inputClass } from "../components/Field.jsx";

const fonts = ["Inter", "Manrope", "Space Grotesk", "system-ui", "Arial"];

export function Appearance({ appearance, setAppearance, resetAppearance }) {
  function patch(key, value) {
    setAppearance((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Appearance</h1>
        <p className="text-sm text-white/45">Local dashboard controls for color and type.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <Field label="Primary color">
            <input
              className="h-11 w-full cursor-pointer rounded-md border border-line bg-transparent p-1"
              type="color"
              value={appearance.primaryColor}
              onChange={(event) => patch("primaryColor", event.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4 backdrop-blur">
          <Field label="Text color">
            <input
              className="h-11 w-full cursor-pointer rounded-md border border-line bg-transparent p-1"
              type="color"
              value={appearance.textColor}
              onChange={(event) => patch("textColor", event.target.value)}
            />
          </Field>
        </div>

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
            <p className="mt-2 text-sm text-white/45">{appearance.fontSize}px</p>
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
