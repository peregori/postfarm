import { useState, useEffect } from 'react'
import { FileText, Edit, Trash2, Calendar, Search } from 'lucide-react'
import { draftsApi } from '../api/client'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function Drafts() {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [draftToDelete, setDraftToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [originalDraft, setOriginalDraft] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadDrafts()
  }, [])

  useEffect(() => {
    if (selectedDraft) {
      setOriginalDraft({ ...selectedDraft })
    }
  }, [selectedDraft?.id]) // Only when draft ID changes

  // Auto-save drafts after user stops typing (debounced)
  useEffect(() => {
    if (!selectedDraft || !originalDraft) return

    // Only save if content has changed
    const hasChanges = 
      selectedDraft.content !== originalDraft.content ||
      selectedDraft.title !== originalDraft.title

    if (!hasChanges) return

    // Debounce: save 2 seconds after user stops typing
    const timeoutId = setTimeout(async () => {
      try {
        await draftsApi.update(selectedDraft.id, {
          content: selectedDraft.content,
          title: selectedDraft.title,
        })
        // Update original to reflect saved state
        setOriginalDraft({ ...selectedDraft })
      } catch (error) {
        console.error('Auto-save failed:', error)
        // Don't show toast for auto-save failures to avoid spam
      }
    }, 2000) // 2 seconds debounce

    return () => clearTimeout(timeoutId)
  }, [selectedDraft?.content, selectedDraft?.title, originalDraft])

  const loadDrafts = async () => {
    try {
      const data = await draftsApi.list()
      setDrafts(data)
    } catch (error) {
      console.error('Failed to load drafts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (id) => {
    setDraftToDelete(id)
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (!draftToDelete || deleting) return

    setDeleting(true)
    
    try {
      await draftsApi.delete(draftToDelete)
      
      // Update state immediately
      setDrafts(prevDrafts => prevDrafts.filter((d) => d.id !== draftToDelete))
      
      // Clear selection if deleted draft was selected
      if (selectedDraft?.id === draftToDelete) {
        setSelectedDraft(null)
        setOriginalDraft(null)
      }
      
      showToast.success('Draft Deleted', 'Draft deleted successfully.')
      
      // Close dialog immediately after success
      setShowDeleteDialog(false)
      setDraftToDelete(null)
      
      // Reload in background (don't wait for it)
      loadDrafts().catch(err => console.error('Failed to reload drafts:', err))
    } catch (error) {
      console.error('Failed to delete draft:', error)
      showToast.error('Delete Failed', error.response?.data?.detail || 'Failed to delete draft.')
      // Still close dialog on error so user can try again
      setShowDeleteDialog(false)
      setDraftToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!selectedDraft) return

    try {
      await draftsApi.update(selectedDraft.id, {
        content: selectedDraft.content,
        title: selectedDraft.title,
      })
      setOriginalDraft({ ...selectedDraft })
      showToast.success('Draft Saved', 'Changes saved successfully.')
      loadDrafts()
    } catch (error) {
      console.error('Failed to save draft:', error)
      showToast.error('Save Failed', error.response?.data?.detail || 'Failed to save draft.')
    }
  }

  const filteredDrafts = drafts.filter((draft) => {
    const query = searchQuery.toLowerCase()
    return (
      draft.content.toLowerCase().includes(query) ||
      (draft.title && draft.title.toLowerCase().includes(query))
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading drafts...</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Drafts List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg font-semibold">
              <FileText className="mr-2 h-5 w-5" />
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                className="pl-10"
                placeholder="Search drafts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Drafts List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredDrafts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchQuery ? 'No drafts found' : 'No drafts yet'}
                </p>
              ) : (
                filteredDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => setSelectedDraft({ ...draft })}
                    className={cn(
                      "p-4 rounded-lg cursor-pointer transition-colors border-border/80",
                      selectedDraft?.id === draft.id
                        ? 'bg-accent border-accent-foreground/50'
                        : 'bg-background hover:bg-accent/50 hover:border-border'
                    )}
                  >
                    <h3 className="text-sm font-semibold mb-1 truncate">
                      {draft.title || 'Untitled Draft'}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {draft.content}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(draft.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(draft.id)
                        }}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Draft Editor */}
      <div className="lg:col-span-2">
        {selectedDraft ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Edit Draft</CardTitle>
                <Button
                  onClick={() => navigate(`/schedule?draftId=${selectedDraft.id}`)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <Input
                    type="text"
                    value={selectedDraft.title || ''}
                    onChange={(e) =>
                      setSelectedDraft({ ...selectedDraft, title: e.target.value })
                    }
                    placeholder="Draft title (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Content</label>
                  <Textarea
                    rows={15}
                    value={selectedDraft.content}
                    onChange={(e) =>
                      setSelectedDraft({ ...selectedDraft, content: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSave}>
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDraft(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex items-center justify-center h-full min-h-[400px]">
            <CardContent className="text-center text-muted-foreground pt-6">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a draft to edit</p>
            </CardContent>
          </Card>
        )}
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
              onClick={() => {
                setShowDeleteDialog(false)
                setDraftToDelete(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
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
