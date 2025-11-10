import { Link, useLocation } from 'react-router-dom'
import { 
  Settings, 
  Calendar,
  Inbox as InboxIcon,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ServerStatus from './ServerStatus'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Inbox', href: '/', icon: InboxIcon },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar({ onNavigate }) {
  const location = useLocation()
  const currentPath = location.pathname
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-background border-r transition-all duration-300 shadow-lg md:shadow-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo/Branding */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-lg font-semibold truncate">PostFarm</h1>
          </div>
        )}
        {collapsed && (
          <Sparkles className="h-5 w-5 text-primary mx-auto" />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0 hidden md:flex"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = currentPath === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => onNavigate && onNavigate()}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* AI Status Section */}
      <div className="p-3">
        {!collapsed ? (
          <ServerStatus />
        ) : (
          <div className="flex justify-center">
            <ServerStatus />
          </div>
        )}
      </div>
    </aside>
  )
}

