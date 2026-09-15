interface AiAvatarProps {
  state?: 'talking' | 'thinking' | 'happy' | 'neutral'
  size?: 'sm' | 'md' | 'lg'
}

export function AiAvatar({ state = 'neutral', size = 'md' }: AiAvatarProps) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20'
  }

  const animations = {
    talking: 'animate-bounce',
    thinking: 'animate-pulse',
    happy: 'animate-bounce',
    neutral: ''
  }

  const expressions = {
    talking: '🗣️',
    thinking: '🤔',
    happy: '😊',
    neutral: '🙂'
  }

  return (
    <div className={`${sizeClasses[size]} ${animations[state]} rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-2xl shadow-lg`}>
      <span>{expressions[state]}</span>
    </div>
  )
}