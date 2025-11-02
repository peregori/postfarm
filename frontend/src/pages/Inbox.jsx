import { useState, useEffect } from 'react'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Search,
  Plus,
  Filter
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { draftsApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import DraftEditor from '@/components/DraftEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getPreviewText } from '@/lib/contentCleaner'

const INBOX_TABS = [
  { id: 'drafts', label: 'Drafts', icon: FileText },
]

export default function Inbox() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('drafts')
  const [drafts, setDrafts] = useState([])
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [platformFilter, setPlatformFilter] = useState('all')

  useEffect(() => {
    loadDrafts()
    const interval = setInterval(loadDrafts, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedDraft) {
      // Find the full draft data
      const fullDraft = drafts.find(d => d.id === selectedDraft.id)
      if (fullDraft) {
        setSelectedDraft(fullDraft)
      }
    }
  }, [drafts, selectedDraft?.id])

  const loadDrafts = async () => {
    try {
      const data = await draftsApi.list()
      setDrafts(data)
      
      // Update selected draft if it exists
      if (selectedDraft) {
        const updated = data.find(d => d.id === selectedDraft.id)
        if (updated) {
          setSelectedDraft(updated)
        }
      }
    } catch (error) {
      console.error('Failed to load drafts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    const newDraft = {
      id: null,
      content: '',
      created_at: new Date().toISOString(),
    }
    setSelectedDraft(newDraft)
  }

  const handleSave = async ({ content }) => {
    try {
      if (selectedDraft?.id) {
        // Update existing draft
        const updated = await draftsApi.update(selectedDraft.id, { content })
        setDrafts(drafts.map(d => d.id === updated.id ? updated : d))
        setSelectedDraft(updated)
      } else {
        // Create new draft
        const created = await draftsApi.create({ content })
        setDrafts([created, ...drafts])
        setSelectedDraft(created)
      }
      return true
    } catch (error) {
      console.error('Save failed:', error)
      throw error
    }
  }

  const handleDelete = async () => {
    if (!selectedDraft?.id || deleting) {
      if (!selectedDraft?.id) {
        // New draft, just clear selection
        setSelectedDraft(null)
        setShowDeleteDialog(false)
      }
      return
    }

    setDeleting(true)

    try {
      await draftsApi.delete(selectedDraft.id)
      setDrafts(drafts.filter(d => d.id !== selectedDraft.id))
      setSelectedDraft(null)
      showToast.success('Draft Deleted', 'Draft deleted successfully.')
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Delete failed:', error)
      showToast.error('Delete Failed', 'Failed to delete draft.')
      // Still close dialog on error
      setShowDeleteDialog(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSchedule = async ({ content, draftId }) => {
    navigate(`/schedule?draftId=${draftId || selectedDraft?.id}`)
  }

  const filteredDrafts = drafts.filter((draft) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = draft.content?.toLowerCase().includes(query)
    
    return matchesSearch
  }).sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at)
  })

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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex h-16 items-center justify-between px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between w-full gap-4">
              <TabsList className="grid w-fit grid-cols-1">
                {INBOX_TABS.map((tab) => {
                  const Icon = tab.icon
                  const count = filteredDrafts.length
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
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search drafts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Drafts Sidebar */}
        <div className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            <Button
              onClick={handleCreateNew}
              className="w-full mb-4"
              variant="default"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Draft
            </Button>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading...
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No drafts found' : 'No drafts yet'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleCreateNew}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Draft
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDrafts.map((draft) => {
                  const isActive = selectedDraft?.id === draft.id
                  const preview = getPreviewText(draft.content || '')
                  
                  return (
                    <div
                      key={draft.id}
                      onClick={() => setSelectedDraft(draft)}
                      className={cn(
                        "rounded-lg border p-3 transition-colors cursor-pointer",
                        isActive
                          ? "bg-accent border-accent-foreground/20"
                          : "bg-background border-border hover:bg-accent/50"
                      )}
                    >
                      <p className="text-xs text-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                        {preview || 'No content'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {selectedDraft ? (
            <DraftEditor
              draft={selectedDraft}
              onSave={handleSave}
              onDelete={() => setShowDeleteDialog(true)}
              onSchedule={handleSchedule}
              autoSave={true}
              showActions={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-md">
                <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-30" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  No draft selected
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a draft from the sidebar or create a new one to get started.
                </p>
                <Button onClick={handleCreateNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Draft
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Draft</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this draft? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
