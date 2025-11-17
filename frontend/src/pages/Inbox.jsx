import { useState, useEffect } from 'react'
import { 
  FileText, 
  Clock, 
  Search,
  Plus,
  Send,
  X,
  Twitter,
  Linkedin,
  Sparkles,
  Edit
} from 'lucide-react'
import { draftsApi, platformsApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import * as simpleIcons from 'simple-icons'

// Helper function to extract platform from tags
const getPlatformFromTags = (tags) => {
  if (!tags || !Array.isArray(tags)) return null
  const platformTag = tags.find(tag => tag.startsWith('platform:'))
  if (platformTag) {
    return platformTag.replace('platform:', '')
  }
  return null
}

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
        // Generate title if draft doesn't have one and content is sufficient
        let titleToSave = selectedDraft.title
        if (!titleToSave && content && content.trim().length > 10) {
          try {
            const titleResponse = await llmApi.generateTitle(content)
            titleToSave = titleResponse.title
          } catch (error) {
            console.error('Title generation failed:', error)
            // Use fallback
            titleToSave = content.substring(0, 50)
            if (content.length > 50) titleToSave += '...'
          }
        }
        
        const updated = await draftsApi.update(selectedDraft.id, { 
          content,
          title: titleToSave 
        })
        setDrafts(drafts.map(d => d.id === updated.id ? updated : d))
        setSelectedDraft(updated)
      } else {
        // Create new draft with auto-generated title
        let titleToSave = null
        if (content && content.trim().length > 10) {
          try {
            const titleResponse = await llmApi.generateTitle(content)
            titleToSave = titleResponse.title
          } catch (error) {
            console.error('Title generation failed:', error)
            // Use fallback
            titleToSave = content.substring(0, 50)
            if (content.length > 50) titleToSave += '...'
          }
        }
        
        const created = await draftsApi.create({ 
          content,
          title: titleToSave 
        })
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

  const handleConfirm = async ({ content, platform }) => {
    if (!selectedDraft?.id) {
      showToast.warning('Draft Required', 'Please save the draft first.')
      return
    }

    try {
      // Get current tags and add "confirmed" if not already present
      const currentTags = selectedDraft.tags || []
      const hasConfirmedTag = currentTags.includes('confirmed')
      
      // Remove any existing platform tags and add the new one
      const updatedTags = currentTags.filter(tag => !tag.startsWith('platform:'))
      if (platform) {
        updatedTags.push(`platform:${platform}`)
      }
      
      if (!hasConfirmedTag) {
        updatedTags.push('confirmed')
        const updated = await draftsApi.update(selectedDraft.id, { 
          content,
          tags: updatedTags 
        })
        
        // Remove confirmed draft from inbox list
        setDrafts(drafts.filter(d => d.id !== updated.id))
        setSelectedDraft(null)
        showToast.success('Confirmed', 'Ready for scheduling')
      } else {
        // Just update content and tags if already confirmed
        const updated = await draftsApi.update(selectedDraft.id, { content, tags: updatedTags })
        setDrafts(drafts.filter(d => d.id !== updated.id))
        setSelectedDraft(null)
      }
    } catch (error) {
      console.error('Confirm failed:', error)
      showToast.error('Failed', 'Could not confirm draft')
    }
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

  const filteredDrafts = drafts
    .filter((draft) => {
      // Exclude confirmed drafts from inbox
      const tags = draft.tags || []
      const isConfirmed = tags.includes('confirmed')
      if (isConfirmed) return false
      
      // Filter by search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return draft.content?.toLowerCase().includes(query)
      }
      
      return true
    })
    .sort((a, b) => {
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-6">
          {/* Left: Title and Draft Count */}
          <div className="flex items-center gap-3 shrink-0">
            <h2 className="text-lg font-semibold">Inbox</h2>
            <Badge variant="secondary" className="h-6 px-2 text-xs font-medium">
              {filteredDrafts.length}
            </Badge>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 flex justify-center max-w-xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="Search drafts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-muted/50 border-muted focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Right: New Draft Button */}
          <div className="flex items-center shrink-0">
            <Button
              onClick={handleCreateNew}
              className="h-9 px-3 gap-2 bg-green-700 hover:bg-green-800 text-white"
              variant="default"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Draft</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden h-full">
        {/* Drafts Sidebar */}
        <div className="w-64 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            {/* Sort Filter */}
            <div className="mb-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full h-8 text-xs border-muted/50 bg-background hover:bg-muted/20 focus:bg-background focus:ring-0 focus:ring-offset-0 focus:outline-none focus:border-muted/50 transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-sm">Loading...</div>
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="mb-4 p-3 rounded-full bg-muted/50">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-1">
                  {searchQuery ? 'No drafts found' : 'No drafts yet'}
                </h3>
                {!searchQuery && (
                  <>
                    <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                      Get started by creating your first draft
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateNew}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create Draft
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDrafts.map((draft) => {
                  const isActive = selectedDraft?.id === draft.id
                  const preview = getPreviewText(draft.content || '')
                  const timeAgo = formatDate(draft.created_at)
                  const hasPrompt = draft.prompt && draft.prompt.trim().length > 0
                  const draftPlatform = getPlatformFromTags(draft.tags)
                  
                  return (
                    <Card
                      key={draft.id}
                      onClick={() => setSelectedDraft(draft)}
                      className={cn(
                        "group cursor-pointer transition-all border-border/80 hover:border-border hover:shadow-sm",
                        isActive && "border-primary/80 shadow-sm bg-accent/50"
                      )}
                    >
                      <CardContent className="p-3">
                        {/* Header with timestamp and AI indicator */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {hasPrompt && (
                              <Badge variant="secondary" className="h-3.5 px-1 text-[8px] gap-0.5 opacity-60">
                                <Sparkles className="h-2 w-2" />
                              </Badge>
                            )}
                            {draftPlatform && (
                              <div className="flex items-center">
                                {draftPlatform === 'twitter' ? (
                                  <svg
                                    role="img"
                                    viewBox="0 0 24 24"
                                    className="h-2.5 w-2.5 shrink-0"
                                    fill="currentColor"
                                    style={{ color: '#000000' }}
                                    preserveAspectRatio="xMidYMid meet"
                                  >
                                    <path d={simpleIcons.siX.path} />
                                  </svg>
                                ) : draftPlatform === 'linkedin' ? (
                                  <svg
                                    role="img"
                                    viewBox="0 0 24 24"
                                    className="h-3 w-3 shrink-0"
                                    fill="currentColor"
                                    style={{ color: '#0A66C2' }}
                                    preserveAspectRatio="xMidYMid meet"
                                  >
                                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                  </svg>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {timeAgo}
                          </span>
                        </div>
                        
                        {/* Preview content (cleaned, matching preview pane) - single line */}
                        <p className={cn(
                          "text-xs leading-snug line-clamp-1 font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground",
                          "group-hover:text-foreground transition-colors"
                        )}>
                          {preview || <span className="italic opacity-50">No content</span>}
                        </p>
                      </CardContent>
                    </Card>
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
              onConfirm={handleConfirm}
              autoSave={true}
              showActions={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted/20">
              <div className="text-center max-w-md px-6">
                <div className="mb-6 p-3 rounded-full bg-muted/50 border border-border/50 w-fit mx-auto">
                  <Edit className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  Your Editing Workspace
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a draft from the sidebar to start editing.
                </p>
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
              variant="default" 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-700 hover:bg-red-800 text-white"
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
