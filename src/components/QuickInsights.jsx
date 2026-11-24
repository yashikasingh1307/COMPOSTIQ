import { Lightbulb } from 'lucide-react'
import GlassCard from './GlassCard'
import { LeafBranch } from './Botanical'
import { insights } from '../lib/rules'

export default function QuickInsights({ reading, alerts, state }) {
  const i = insights(reading, alerts, state)
  return (
    <GlassCard className="insights" title="Quick Insights" icon={Lightbulb}>
      <div className="insight-body"><LeafBranch className="insight-leaf" /><div><b>{i.title}</b><em>{i.hint}</em></div></div>
    </GlassCard>
  )
}
