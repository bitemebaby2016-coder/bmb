// ============================================
// Bite Me Baby — ToggleSwitch (ปุ่มเปิด-ปิด สำหรับหน้าแอดมิน)
// ============================================
// แทน checkbox แบบเดิมเพื่อให้แอดมินใช้งานง่ายที่สุด: เห็นสถานะชัดเจนในป้ายเดียว
// แตะสลับเปิด/ปิดได้ทันที + รองรับคีย์บอร์ด (role="switch")
// ============================================

interface ToggleSwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
  /** สำหรับ e2e/unit test */
  testId?: string
}

export function ToggleSwitch({ checked, onChange, label, disabled = false, testId }: ToggleSwitchProps) {
  return (
    <label className={`bmb-toggle${disabled ? ' is-disabled' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`bmb-toggle-track${checked ? ' is-on' : ''}`}
      >
        <span className="bmb-toggle-knob" />
      </button>
      <span className="bmb-toggle-label">{label}</span>
    </label>
  )
}
