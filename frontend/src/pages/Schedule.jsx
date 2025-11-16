import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Clock, Send, Twitter, Linkedin, CheckCircle, X, Trash2, Search, Plus, Sparkles } from 'lucide-react'
import { draftsApi, schedulerApi, platformsApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import CalendarView from '@/components/Calendar'
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCenter } from '@dnd-kit/core'
import { getPreviewText } from '@/lib/contentCleaner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest') // 'newest', 'oldest', 'alphabetical'

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
    // Pre-fill date/time with today and default time if not set
    if (!scheduledDate) {
      setScheduledDate(new Date().toISOString().split('T')[0])
      setScheduledTime('12:00')
    }
    setShowScheduleDialog(true)
  }

  const handleCancelScheduled = async (post) => {
    if (!post.id) return
    
    if (!window.confirm('Are you sure you want to cancel this scheduled post?')) {
      return
    }

    setLoading(true)
    try {
      await schedulerApi.cancel(post.id)
      showToast.success('Post Cancelled', 'Scheduled post has been cancelled.')
      loadScheduled()
      setShowScheduleDialog(false)
      setSelectedDraft(null)
    } catch (error) {
      console.error('Cancel failed:', error)
      showToast.error('Cancel Failed', error.response?.data?.detail || 'Failed to cancel post.')
    } finally {
      setLoading(false)
    }
  }

  const handleDraftDrop = async (draftId, date, time, autoSchedule = false) => {
    const draft = drafts.find(d => d.id === draftId)
    if (!draft) return

    const scheduledDateTime = `${format(date, 'yyyy-MM-dd')}T${time || '12:00'}:00`
    
    if (autoSchedule) {
      // Auto-schedule immediately
      setLoading(true)
      try {
        await schedulerApi.schedule({
          draft_id: draft.id,
          platform: 'twitter', // default
          content: draft.content,
          scheduled_time: scheduledDateTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        
        showToast.success('Post Scheduled', 'Post scheduled successfully!')
        loadScheduled()
        loadDrafts()
      } catch (error) {
        console.error('Auto-schedule failed:', error)
        showToast.error('Schedule Failed', error.response?.data?.detail || 'Failed to schedule post.')
        // Fall back to opening dialog on error
        setSelectedDraft(draft)
        setScheduledDate(format(date, 'yyyy-MM-dd'))
        setScheduledTime(time || '12:00')
        setPlatform('twitter')
        setShowScheduleDialog(true)
      } finally {
        setLoading(false)
      }
    } else {
      // Open dialog for manual scheduling
      setSelectedDraft(draft)
      setScheduledDate(format(date, 'yyyy-MM-dd'))
      setScheduledTime(time || '12:00')
      setPlatform('twitter') // default
      setShowScheduleDialog(true)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    
    if (!over || !active) return

    // Extract draft ID from active
    const activeId = active.id.toString()
    if (!activeId.startsWith('draft-')) return
    
    const draftId = parseInt(activeId.replace('draft-', ''))
    if (isNaN(draftId)) return
    
    // Extract date and time from over (format: "timeslot-YYYY-MM-DD-HHMM" or "calendar-day-YYYY-MM-DD")
    const overId = over.id.toString()
    
    if (overId.startsWith('timeslot-')) {
      // Dropped on a time slot - auto-schedule!
      // Format: timeslot-2024-01-15-0900
      const parts = overId.split('-')
      if (parts.length >= 5) {
        // parts[0] = "timeslot", parts[1] = YYYY, parts[2] = MM, parts[3] = DD, parts[4] = HHMM
        const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}` // YYYY-MM-DD
        const timeStr = parts[4] || '1200' // HHMM (4 digits)
        
        // Validate date string
        if (dateStr.length !== 10) {
          console.error('Invalid date format:', dateStr)
          return
        }
        
        const date = new Date(dateStr + 'T00:00:00') // Add time to ensure proper parsing
        
        if (isNaN(date.getTime())) {
          console.error('Invalid date:', dateStr, 'parsed as:', date)
          return
        }
        
        // Parse time: HHMM -> HH:MM
        const hour = timeStr.substring(0, 2)
        const minute = timeStr.substring(2, 4) || '00'
        
        // Validate hour and minute
        const hourNum = parseInt(hour, 10)
        const minuteNum = parseInt(minute, 10)
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23 || isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
          console.error('Invalid time format:', timeStr, 'parsed as hour:', hourNum, 'minute:', minuteNum)
          showToast.error('Invalid Time Slot', 'Could not parse the time slot. Please try again.')
          return
        }
        
        const time = `${hour}:${minute}`
        handleDraftDrop(draftId, date, time, true) // autoSchedule = true
      } else {
        console.error('Invalid timeslot format:', overId, 'parts:', parts)
      }
    } else if (overId.startsWith('calendar-day-')) {
      // Dropped on calendar day - open dialog for manual scheduling
      // Format: calendar-day-2024-01-15
      const dateStr = overId.replace('calendar-day-', '')
      const date = new Date(dateStr)
      
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateStr)
        return
      }
      
      handleDraftDrop(draftId, date, '12:00', false) // autoSchedule = false
    }
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

  const filteredDrafts = drafts
    .filter((draft) => {
      // Only show confirmed drafts (drafts with "confirmed" tag)
      const tags = draft.tags || []
      const isConfirmed = tags.includes('confirmed')
      
      // Filter by search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return isConfirmed && draft.content?.toLowerCase().includes(query)
      }
      
      return isConfirmed
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

  // Count confirmed drafts that are NOT yet scheduled
  const toBeScheduledCount = filteredDrafts.filter(draft => 
    !scheduled.some(s => s.draft_id === draft.id)
  ).length

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-6">
            {/* Left: Title and Scheduled Count */}
            <div className="flex items-center gap-3 shrink-0">
              <h2 className="text-lg font-semibold">Schedule</h2>
              <Badge variant="secondary" className="h-6 px-2 text-xs font-medium">
                {toBeScheduledCount}
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

            {/* Right: Spacer */}
            <div className="flex items-center shrink-0 w-10">
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden h-full">
          {/* Drafts Sidebar */}
          <div className="w-64 border-r bg-muted/30 overflow-y-auto scrollbar-thin transition-all duration-200">
            <div className="p-4">
          
          {filteredDrafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="mb-4 p-3 rounded-full bg-muted/50">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">
                {searchQuery ? 'No confirmed drafts found' : 'No confirmed drafts available'}
              </h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                {searchQuery ? 'Try a different search' : 'Confirm drafts in Inbox to schedule them'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Sort Filter */}
              <div className="mb-3">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full h-8 text-xs border-muted/50 bg-muted/20 hover:bg-muted/40 focus:bg-background transition-all duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredDrafts.map((draft) => {
                const isSelected = selectedDraft?.id === draft.id
                
                return (
                  <DraggableDraft
                    key={draft.id}
                    draft={draft}
                    onClick={() => handleSelectDraft(draft)}
                    isSelected={isSelected}
                  />
                )
              })}
            </div>
          )}
            </div>
          </div>

          {/* Calendar View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden min-h-0 p-6">
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
                  // Show post details - allow cancel
                  setSelectedDraft(post)
                  // Pre-fill date/time from scheduled post
                  if (post.scheduled_time) {
                    const scheduledDate = new Date(post.scheduled_time)
                    setScheduledDate(format(scheduledDate, 'yyyy-MM-dd'))
                    setScheduledTime(format(scheduledDate, 'HH:mm'))
                  }
                  setPlatform(post.platform || 'twitter')
                  setShowScheduleDialog(true)
                }}
                onDraftDrop={handleDraftDrop}
              />
            </div>
          </div>
        </div>
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
                  <Twitter className="mr-2 h-5 w-5" />
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
                  <Linkedin className="mr-2 h-5 w-5" />
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
            <div className="space-y-3">
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
              
              {/* Quick Time Presets */}
              <div>
                <label className="block text-sm font-medium mb-2">Quick Times</label>
                <div className="flex gap-2 flex-wrap">
                  {['09:00', '12:00', '15:00', '18:00'].map((time) => {
                    const [hours, minutes] = time.split(':')
                    const timeDate = new Date(2000, 0, 1, parseInt(hours), parseInt(minutes))
                    return (
                      <Button
                        key={time}
                        variant="outline"
                        size="sm"
                        onClick={() => setScheduledTime(time)}
                        className={scheduledTime === time ? 'bg-accent' : ''}
                      >
                        {format(timeDate, 'HH:mm')}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            
            {/* Show Cancel button if editing a scheduled post */}
            {selectedDraft?.id && scheduled.some(s => s.id === selectedDraft.id) && (
              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancelScheduled(selectedDraft)}
                  disabled={loading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel Scheduled Post
                </Button>
              </div>
            )}
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
                  <Clock className="mr-2 h-4 w-4 animate-spin shrink-0" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4 shrink-0" />
                  Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}

// Draggable Draft Component
function DraggableDraft({ draft, onClick, isSelected }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `draft-${draft.id}`,
    data: draft,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const preview = getPreviewText(draft.content || '')
  const hasPrompt = draft.prompt && draft.prompt.trim().length > 0
  
  // Format timestamp
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
  
  const timeAgo = formatDate(draft.created_at)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all border-border/80 hover:border-border hover:shadow-sm",
        isDragging && "opacity-50",
        isSelected && "border-primary/80 shadow-sm bg-accent/50"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {hasPrompt && (
              <Badge variant="secondary" className="h-3.5 px-1 text-[8px] gap-0.5 opacity-60">
                <Sparkles className="h-2 w-2" />
              </Badge>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground font-medium">
            {timeAgo}
          </span>
        </div>
        {/* Preview content (cleaned, matching preview pane) - single line */}
        <p className="text-xs text-muted-foreground line-clamp-1 leading-snug font-medium">
          {preview || <span className="italic opacity-50">No content</span>}
        </p>
      </CardContent>
    </Card>
  )
}
