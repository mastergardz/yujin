export default function YujinAvatar({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
      {/* Background circle */}
      <circle cx="16" cy="16" r="16" fill="#1a0a2e"/>
      <circle cx="16" cy="16" r="15.5" stroke="#a78bfa" strokeWidth="0.5"/>
      {/* Hair — long black */}
      <ellipse cx="16" cy="10" rx="8" ry="7" fill="#1a1a1a"/>
      <rect x="8" y="10" width="3" height="14" rx="1.5" fill="#1a1a1a"/>
      <rect x="21" y="10" width="3" height="14" rx="1.5" fill="#1a1a1a"/>
      {/* Face */}
      <ellipse cx="16" cy="14" rx="5.5" ry="6" fill="#f0c8a0"/>
      {/* Eyes */}
      <ellipse cx="13.5" cy="13.5" rx="1" ry="1.2" fill="#1a1a1a"/>
      <ellipse cx="18.5" cy="13.5" rx="1" ry="1.2" fill="#1a1a1a"/>
      {/* Eye shine */}
      <circle cx="14" cy="13" r="0.35" fill="white"/>
      <circle cx="19" cy="13" r="0.35" fill="white"/>
      {/* Mouth */}
      <path d="M14 17 Q16 18.5 18 17" stroke="#c07050" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
      {/* Collar */}
      <path d="M10 26 Q16 22 22 26" fill="#2a1f5a"/>
    </svg>
  )
}
