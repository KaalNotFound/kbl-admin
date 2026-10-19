import Overview from './components/Overview'
import Integrations from './components/Integrations'
import InventoryDashboard from './components/InventoryDashboard'
import QueueDashboard from './components/QueueDashboard'
import ProjectsDashboard from './components/ProjectsDashboard'
import EntityTypesDashboard from './components/EntityTypesDashboard'
import SystemLogs from './components/SystemLogs'
import QuickCapture from './components/QuickCapture'
import BraveTabs from './components/BraveTabs'
import WhatsAppFeed from './components/WhatsAppFeed'
import SessionContext from './components/SessionContext'
import StudyDashboard from './components/StudyDashboard'
import AlgorithmsDashboard from './components/AlgorithmsDashboard'
import BehavioralDashboard from './components/BehavioralDashboard'
import MarketDashboard from './components/MarketDashboard'
import FinanzasWrapper from './components/FinanzasWrapper'
import TodosDashboard from './components/TodosDashboard'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import PageHeader from './components/layout/PageHeader'
import { useAppStore } from './stores/app-store'

export default function App() {
  const tab = useAppStore((s) => s.tab)

  return (
    <div className="flex min-h-screen bg-page text-text-primary">
      <Sidebar />

      <main className="flex-1 ml-[240px] max-lg:ml-14">
        <TopBar />

        <div className="px-8 py-6 pb-16 max-lg:px-4 max-lg:py-4">
          <PageHeader />

          <div className="animate-fade-in">
            {tab === 'overview' && <Overview />}
            {tab === 'todos' && <TodosDashboard />}
            {tab === 'integrations' && <Integrations />}
            {tab === 'inventory' && <InventoryDashboard />}
            {tab === 'queue' && <QueueDashboard />}
            {tab === 'projects' && <ProjectsDashboard />}
            {tab === 'entities' && <EntityTypesDashboard />}
            {tab === 'logs' && <SystemLogs />}
            {tab === 'brave' && <BraveTabs />}
            {tab === 'whatsapp' && <WhatsAppFeed />}
            {tab === 'context' && <SessionContext />}
            {tab === 'study' && <StudyDashboard />}
            {tab === 'algorithms' && <AlgorithmsDashboard />}
            {tab === 'behavioral' && <BehavioralDashboard />}
            {tab === 'market' && <MarketDashboard />}
            {tab === 'finanzas' && <FinanzasWrapper />}
          </div>
        </div>
      </main>

      <QuickCapture />
    </div>
  )
}
