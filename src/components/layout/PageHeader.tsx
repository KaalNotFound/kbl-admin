import { useAppStore } from '../../stores/app-store'
import { pageMeta } from './page-meta'

export default function PageHeader() {
  const { tab } = useAppStore()
  const meta = pageMeta[tab]

  return (
    <div className="mb-8 max-lg:mb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{meta.title}</h1>
      <p className="text-sm text-text-secondary mt-1">{meta.desc}</p>
    </div>
  )
}
