import { useState, useEffect } from 'react'
import { 
  FileText, 
  Clock, 
  Search,
  Plus,
  Send,
  X,
  Twitter,
  Linkedin
} from 'lucide-react'
import { draftsApi, platformsApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { getPreviewText } from '@/lib/contentCleaner'

export default function Inbox() {
  const [drafts, setDrafts] = useState([])
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sortBy, setSortBy] = useState('newest') // 'newest', 'oldest', 'alphabetical'
  const [showPostNowDialog, setShowPostNowDialog] = useState(false)
  const [postingPlatform, setPostingPlatform] = useState('twitter')
  const [posting, setPosting] = useState(false)

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

  const handleDiscard = () => {
    // For new drafts, just clear selection
    if (!selectedDraft?.id) {
      setSelectedDraft(null)
      return
    }
    // For existing drafts, show delete dialog
    setShowDeleteDialog(true)
  }

  const handlePostNow = async () => {
    if (!selectedDraft?.content?.trim()) {
      showToast.warning('Content Required', 'Please add content before posting.')
      return
    }

    setPosting(true)
    try {
      await platformsApi.publish(postingPlatform, selectedDraft.content)
      showToast.success('Posted', `Post published to ${postingPlatform === 'twitter' ? 'Twitter/X' : 'LinkedIn'} successfully!`)
      setShowPostNowDialog(false)
      // Optionally clear the draft after posting, or keep it for reference
      // setSelectedDraft(null)
    } catch (error) {
      console.error('Failed to post:', error)
      showToast.error('Post Failed', error.response?.data?.detail || 'Failed to post.')
    } finally {
      setPosting(false)
    }
  }

  const filteredDrafts = drafts.filter((draft) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = draft.content?.toLowerCase().includes(query)
    
    return matchesSearch
  }).sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at)
    } else if (sortBy === 'alphabetical') {
      return (a.content || '').localeCompare(b.content || '')
    } else {
      // 'newest' - default
      return new Date(b.created_at) - new Date(a.created_at)
    }
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
        <div className="flex h-16 items-center gap-4 px-6">
          {/* Left: Draft Count */}
          <div className="flex items-center shrink-0">
            <Badge variant="secondary" className="h-7 px-2.5 text-xs font-medium">
              {filteredDrafts.length}
            </Badge>
          </div>

          {/* Left: Sort */}
          <div className="flex items-center shrink-0">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Search draft contents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 text-base"
              />
            </div>
          </div>

          {/* Right: New Draft Button */}
          <div className="flex items-center shrink-0">
            <Button
              onClick={handleCreateNew}
              className="h-9"
              variant="default"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Draft
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Drafts Sidebar */}
        <div className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading...
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground opacity-50 mx-auto" />
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
                      <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
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
              onDiscard={handleDiscard}
              onPostNow={() => setShowPostNowDialog(true)}
              autoSave={true}
              showActions={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-md">
                <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-30" />
                <p className="text-base font-semibold text-muted-foreground mb-2">
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
            <DialogTitle>Discard Draft</DialogTitle>
            <DialogDescription>
              Are you sure you want to discard this draft? This action cannot be undone.
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
              {deleting ? 'Discarding...' : 'Discard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Now Dialog */}
      <Dialog open={showPostNowDialog} onOpenChange={setShowPostNowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Now</DialogTitle>
            <DialogDescription>
              Choose a platform to publish your draft immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Platform</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setPostingPlatform('twitter')}
                  className={cn(
                    "flex-1 flex items-center justify-center p-4 rounded-lg border transition-colors",
                    postingPlatform === 'twitter'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-accent'
                  )}
                >
                  <Twitter className="mr-2 h-5 w-5" />
                  Twitter / X
                </button>
                <button
                  onClick={() => setPostingPlatform('linkedin')}
                  className={cn(
                    "flex-1 flex items-center justify-center p-4 rounded-lg border transition-colors",
                    postingPlatform === 'linkedin'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-accent'
                  )}
                >
                  <Linkedin className="mr-2 h-5 w-5" />
                  LinkedIn
                </button>
              </div>
            </div>
            {selectedDraft && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-medium mb-2">Content Preview</div>
                <div className="text-sm whitespace-pre-wrap text-foreground/90 max-h-48 overflow-y-auto">
                  {selectedDraft.content || <span className="text-muted-foreground italic">No content</span>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPostNowDialog(false)}
              disabled={posting}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePostNow}
              disabled={posting || !selectedDraft?.content?.trim()}
            >
              {posting ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin shrink-0" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4 shrink-0" />
                  Post Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
