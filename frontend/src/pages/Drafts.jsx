import { useState, useEffect } from 'react'
import { FileText, Edit, Trash2, Calendar, Search } from 'lucide-react'
import { draftsApi } from '../api/client'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function Drafts() {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDraft, setSelectedDraft] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadDrafts()
  }, [])

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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this draft?')) return

    try {
      await draftsApi.delete(id)
      setDrafts(drafts.filter((d) => d.id !== id))
      if (selectedDraft?.id === id) {
        setSelectedDraft(null)
      }
    } catch (error) {
      console.error('Failed to delete draft:', error)
      alert('Failed to delete draft.')
    }
  }

  const handleSave = async () => {
    if (!selectedDraft) return

    try {
      await draftsApi.update(selectedDraft.id, {
        content: selectedDraft.content,
        title: selectedDraft.title,
      })
      alert('Draft saved!')
      loadDrafts()
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('Failed to save draft.')
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
            <CardTitle className="flex items-center">
              <FileText className="mr-2" size={20} />
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
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
                      "p-4 rounded-lg cursor-pointer transition-colors border",
                      selectedDraft?.id === draft.id
                        ? 'bg-accent border-accent-foreground/20'
                        : 'bg-background hover:bg-accent/50'
                    )}
                  >
                    <h3 className="font-medium mb-1 truncate">
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
                          handleDelete(draft.id)
                        }}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 size={14} />
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
                <CardTitle>Edit Draft</CardTitle>
                <Button
                  onClick={() => navigate(`/schedule?draftId=${selectedDraft.id}`)}
                >
                  <Calendar className="mr-2" size={18} />
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
              <FileText size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a draft to edit</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
