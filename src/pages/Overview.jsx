import HealthScore from '../components/HealthScore'
import SensorReadings from '../components/SensorReadings'
import SystemStatus from '../components/SystemStatus'
import SensorTrends from '../components/SensorTrends'
import ActiveAlerts from '../components/ActiveAlerts'
import Connectivity from '../components/Connectivity'
import QuickInsights from '../components/QuickInsights'
import RecentActivity from '../components/RecentActivity'

export default function Overview({ d, go }) {
  const { reading, state, history, historyState, now } = d
  return (
    <div className="overview">
      <div className="orow r1">
        <HealthScore score={d.score} state={state} />
        <SensorReadings reading={reading} history={history} now={now} stale={state === 'stale'} />
        <SystemStatus reading={reading} state={state} />
      </div>
      <div className="orow r2">
        <SensorTrends history={history} historyState={historyState} now={now} />
        <ActiveAlerts alerts={d.alerts} state={state} since={d.lastUpdated} onViewAll={() => go('alerts')} />
      </div>
      <div className="orow r3">
        <Connectivity c={d.connectivity} />
        <QuickInsights reading={reading} alerts={d.alerts} state={state} />
        <RecentActivity activity={d.activity} lastUpdated={d.lastUpdated} onViewLogs={() => go('alerts')} />
      </div>
    </div>
  )
}
