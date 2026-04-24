export default function YujinAvatar({ size = 32 }) {
  return (
    <img
      src="/yujin.png"
      alt="Yujin"
      style={{
        width: size, height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        objectPosition: 'top',
        flexShrink: 0,
        border: '1.5px solid #e5e5ea',
      }}
    />
  )
}
