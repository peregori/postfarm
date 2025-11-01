import { useState, useEffect } from 'react'
import { 
  FileText, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Search,
  Edit2,
  Trash2,
  Send,
  X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { draftsApi, schedulerApi, postsApi, llmApi } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const INBOX_TABS = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'scheduled', label: 'Scheduled', icon: Clock },
  { id: 'posted', label: 'Posted', icon: CheckCircle },
]

export default function Inbox() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [drafts, setDrafts] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [posted, setPosted] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => {
    loadAllData()
    const interval = setInterval(loadAllData, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedItem) {
      setEditContent(selectedItem.content || '')
      setEditTitle(selectedItem.title || '')
      setEditing(false)
    }
  }, [selectedItem])

  const loadAllData = async () => {
    try {
      const [draftsData, scheduledData, postedData] = await Promise.all([
        draftsApi.list().catch(() => []),
        schedulerApi.calendar().catch(() => ({ calendar: {} })),
        postsApi.list({ status: 'posted' }).catch(() => []),
      ])
      
      setDrafts(draftsData)
      const scheduledPosts = Object.values(scheduledData.calendar || {}).flat()
      setScheduled(scheduledPosts)
      setPosted(postedData)

      // Update selected item if it still exists
      if (selectedItem) {
        const item = [...draftsData, ...scheduledPosts, ...postedData].find(
          i => i.id === selectedItem.id && i.type === selectedItem.type
        )
        if (item) {
          setSelectedItem({ ...item, type: selectedItem.type })
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getItems = () => {
    let items = []
    
    if (activeTab === 'all' || activeTab === 'drafts') {
      items = items.concat(drafts.map(d => ({ ...d, type: 'draft' })))
    }
    
    if (activeTab === 'all' || activeTab === 'scheduled') {
      items = items.concat(scheduled.map(s => ({ ...s, type: 'scheduled' })))
    }
    
    if (activeTab === 'all' || activeTab === 'posted') {
      items = items.concat(posted.map(p => ({ ...p, type: 'posted' })))
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item => 
        item.content?.toLowerCase().includes(query) ||
        item.title?.toLowerCase().includes(query)
      )
    }
    
    return items.sort((a, b) => {
      const dateA = new Date(a.created_at || a.scheduled_time || 0)
      const dateB = new Date(b.created_at || b.scheduled_time || 0)
      return dateB - dateA
    })
  }

  const items = getItems()

  const getStatusBadge = (item) => {
    if (item.type === 'posted') {
      return <Badge variant="default">Posted</Badge>
    }
    if (item.type === 'scheduled') {
      return <Badge variant="secondary">Scheduled</Badge>
    }
    return <Badge variant="outline">Draft</Badge>
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString()
    } catch {
      return ''
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedItem || selectedItem.type !== 'draft') return

    try {
      await draftsApi.update(selectedItem.id, {
        content: editContent,
        title: editTitle,
      })
      setEditing(false)
      loadAllData()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save changes')
    }
  }

  const handleSchedule = () => {
    if (!selectedItem || selectedItem.type !== 'draft') return
    navigate(`/schedule?draftId=${selectedItem.id}`)
  }

  const handleDelete = async () => {
    if (!selectedItem || !confirm('Are you sure you want to delete this item?')) return

    try {
      if (selectedItem.type === 'draft') {
        await draftsApi.delete(selectedItem.id)
      }
      // TODO: Handle scheduled/posted deletion
      setSelectedItem(null)
      loadAllData()
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete item')
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header with Tabs and Search */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex h-16 items-center justify-between px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between w-full">
              <TabsList className="grid w-fit grid-cols-4">
                {INBOX_TABS.map((tab) => {
                  const Icon = tab.icon
                  const count = tab.id === 'all' ? items.length :
                               tab.id === 'drafts' ? drafts.length :
                               tab.id === 'scheduled' ? scheduled.length :
                               posted.length
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                      <Icon size={14} />
                      {tab.label}
                      {count > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Inbox List - Left Sidebar */}
        <div className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No items found</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "group relative rounded-lg border p-4 cursor-pointer transition-colors",
                    selectedItem?.id === item.id && selectedItem?.type === item.type
                      ? "bg-accent border-accent-foreground/20"
                      : "bg-background border-border hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate mb-1">
                        {item.title || 'Untitled'}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.content || 'No content'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item)}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.created_at || item.scheduled_time)}
                      </span>
                    </div>
                    {item.type === 'scheduled' && item.platform && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.platform}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail View - Right Panel */}
        <div className="flex-1 overflow-y-auto bg-background">
          {selectedItem ? (
            <div className="mx-auto max-w-3xl p-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {editing ? (
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="mb-3 font-semibold text-xl"
                          placeholder="Title"
                        />
                      ) : (
                        <CardTitle className="mb-3">
                          {selectedItem.title || 'Untitled'}
                        </CardTitle>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        {getStatusBadge(selectedItem)}
                        <span className="text-sm text-muted-foreground">
                          {new Date(selectedItem.created_at || selectedItem.scheduled_time).toLocaleString()}
                        </span>
                        {selectedItem.platform && (
                          <>
                            <Separator orientation="vertical" className="h-4" />
                            <span className="text-sm text-muted-foreground capitalize">
                              {selectedItem.platform}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedItem.type === 'draft' && (
                        <>
                          {editing ? (
                            <>
                              <Button variant="default" size="sm" onClick={handleSaveEdit}>
                                Save
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button variant="default" size="sm" onClick={handleSchedule}>
                                <Send className="mr-2 h-4 w-4" />
                                Schedule
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  {editing ? (
                    <Textarea
                      rows={15}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-foreground">
                      {selectedItem.content || 'No content'}
                    </div>
                  )}
                  
                  {selectedItem.prompt && (
                    <div className="mt-6 rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Original Prompt
                      </p>
                      <p className="text-sm text-foreground">{selectedItem.prompt}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-30" />
                <p className="text-lg font-medium text-muted-foreground">
                  Select an item to view details
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Generate content or select an existing item to review
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
