import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Calendar, Send, Zap } from 'lucide-react'
import { draftsApi, schedulerApi, llmApi } from '../api/client'

export default function Dashboard() {
  const [stats, setStats] = useState({
    drafts: 0,
    scheduled: 0,
    posted: 0,
    llmHealth: false,
  })
  const [recentDrafts, setRecentDrafts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [drafts, calendar, health] = await Promise.all([
        draftsApi.list(),
        schedulerApi.calendar(),
        llmApi.health().catch(() => ({ status: 'unhealthy' })),
      ])

      const scheduled = Object.values(calendar.calendar || {}).flat().length

      setStats({
        drafts: drafts.length,
        scheduled,
        posted: 0, // Could fetch from posts API
        llmHealth: health.status === 'healthy',
      })

      setRecentDrafts(drafts.slice(0, 5))
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Drafts"
          value={stats.drafts}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Scheduled"
          value={stats.scheduled}
          icon={Calendar}
          color="green"
        />
        <StatCard
          title="Posted"
          value={stats.posted}
          icon={Send}
          color="purple"
        />
        <StatCard
          title="LLM Status"
          value={stats.llmHealth ? 'Online' : 'Offline'}
          icon={Zap}
          color={stats.llmHealth ? 'green' : 'red'}
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/generate" className="btn btn-primary">
            Generate New Content
          </Link>
          <Link to="/drafts" className="btn btn-outline">
            View All Drafts
          </Link>
          <Link to="/schedule" className="btn btn-outline">
            Schedule Posts
          </Link>
        </div>
      </div>

      {/* Recent Drafts */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Drafts</h3>
          <Link to="/drafts" className="text-sm font-medium text-primary hover:text-primary/80">
            View all
          </Link>
        </div>
        {recentDrafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drafts yet. Create your first one!</p>
        ) : (
          <div className="space-y-3">
            {recentDrafts.map((draft) => (
              <Link
                key={draft.id}
                to={`/drafts/${draft.id}`}
                className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-1">
                      {draft.title || 'Untitled Draft'}
                    </h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {draft.content}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-4">
                    {new Date(draft.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

