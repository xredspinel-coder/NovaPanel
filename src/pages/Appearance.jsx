import { Activity, BarChart3, Home, Server, Users } from "lucide-react";
import { buttonClass, Field, inputClass } from "../components/Field.jsx";
import { themePresets } from "../styles/themePresets.js";

const fonts = ["Inter", "Manrope", "Space Grotesk", "system-ui", "Arial"];

function DashboardPreview({ appearance }) {
  const previewIcons = [Home, Users, Activity, BarChart3, Server];
  const previewStyle = {
    background: `linear-gradient(135deg, ${appearance.backgroundColor}, color-mix(in srgb, ${appearance.backgroundColor} 78%, ${appearance.surfaceColor} 22%))`,
    color: appearance.textColor,
    fontFamily: appearance.fontFamily,
    fontSize: `${appearance.fontSize}px`
  };

  return (
    <section className="rounded-lg border border-line bg-panel/92 p-4 shadow-[0_18px_70px_rgb(0_0_0/0.12)] backdrop-blur">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text">Live Dashboard Preview</h2>
        <p className="mt-1 text-sm text-text/52">Theme changes update this sample instantly.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-line" style={previewStyle}>
        <div className="flex min-h-72">
          <aside
            className="flex w-14 shrink-0 flex-col items-center gap-5 border-r py-4"
            style={{
              borderColor: `${appearance.textColor}22`,
              backgroundColor: `${appearance.surfaceColor}d9`
            }}
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-md border text-sm font-black"
              style={{
                borderColor: `${appearance.primaryColor}66`,
                backgroundColor: `${appearance.primaryColor}18`,
                color: appearance.primaryColor
              }}
            >
              N
            </span>
            {previewIcons.map((Icon, index) => (
              <span key={index} className="grid h-8 w-8 place-items-center">
                <Icon
                  className="h-4 w-4"
                  strokeWidth={2.2}
                  style={{
                    color: index === 2 ? appearance.primaryColor : `${appearance.textColor}78`
                  }}
                />
              </span>
            ))}
          </aside>
          <div className="flex-1 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em]" style={{ color: appearance.primaryColor }}>NovaPanel</p>
                <h3 className="mt-1 text-lg font-semibold">Activities</h3>
              </div>
              <span
                className="rounded-md border px-3 py-2 text-sm"
                style={{
                  borderColor: `${appearance.textColor}22`,
                  backgroundColor: `${appearance.surfaceColor}bf`,
                  color: `${appearance.textColor}cc`
                }}
              >
                Search
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Users", "284"],
                ["Success", "91%"],
                ["Errors", "3"]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: `${appearance.textColor}22`,
                    backgroundColor: `${appearance.surfaceColor}d9`
                  }}
                >
                  <p className="text-xs uppercase tracking-[0.16em]" style={{ color: `${appearance.textColor}88` }}>{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div
              className="mt-3 rounded-lg border p-3"
              style={{
                borderColor: `${appearance.textColor}22`,
                backgroundColor: `${appearance.surfaceColor}d9`
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Frieren: Beyond Journey's End</p>
                  <p className="text-sm" style={{ color: `${appearance.textColor}99` }}>Episode 12 / 94% similarity</p>
                </div>
                <span
                  className="rounded-full border px-2 py-1 text-xs"
                  style={{
                    borderColor: `${appearance.primaryColor}55`,
                    backgroundColor: `${appearance.primaryColor}22`,
                    color: appearance.primaryColor
                  }}
                >
                  success
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Appearance({ appearance, setAppearance, resetAppearance }) {
  const fontSizeMin = 12;
  const fontSizeMax = 18;
  const currentFontSize = Math.min(fontSizeMax, Math.max(fontSizeMin, Number(appearance.fontSize) || 14));
  const fontSizePercent = ((currentFontSize - fontSizeMin) / (fontSizeMax - fontSizeMin)) * 100;
  const labelPosition = Math.min(92, Math.max(8, fontSizePercent));

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

      <DashboardPreview appearance={appearance} />

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
            <div className="rounded-lg border border-line bg-ink/24 px-4 py-3">
              <div className="relative pb-1 pt-8">
                <span
                  className="pointer-events-none absolute top-0 rounded-md border border-primary/24 bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary shadow-[0_10px_24px_rgb(0_0_0/0.18)]"
                  style={{
                    left: `${labelPosition}%`,
                    transform: "translateX(-50%)"
                  }}
                >
                  {currentFontSize}px
                </span>
                <input
                  className="theme-range"
                  type="range"
                  min={fontSizeMin}
                  max={fontSizeMax}
                  value={currentFontSize}
                  onChange={(event) => patch("fontSize", Number(event.target.value))}
                  aria-label="Font size"
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-text/42">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>
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
