import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Clock, Send, Twitter, Linkedin, CheckCircle, X } from 'lucide-react'
import { draftsApi, schedulerApi, platformsApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import CalendarView from '@/components/Calendar'
import { getPreviewText } from '@/lib/contentCleaner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format } from 'date-fns'

export default function Schedule() {
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draftId')
  const contentParam = searchParams.get('content')
  const titleParam = searchParams.get('title')

  const [drafts, setDrafts] = useState([])
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [scheduled, setScheduled] = useState([])
  const [platform, setPlatform] = useState('twitter')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDrafts()
    loadScheduled()
    
    // Handle URL parameters for direct scheduling
    if (draftId || contentParam) {
      if (draftId) {
        loadDraft(draftId)
      } else if (contentParam) {
        setSelectedDraft({
          id: null,
          title: titleParam || '',
          content: decodeURIComponent(contentParam),
        })
      }
      setShowScheduleDialog(true)
    }
  }, [draftId, contentParam, titleParam])

  const loadDrafts = async () => {
    try {
      const data = await draftsApi.list()
      setDrafts(data)
    } catch (error) {
      console.error('Failed to load drafts:', error)
    }
  }

  const loadDraft = async (id) => {
    try {
      const draft = await draftsApi.get(parseInt(id))
      setSelectedDraft(draft)
    } catch (error) {
      console.error('Failed to load draft:', error)
    }
  }

  const loadScheduled = async () => {
    try {
      const data = await schedulerApi.calendar()
      const scheduledPosts = Object.values(data.calendar || {}).flat()
      setScheduled(scheduledPosts)
    } catch (error) {
      console.error('Failed to load scheduled:', error)
    }
  }

  const handleSchedule = async () => {
    if (!selectedDraft?.content?.trim() || !scheduledDate || !scheduledTime) {
      showToast.warning('Required Fields', 'Please fill in all required fields.')
      return
    }

    const scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`

    setLoading(true)
    try {
      await schedulerApi.schedule({
        draft_id: selectedDraft?.id || null,
        platform,
        content: selectedDraft.content,
        scheduled_time: scheduledDateTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      
      showToast.success('Post Scheduled', 'Post scheduled successfully!')
      setShowScheduleDialog(false)
      setSelectedDraft(null)
      setScheduledDate('')
      setScheduledTime('')
      loadScheduled()
      loadDrafts()
    } catch (error) {
      console.error('Failed to schedule post:', error)
      showToast.error('Schedule Failed', error.response?.data?.detail || 'Failed to schedule post.')
    } finally {
      setLoading(false)
    }
  }

  const handlePostNow = async () => {
    if (!selectedDraft?.content?.trim()) {
      showToast.warning('Content Required', 'Please select a draft with content.')
      return
    }

    setLoading(true)
    try {
      await platformsApi.publish(platform, selectedDraft.content)
      showToast.success('Posted', `Post published to ${platform} successfully!`)
      setSelectedDraft(null)
      loadScheduled()
      loadDrafts()
    } catch (error) {
      console.error('Failed to post:', error)
      showToast.error('Post Failed', error.response?.data?.detail || 'Failed to post.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDraft = (draft) => {
    setSelectedDraft(draft)
    setShowScheduleDialog(true)
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

  const today = new Date().toISOString().split('T')[0]
  const preview = selectedDraft ? getPreviewText(selectedDraft.content || '') : ''

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
      {/* Drafts Sidebar */}
      <div className="w-80 border-r bg-muted/30 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Ready to Schedule</h2>
          
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                No drafts available
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Create drafts in Inbox first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => {
                const isSelected = selectedDraft?.id === draft.id
                const previewText = getPreviewText(draft.content || '').substring(0, 100)
                
                return (
                  <div
                    key={draft.id}
                    onClick={() => handleSelectDraft(draft)}
                    className={cn(
                      "rounded-lg border p-4 transition-colors cursor-pointer",
                      isSelected
                        ? "bg-accent border-accent-foreground/20"
                        : "bg-background border-border hover:bg-accent/50"
                    )}
                  >
                    <h3 className="font-medium text-sm truncate mb-1">
                      {draft.title || 'Untitled Draft'}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {previewText || 'No content'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(draft.created_at)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {draft.content?.length || 0} chars
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-y-auto p-6">
        <CalendarView
          scheduledPosts={scheduled.map(s => ({ ...s, type: 'scheduled' }))}
          onDateClick={(date) => {
            // Auto-fill date when clicking calendar
            if (selectedDraft && !scheduledDate) {
              setScheduledDate(format(date, 'yyyy-MM-dd'))
              setShowScheduleDialog(true)
            }
          }}
          onPostClick={(post) => {
            // Show post details
            console.log('Post clicked:', post)
          }}
        />
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
            <DialogDescription>
              Schedule or post immediately to {platform === 'twitter' ? 'Twitter/X' : 'LinkedIn'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Platform</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setPlatform('twitter')}
                  className={cn(
                    "flex-1 flex items-center justify-center p-4 rounded-lg border transition-colors",
                    platform === 'twitter'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-accent'
                  )}
                >
                  <Twitter className="mr-2" size={20} />
                  Twitter / X
                </button>
                <button
                  onClick={() => setPlatform('linkedin')}
                  className={cn(
                    "flex-1 flex items-center justify-center p-4 rounded-lg border transition-colors",
                    platform === 'linkedin'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-accent'
                  )}
                >
                  <Linkedin className="mr-2" size={20} />
                  LinkedIn
                </button>
              </div>
            </div>

            {/* Content Preview */}
            {selectedDraft && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Content Preview</label>
                  <Badge variant={selectedDraft.content.length > (platform === 'twitter' ? 280 : 3000) ? 'destructive' : 'secondary'}>
                    {selectedDraft.content.length} chars
                  </Badge>
                </div>
                <div className="text-sm whitespace-pre-wrap text-foreground/90 max-h-48 overflow-y-auto">
                  {preview || <span className="text-muted-foreground italic">No content</span>}
                </div>
              </div>
            )}

            {/* Schedule Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={today}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowScheduleDialog(false)
                setSelectedDraft(null)
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handlePostNow}
              disabled={loading || !selectedDraft?.content?.trim()}
            >
              <Send className="mr-2 h-4 w-4" />
              Post Now
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={loading || !selectedDraft?.content?.trim() || !scheduledDate || !scheduledTime}
            >
              {loading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
