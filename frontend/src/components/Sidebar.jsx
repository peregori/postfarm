import { Link, useLocation } from 'react-router-dom'
import { 
  Settings, 
  Calendar,
  Inbox as InboxIcon,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
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
    <Sidebar collapsible="icon" className="relative group/sidebar">
      <SidebarHeader className="relative group/header h-16 flex items-start p-0 px-2 pt-4">
        <SidebarMenu className="w-full">
          <SidebarMenuItem>
            <div className="flex items-center gap-3 w-full h-full">
              <div 
                className="relative flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground cursor-pointer shrink-0 group/icon ml-2"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleSidebar()
                }}
              >
                {/* Logo - visible by default when collapsed, hidden on hover */}
                <Logo className={cn(
                  "size-4 transition-opacity",
                  state === "collapsed" && "group-hover/icon:opacity-0"
                )} size={16} />
                {/* Sidebar icon - hidden by default when collapsed, visible on hover */}
                {state === "collapsed" && (
                  <PanelLeft className={cn(
                    "h-4 w-4 absolute inset-0 m-auto opacity-0 group-hover/icon:opacity-100 transition-opacity text-sidebar-primary-foreground"
                  )} />
                )}
              </div>
              {state === "expanded" && (
                <h2 className="text-lg font-semibold truncate flex-1 leading-none">
                  PostFarm
                </h2>
              )}
              {/* Right edge indicator when expanded - inside sidebar, always visible */}
              {state === "expanded" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 shrink-0",
                    "hover:bg-sidebar-accent"
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleSidebar()
                  }}
                >
                  <PanelLeft className="h-4 w-4" />
                  <span className="sr-only">Close Sidebar</span>
                </Button>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
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

