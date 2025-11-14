import Sidebar from './Sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export default function Layout({ children }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
