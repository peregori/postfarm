import { useState } from 'react'
import Sidebar from './Sidebar'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={cn(
        "md:relative fixed inset-y-0 left-0 z-40 transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col md:ml-0">
        {children}
      </main>
    </div>
  )
}
