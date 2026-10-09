export interface SimulatorSettings {
  periodMs: number
  peakOffsetDeg: number
  peakDecayPerRep: number
  slowdownPerRep: number
}

export const DEFAULT_SIMULATOR: SimulatorSettings = { periodMs: 2500, peakOffsetDeg: -10, peakDecayPerRep: 1, slowdownPerRep: 60 }

interface Props {
  settings: SimulatorSettings
  onChange: (next: SimulatorSettings) => void
}

/** Controls for the stand-in motion source. Disappears once the CV module replaces it. */
export function SimulatorPanel({ settings, onChange }: Props) {
  const set = (patch: Partial<SimulatorSettings>) => onChange({ ...settings, ...patch })
  return (
    <div className="card simulator">
      <h3>
        Simulated user <span className="badge">stand-in for the camera</span>
      </h3>
      <label>
        Rep tempo: {(settings.periodMs / 1000).toFixed(1)} s per rep
        <input type="range" min={1200} max={5000} step={100} value={settings.periodMs} onChange={(e) => set({ periodMs: Number(e.target.value) })} />
      </label>
      <label>
        Peak vs target: {settings.peakOffsetDeg >= 0 ? '+' : ''}
        {settings.peakOffsetDeg}°
        <input type="range" min={-60} max={20} step={1} value={settings.peakOffsetDeg} onChange={(e) => set({ peakOffsetDeg: Number(e.target.value) })} />
      </label>
      <label>
        Range lost per rep: {settings.peakDecayPerRep}°
        <input type="range" min={0} max={8} step={0.5} value={settings.peakDecayPerRep} onChange={(e) => set({ peakDecayPerRep: Number(e.target.value) })} />
      </label>
      <label>
        Slowdown per rep: {settings.slowdownPerRep} ms
        <input type="range" min={0} max={400} step={20} value={settings.slowdownPerRep} onChange={(e) => set({ slowdownPerRep: Number(e.target.value) })} />
      </label>
      <p className="muted small">Changes apply at the start of the next set.</p>
    </div>
  )
}
