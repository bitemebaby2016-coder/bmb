interface FoodPlaceholderProps {
  alt?: string
  width?: number
  height?: number
  emoji?: string
  color?: string
}

const gradients: Record<string, string> = {
  'จานเดียว': 'linear-gradient(135deg, #ff9a56 0%, #fc6076 100%)',
  'แกง': 'linear-gradient(135deg, #8EC5FC 0%, #E0C3FC 100%)',
  'ข้าว': 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  'เครื่องดื่ม': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'ของหวาน': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'default': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
}

/**
 * FoodPlaceholder — Fallback visual for FoodMenuCard when no product photo exists.
 * Supports both gradient category display and studio image rendering.
 * @see docs/COMPONENT_SPEC_UI.md §2 Image Production Pipeline
 */
export function FoodPlaceholder({ alt = 'ภาพเมนู', width = 400, height = 300, emoji, color }: FoodPlaceholderProps) {
  const gradient = color || gradients['default']
  const fallbackEmoji = emoji ?? '🍽️'

  return (
    <div
      className="w-full h-full rounded-xl flex items-center justify-center text-6xl transition-transform duration-300 group-hover:-translate-y-4"
      style={{ background: gradient }}
      role="img"
      aria-label={alt}
    >
      {fallbackEmoji}
    </div>
  )
}

export function HeroPlaceholder() {
  return (
    <div
      className="w-full h-full rounded-2xl flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #5B5CEB 0%, #E0C3FC 100%)' }}
    >
      <div className="text-center text-white">
        <div className="text-6xl mb-2">🍽️</div>
        <p className="text-lg font-bold">Bite Me Baby</p>
      </div>
    </div>
  )
}
