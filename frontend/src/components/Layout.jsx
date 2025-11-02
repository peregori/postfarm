import { Link, useLocation } from 'react-router-dom'
import { 
  Settings, 
  Calendar,
  Inbox as InboxIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ServerStatus from './ServerStatus'

const navigation = [
  { name: 'Inbox', href: '/', icon: InboxIcon },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Layout({ children }) {
  const location = useLocation()
  const currentPath = location.pathname

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 w-full border-b bg-background">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <h1 className="text-xl font-bold">HandPost</h1>
            <nav className="flex items-center gap-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = currentPath === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors gap-2",
                      isActive
                        ? "bg-secondary text-secondary-foreground"
                        : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{item.name}</span>
                  </Link>
                )
              })}
              <ServerStatus />
            </nav>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
