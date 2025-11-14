import { Link, useLocation } from 'react-router-dom'
import { 
  Settings, 
  Calendar,
  Inbox as InboxIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import ServerStatus from './ServerStatus'
import Logo from './Logo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Inbox', href: '/', icon: InboxIcon },
  { name: 'Schedule', href: '/schedule', icon: Calendar },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function AppSidebar() {
  const location = useLocation()
  const currentPath = location.pathname
  const { state, toggleSidebar } = useSidebar()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative group/header">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2">
              <div 
                className="relative flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground cursor-pointer shrink-0 group/icon"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleSidebar()
                }}
              >
                <Logo className={cn(
                  "size-4 transition-opacity",
                  state === "collapsed" && "group-hover/icon:opacity-0"
                )} size={16} />
                {state === "collapsed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute inset-0 size-8 rounded-lg opacity-0 group-hover/icon:opacity-100 transition-opacity",
                      "hover:bg-sidebar-accent"
                    )}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleSidebar()
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Toggle Sidebar</span>
                  </Button>
                )}
              </div>
              <SidebarMenuButton 
                size="lg" 
                asChild
                className="flex-1 pr-8"
              >
                <Link to="/">
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">PostFarm</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">Social Media Manager</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        {state === "expanded" && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0 absolute top-1/2 right-2 -translate-y-1/2",
              "hover:bg-sidebar-accent z-10 pointer-events-none group-hover/header:pointer-events-auto"
            )}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleSidebar()
            }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-1.5 pt-4">
          <SidebarGroupLabel className="px-3 mb-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = currentPath === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.name} 
                      isActive={isActive} 
                      className="px-3 [&>svg]:shrink-0 [&>span]:truncate"
                    >
                      <Link to={item.href} className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {state === "expanded" ? (
              <ServerStatus />
            ) : (
              <SidebarMenuButton size="lg" tooltip="AI Status">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                  <span className="text-xs">AI</span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

