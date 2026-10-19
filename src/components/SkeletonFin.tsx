interface Props {
  lines?: number
  height?: number
}

export default function Skeleton({ lines = 3, height = 12 }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line rounded-[4px]"
          style={{
            height,
            width: i === lines - 1 ? '60%' : '100%',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-card p-6">
      <div className="skeleton-line rounded-[4px]" style={{ width: '40%', height: 14, marginBottom: 16 }} />
      <Skeleton lines={4} height={10} />
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="bg-card p-6">
      <div className="skeleton-line rounded-[4px]" style={{ width: '20%', height: 10, marginBottom: 12 }} />
      <div className="skeleton-line rounded-[4px]" style={{ width: '50%', height: 42, marginBottom: 12 }} />
      <div className="skeleton-line rounded-[4px]" style={{ width: '70%', height: 14 }} />
    </div>
  )
}
