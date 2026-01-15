import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Calendar, Clock, Send, Twitter, Linkedin, CheckCircle, X, Trash2, Search, Plus, Sparkles, Edit } from 'lucide-react'
import { schedulerApi, platformsApi, draftsApi } from '../api/client'
import useDraftStore from '../stores/draftStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import CalendarView from '@/components/Calendar'
import { DndContext, useDraggable, useDroppable, DragOverlay, pointerWithin, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { getPreviewText } from '@/lib/contentCleaner'
import * as simpleIcons from 'simple-icons'
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

// Helper function to extract platform from tags
const getPlatformFromTags = (tags) => {
  if (!tags || !Array.isArray(tags)) return null
  const platformTag = tags.find(tag => tag.startsWith('platform:'))
  if (platformTag) {
    return platformTag.replace('platform:', '')
  }
  return null
}

export default function Schedule() {
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draftId')
  const contentParam = searchParams.get('content')
  const titleParam = searchParams.get('title')

  // Use Zustand store for drafts
  const drafts = useDraftStore((state) => state.drafts)
  const scheduleDraft = useDraftStore((state) => state.scheduleDraft)
  const unscheduleDraft = useDraftStore((state) => state.unscheduleDraft)
  const updateDraft = useDraftStore((state) => state.updateDraft)
  const selectDraft = useDraftStore((state) => state.selectDraft)
  const deleteDraft = useDraftStore((state) => state.deleteDraft)
  const navigate = useNavigate()
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [scheduled, setScheduled] = useState([])
  const [platform, setPlatform] = useState('twitter')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest') // 'newest', 'oldest', 'alphabetical'
  const [error, setError] = useState(null)
  // Track the last user-selected platform to persist across dialog opens/closes
  const lastSelectedPlatformRef = useRef('twitter')

  // Effect to set platform when selectedDraft changes and dialog is open
  useEffect(() => {
    if (selectedDraft && showScheduleDialog) {
      const draftPlatform = getPlatformFromTags(selectedDraft.tags)
      if (draftPlatform) {
        // Draft has a confirmed platform - use it
        setPlatform(draftPlatform)
        lastSelectedPlatformRef.current = draftPlatform
      } else {
        // No platform tag in draft - restore the last user-selected platform
        setPlatform(lastSelectedPlatformRef.current)
      }
    }
  }, [selectedDraft, showScheduleDialog])

  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      try {
        await loadScheduled()
        
        // Handle URL parameters for direct scheduling
        if (draftId || contentParam) {
          if (draftId) {
            // Find draft in store by ID
            const draft = drafts.find(d => d.id === draftId || String(d.id) === String(draftId))
            if (draft && mounted) {
              setSelectedDraft(draft)
              setShowScheduleDialog(true)
            }
          } else if (contentParam && mounted) {
            setSelectedDraft({
              id: null,
              title: titleParam || '',
              content: decodeURIComponent(contentParam),
            })
            setShowScheduleDialog(true)
          }
        }
      } catch (err) {
        console.error('Initialization error:', err)
        if (mounted) {
          setError('Failed to load scheduler. Please refresh the page.')
        }
      }
    }
    
    init()
    
    return () => {
      mounted = false
    }
  }, [draftId, contentParam, titleParam, drafts])

  const loadScheduled = async () => {
    try {
      // Add cache-busting timestamp to ensure we get fresh data
      // Pass current timestamp to prevent caching
      const data = await schedulerApi.calendar(undefined, undefined, true)
      const scheduledPosts = Object.values(data.calendar || {}).flat()
      console.log('loadScheduled - loaded posts:', scheduledPosts.length)
      console.log('loadScheduled - posts:', scheduledPosts.map(p => ({ id: p.id, time: p.scheduled_time })))
      
      // Log the specific post we're looking for (Friday 9th)
      const fridayPosts = scheduledPosts.filter(p => {
        const postDate = new Date(p.scheduled_time)
        return format(postDate, 'yyyy-MM-dd') === '2026-01-09'
      })
      console.log('Friday 9th posts after load:', fridayPosts.map(p => ({ id: p.id, time: p.scheduled_time, hour: new Date(p.scheduled_time).getHours() })))
      
      // Use functional update to ensure we're setting the latest state
      setScheduled(prevScheduled => {
        console.log('setScheduled called - prev count:', prevScheduled.length, 'new count:', scheduledPosts.length)
        // Check if Friday 9th posts changed
        const prevFriday = prevScheduled.filter(p => {
          const postDate = new Date(p.scheduled_time)
          return format(postDate, 'yyyy-MM-dd') === '2026-01-09'
        })
        const newFriday = scheduledPosts.filter(p => {
          const postDate = new Date(p.scheduled_time)
          return format(postDate, 'yyyy-MM-dd') === '2026-01-09'
        })
        console.log('Friday posts - prev:', prevFriday.map(p => ({ id: p.id, hour: new Date(p.scheduled_time).getHours() })))
        console.log('Friday posts - new:', newFriday.map(p => ({ id: p.id, hour: new Date(p.scheduled_time).getHours() })))
        return scheduledPosts
      })
      
      // Increment key to force Calendar re-render
      setCalendarKey(prev => {
        const newKey = prev + 1
        console.log('Calendar key updated to:', newKey)
        return newKey
      })
      // Return the posts so callers can verify
      return scheduledPosts
    } catch (error) {
      console.error('Failed to load scheduled:', error)
      // Don't throw - just log the error to prevent blank page
      return []
    }
  }

  const handleSchedule = async () => {
    if (!selectedDraft?.content?.trim() || !scheduledDate || !scheduledTime) {
      showToast.warning('Required Fields', 'Please fill in all required fields.')
      return
    }

    const scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`
    
    // Validate that scheduled time is in the future
    const scheduledDateObj = new Date(scheduledDateTime)
    const now = new Date()
    
    if (isNaN(scheduledDateObj.getTime())) {
      showToast.error('Invalid Date', 'Please select a valid date and time.')
      return
    }
    
    if (scheduledDateObj <= now) {
      showToast.error('Invalid Time', 'Scheduled time must be in the future.')
      return
    }

    setLoading(true)
    try {
      // Determine the draft_id to send to API
      // If selectedDraft has draft_id, it's a post object - use that
      // Otherwise, use selectedDraft.id (which should be the draft's ID)
      let draftIdForApi = selectedDraft.draft_id || selectedDraft.id
      let draftUuidForStore = selectedDraft.id
      
      // If we got a post object, try to find the actual draft for store updates
      if (selectedDraft.draft_id && !drafts.find(d => d.id === selectedDraft.draft_id)) {
        // Post object with draft_id - find the actual draft
        const actualDraft = drafts.find(d => {
          return String(d.id) === String(selectedDraft.draft_id) || d.id === selectedDraft.draft_id
        })
        if (actualDraft) {
          draftUuidForStore = actualDraft.id
        }
      }

      // Validate we have what we need
      if (!draftIdForApi) {
        showToast.error('Schedule Failed', 'Cannot schedule: draft ID is missing.')
        setLoading(false)
        return
      }

      // If this is rescheduling an existing post, cancel the old one first
      const existingPost = scheduled.find(s => 
        (s.draft_id && s.draft_id === draftIdForApi) || 
        (s.id && selectedDraft.id && s.id === selectedDraft.id)
      )
      
      if (existingPost && existingPost.id) {
        try {
          await schedulerApi.cancel(existingPost.id)
          if (existingPost.draft_id) {
            unscheduleDraft(existingPost.draft_id)
          }
        } catch (cancelError) {
          console.warn('Failed to cancel existing post:', cancelError)
          // Continue anyway - might already be cancelled
        }
      }

      // Backend expects integer draft_id
      // Frontend drafts use UUIDs (localStorage only)
      // If we have a UUID, we need to create the draft in backend first
      let finalDraftId = draftIdForApi
      
      // Check if it's a UUID (contains dashes) - this means it's a frontend-only draft
      if (typeof draftIdForApi === 'string' && draftIdForApi.includes('-')) {
        // This is a UUID from frontend store - backend doesn't know about it
        // Create the draft in backend first, then use the returned ID
        try {
          const createdDraft = await draftsApi.create({
            title: selectedDraft.title || null,
            content: selectedDraft.content,
            tags: selectedDraft.tags || [],
          })
          finalDraftId = createdDraft.id // Backend returns integer ID
          console.log('Created draft in backend:', finalDraftId)
        } catch (createError) {
          console.error('Failed to create draft in backend:', createError)
          throw new Error('Failed to save draft to backend. Please try again.')
        }
      } else {
        // Try to convert to integer if it's a string number
        if (typeof draftIdForApi === 'string' && !isNaN(parseInt(draftIdForApi, 10))) {
          finalDraftId = parseInt(draftIdForApi, 10)
        } else if (typeof draftIdForApi !== 'number') {
          console.warn('Unexpected draft_id format:', draftIdForApi)
        }
      }
      
      // Validate we have a valid integer ID
      if (!finalDraftId || (typeof finalDraftId !== 'number' && isNaN(parseInt(finalDraftId, 10)))) {
        throw new Error('Invalid draft ID. Please try selecting the draft again.')
      }

      const response = await schedulerApi.schedule({
        draft_id: finalDraftId,
        platform,
        content: selectedDraft.content || '',
        scheduled_time: scheduledDateTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      
      // Update local draft state if we have a UUID (only if it's a valid UUID format)
      if (draftUuidForStore && typeof draftUuidForStore === 'string' && draftUuidForStore.includes('-')) {
        try {
          scheduleDraft(draftUuidForStore, scheduledDateTime)
        } catch (storeError) {
          console.warn('Failed to update draft store:', storeError)
          // Continue - not critical
        }
      }
      
      showToast.success('Post Scheduled', 'Post scheduled successfully!')
      
      // Reset state safely
      try {
        setShowScheduleDialog(false)
        setSelectedDraft(null)
        setScheduledDate('')
        setScheduledTime('')
      } catch (stateError) {
        console.error('Error resetting state:', stateError)
      }
      
      // Reload scheduled posts - ensure this completes before continuing
      await loadScheduled()
    } catch (error) {
      console.error('Failed to schedule post - Full error:', error)
      console.error('Error stack:', error?.stack)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data
      })
      
      let errorMessage = 'Failed to schedule post.'
      
      try {
        if (error?.response?.data) {
          // API error response
          errorMessage = error.response.data.detail || error.response.data.message || errorMessage
        } else if (error?.response?.status) {
          errorMessage = `Server error (${error.response.status}). Please try again.`
        } else if (error?.message) {
          // Network or other error
          errorMessage = error.message
        }
      } catch (parseError) {
        console.error('Error parsing error message:', parseError)
        errorMessage = 'An unexpected error occurred. Please check the console and try again.'
      }
      
      // Show error toast
      try {
        showToast.error('Schedule Failed', errorMessage)
      } catch (toastError) {
        console.error('Failed to show error toast:', toastError)
        // Fallback: alert if toast fails
        alert(`Schedule Failed: ${errorMessage}`)
      }
      
      // Don't close dialog on error - let user fix and try again
      // Keep dialog open so user can correct and retry
    } finally {
      try {
        setLoading(false)
      } catch (stateError) {
        console.error('Error setting loading state:', stateError)
      }
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
    // Platform will be set by useEffect when selectedDraft and showScheduleDialog change
  }

  const handleCancelScheduled = async (post) => {
    if (!post.id) return
    
    if (!window.confirm('Are you sure you want to cancel this scheduled post?')) {
      return
    }

    setLoading(true)
    try {
      await schedulerApi.cancel(post.id)
      
      // Update local draft state
      if (post.draft_id) {
        unscheduleDraft(post.draft_id)
      }
      
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

  const handleEditDraft = () => {
    if (!selectedDraft?.id) return

    // Remove "confirmed" tag to send draft back to Inbox
    const currentTags = selectedDraft.tags || []
    const updatedTags = currentTags.filter(tag => tag !== 'confirmed')
    
    // Update the draft to unconfirm it
    updateDraft(selectedDraft.id, {
      tags: updatedTags,
      confirmed: false
    })
    
    // Select the draft in the store
    selectDraft(selectedDraft.id)
    
    // Close the dialog
    setShowScheduleDialog(false)
    setSelectedDraft(null)
    
    // Navigate to Inbox for editing
    navigate('/inbox')
    
    showToast.success('Draft Sent to Inbox', 'You can now edit the draft in the Inbox.')
  }

  const handleDelete = async () => {
    if (!selectedDraft) return

    // Check if it's a scheduled post
    const scheduledPost = scheduled.find(s => {
      // Check if selectedDraft is actually a scheduled post object
      if (s.id && selectedDraft.id && s.id === selectedDraft.id) {
        return true
      }
      // Check if selectedDraft has a draft_id that matches a scheduled post
      if (s.draft_id && selectedDraft.id && (s.draft_id === selectedDraft.id || String(s.draft_id) === String(selectedDraft.id))) {
        return true
      }
      // Check if selectedDraft's id matches a scheduled post's draft_id
      if (selectedDraft.id && s.draft_id && (selectedDraft.id === s.draft_id || String(selectedDraft.id) === String(s.draft_id))) {
        return true
      }
      return false
    })

    if (scheduledPost && scheduledPost.id) {
      // It's a scheduled post - cancel it (handleCancelScheduled has its own confirmation)
      await handleCancelScheduled(scheduledPost)
    } else {
      // It's a draft - delete it
      if (!window.confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
        return
      }

      try {
        deleteDraft(selectedDraft.id)
        showToast.success('Draft Deleted', 'Draft deleted successfully.')
        setShowScheduleDialog(false)
        setSelectedDraft(null)
        setScheduledDate('')
        setScheduledTime('')
      } catch (error) {
        console.error('Delete failed:', error)
        showToast.error('Delete Failed', 'Failed to delete draft.')
      }
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
        const response = await schedulerApi.schedule({
          draft_id: draft.id,
          platform: 'twitter', // default
          content: draft.content,
          scheduled_time: scheduledDateTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        
        // Update local draft state
        scheduleDraft(draft.id, scheduledDateTime)
        
        showToast.success('Post Scheduled', 'Post scheduled successfully!')
        await loadScheduled()
      } catch (error) {
        console.error('Auto-schedule failed:', error)
        showToast.error('Schedule Failed', error.response?.data?.detail || 'Failed to schedule post.')
        // Fall back to opening dialog on error
        setSelectedDraft(draft)
        setScheduledDate(format(date, 'yyyy-MM-dd'))
        setScheduledTime(time || '12:00')
        setPlatform(lastSelectedPlatformRef.current) // Use last selected platform
        setShowScheduleDialog(true)
      } finally {
        setLoading(false)
      }
    } else {
      // Open dialog for manual scheduling
      setSelectedDraft(draft)
      setScheduledDate(format(date, 'yyyy-MM-dd'))
      setScheduledTime(time || '12:00')
      setPlatform(lastSelectedPlatformRef.current) // Use last selected platform
      setShowScheduleDialog(true)
    }
  }

  const handlePostReschedule = async (postId, date, time, autoSchedule = false) => {
    const post = scheduled.find(s => s.id === postId)
    if (!post) {
      showToast.error('Post Not Found', 'Could not find the scheduled post.')
      return
    }

    console.log('=== handlePostReschedule ===')
    console.log('Post ID:', postId)
    console.log('Received date:', date)
    console.log('Received time:', time)
    console.log('Formatted date:', format(date, 'yyyy-MM-dd'))
    
    // Create a Date object with the desired local time
    const [hours, minutes] = (time || '12:00').split(':')
    const localDateTime = new Date(date)
    localDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    
    // Send the time as-is in local timezone format
    // The backend will interpret it as local time and convert to UTC for storage
    // When we display it, we'll parse it correctly to show local time
    const scheduledDateTime = `${format(localDateTime, 'yyyy-MM-dd')}T${String(localDateTime.getHours()).padStart(2, '0')}:${String(localDateTime.getMinutes()).padStart(2, '0')}:00`
    
    console.log('Final scheduledDateTime being sent to API:', scheduledDateTime)
    console.log('Local time desired:', `${hours}:${minutes}`)
    console.log('User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)
    
    // Validate that scheduled time is in the future
    const scheduledDateObj = new Date(scheduledDateTime)
    const now = new Date()
    
    if (scheduledDateObj <= now) {
      showToast.error('Invalid Time', 'Scheduled time must be in the future.')
      return
    }

    if (autoSchedule) {
      // Auto-reschedule immediately
      setLoading(true)
      try {
        // Cancel existing post
        await schedulerApi.cancel(postId)
        
        // Find the draft for the post
        let draftIdForApi = post.draft_id
        if (!draftIdForApi) {
          // Try to find draft from store
          const draft = drafts.find(d => {
            // Check if any scheduled post matches this draft
            return scheduled.some(s => s.draft_id === d.id && s.id === postId)
          })
          if (draft) {
            draftIdForApi = draft.id
          }
        }

        if (!draftIdForApi) {
          throw new Error('Cannot reschedule: draft ID is missing.')
        }

        // Convert UUID to integer if needed
        let finalDraftId = draftIdForApi
        if (typeof draftIdForApi === 'string' && draftIdForApi.includes('-')) {
          // This is a UUID - need to create in backend or find existing
          const existingDraft = drafts.find(d => d.id === draftIdForApi)
          if (existingDraft) {
            // Try to create or find in backend
            try {
              const createdDraft = await draftsApi.create({
                title: existingDraft.title || null,
                content: existingDraft.content,
                tags: existingDraft.tags || [],
              })
              finalDraftId = createdDraft.id
            } catch (createError) {
              console.error('Failed to create draft in backend:', createError)
              throw new Error('Failed to save draft to backend. Please try again.')
            }
          }
        } else if (typeof draftIdForApi === 'string' && !isNaN(parseInt(draftIdForApi, 10))) {
          finalDraftId = parseInt(draftIdForApi, 10)
        }

        // Create new scheduled post
        // Send with user's timezone so backend converts correctly
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        console.log('About to call schedule API with:')
        console.log('  - draft_id:', finalDraftId)
        console.log('  - platform:', post.platform || 'twitter')
        console.log('  - scheduled_time:', scheduledDateTime)
        console.log('  - timezone:', userTimezone)
        
        const response = await schedulerApi.schedule({
          draft_id: finalDraftId,
          platform: post.platform || 'twitter',
          content: post.content || '',
          scheduled_time: scheduledDateTime,
          timezone: userTimezone, // Send user's timezone so backend converts correctly
        })

        console.log('Schedule API response:', response)
        console.log('New post ID:', response?.id, 'New post time:', response?.scheduled_time)
        console.log('Expected time was:', scheduledDateTime)
        if (response.scheduled_time !== scheduledDateTime) {
          console.error('⚠️ MISMATCH: API returned different time than we sent!')
          console.error('  Sent:', scheduledDateTime)
          console.error('  Received:', response.scheduled_time)
        }

        // Update local draft state if applicable
        if (post.draft_id && typeof post.draft_id === 'string' && post.draft_id.includes('-')) {
          try {
            scheduleDraft(post.draft_id, scheduledDateTime)
          } catch (storeError) {
            console.warn('Failed to update draft store:', storeError)
          }
        }

        // Optimistically update the state immediately with the new post
        if (response && response.id) {
          console.log('API Response received:', response)
          const newPost = {
            id: response.id,
            draft_id: response.draft_id || post.draft_id,
            platform: response.platform || post.platform || 'twitter',
            content: response.content || post.content || '',
            scheduled_time: response.scheduled_time,
            status: response.status || 'scheduled',
          }
          console.log('New post object:', newPost)
          console.log('New post scheduled_time:', newPost.scheduled_time)
          console.log('New post hour should be:', new Date(newPost.scheduled_time).getHours())
          
          // Use flushSync to force synchronous state updates
          flushSync(() => {
            // Update the state first
            setScheduled(prevScheduled => {
              // Remove the old post (by ID) and add the new one
              const filtered = prevScheduled.filter(p => p.id !== postId)
              const updated = [...filtered, newPost]
              console.log('Optimistically updated scheduled state:')
              console.log('  - Removed old post ID:', postId)
              console.log('  - Added new post ID:', newPost.id, 'time:', newPost.scheduled_time)
              console.log('  - Total posts now:', updated.length)
              // Log Friday posts specifically
              const fridayPosts = updated.filter(p => {
                const postDate = new Date(p.scheduled_time)
                return format(postDate, 'yyyy-MM-dd') === '2026-01-09'
              })
              console.log('  - Friday 9th posts in updated state:', fridayPosts.map(p => ({ id: p.id, time: p.scheduled_time, hour: new Date(p.scheduled_time).getHours() })))
              return updated
            })
            
            // Force Calendar re-render by incrementing key
            setCalendarKey(prev => {
              const newKey = prev + 1
              console.log('Calendar key updated to:', newKey)
              return newKey
            })
          })
        } else {
          console.warn('No response or response.id from schedule API:', response)
        }

        // Wait a bit for backend to process the update, then reload to sync
        await new Promise(resolve => setTimeout(resolve, 300))
        
        const updatedPosts = await loadScheduled()
        console.log('After loadScheduled - updated posts:', updatedPosts.length)
        console.log('After loadScheduled - updated posts details:', updatedPosts.map(p => ({ id: p.id, time: p.scheduled_time })))
        
        // Verify the rescheduled post is in the results
        const rescheduledPost = updatedPosts.find(p => {
          const postDate = new Date(p.scheduled_time)
          return format(postDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && 
                 format(postDate, 'HH:mm') === time
        })
        console.log('Rescheduled post found in results:', rescheduledPost ? { id: rescheduledPost.id, time: rescheduledPost.scheduled_time } : 'NOT FOUND')
        
        // Preserve the current date after rescheduling (don't jump to today)
        // If we're in day view, stay on the date where the post was rescheduled
        if (calendarView === 'day' && date instanceof Date && !isNaN(date.getTime())) {
          // Update the calendar date to the rescheduled date
          setCalendarCurrentDate(new Date(date.getTime()))
        }
        
        showToast.success('Post Rescheduled', 'Post rescheduled successfully!')
      } catch (error) {
        console.error('Auto-reschedule failed:', error)
        showToast.error('Reschedule Failed', error.response?.data?.detail || error.message || 'Failed to reschedule post.')
        // Fall back to opening dialog on error
        setSelectedDraft(post)
        setScheduledDate(format(date, 'yyyy-MM-dd'))
        setScheduledTime(time || '12:00')
        setPlatform(post.platform || lastSelectedPlatformRef.current)
        setShowScheduleDialog(true)
      } finally {
        setLoading(false)
      }
    } else {
      // Open dialog for manual rescheduling
      setSelectedDraft(post)
      setScheduledDate(format(date, 'yyyy-MM-dd'))
      setScheduledTime(time || '12:00')
      setPlatform(post.platform || lastSelectedPlatformRef.current)
      lastSelectedPlatformRef.current = post.platform || lastSelectedPlatformRef.current
      setShowScheduleDialog(true)
    }
  }

  const handleDragEndInternal = (event) => {
    setActiveId(null)
    const { active, over } = event
    
    if (!over || !active) return

    // Extract draft ID from active
    const activeId = active.id.toString()
    if (!activeId.startsWith('draft-')) return
    
    const draftId = activeId.replace('draft-', '') // UUID string, not integer
    if (!draftId) return
    
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

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>
    )
  }

  const [activeId, setActiveId] = useState(null)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const dragJustEndedRef = useRef(false)
  const [calendarKey, setCalendarKey] = useState(0)
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState('month')
  // Track which items have started dragging to prevent clicks
  const draggedItemsRef = useRef(new Set())

  // Configure sensors with distance activation constraint
  // This requires 8px movement before drag starts, allowing clicks to work
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag activates
      },
    })
  )

  const handleDragStart = (event) => {
    const itemId = event.active.id.toString()
    draggedItemsRef.current.add(itemId)
    setActiveId(event.active.id)
    setIsDraggingState(true)
    dragJustEndedRef.current = false
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    
    // Remove from dragged items set - clear after a delay to prevent immediate clicks
    if (active) {
      const itemId = active.id.toString()
      setTimeout(() => {
        draggedItemsRef.current.delete(itemId)
      }, 300) // Clear after 300ms to prevent clicks right after drag
    }
    
    // Always clear drag state first
    setActiveId(null)
    setIsDraggingState(false)
    
    // If no valid drop target, mark that drag just ended to prevent click
    if (!over || !active) {
      dragJustEndedRef.current = true
      // Clear the flag after a short delay to allow normal clicks again
      setTimeout(() => {
        dragJustEndedRef.current = false
      }, 200)
      return
    }

    // Extract ID from active - can be draft or scheduled post
    const activeId = active.id.toString()
    const isDraft = activeId.startsWith('draft-')
    const isScheduledPost = activeId.startsWith('scheduled-post-')
    
    if (!isDraft && !isScheduledPost) {
      return
    }
    
    // Extract date and time from over (format: "timeslot-YYYY-MM-DD-HHMM" or "calendar-day-YYYY-MM-DD")
    let overId = over.id.toString()
    
    // Debug: Log what we detected
    console.log('=== DRAG END DEBUG ===')
    console.log('Active ID:', activeId)
    console.log('Over ID:', overId)
    console.log('Is Draft:', isDraft, 'Is Scheduled Post:', isScheduledPost)
    
    // Prevent self-drops (dropping on the same element)
    if (activeId === overId) {
      dragJustEndedRef.current = true
      setTimeout(() => {
        dragJustEndedRef.current = false
      }, 100)
      return
    }
    
    // If dropped on sidebar drop zone, treat as cancelled
    if (overId === 'sidebar-drop-zone') {
      dragJustEndedRef.current = true
      setTimeout(() => {
        dragJustEndedRef.current = false
      }, 100)
      return
    }
    
    // If dropped on another draft (sidebar area), treat as cancelled
    if (overId.startsWith('draft-')) {
      dragJustEndedRef.current = true
      setTimeout(() => {
        dragJustEndedRef.current = false
      }, 100)
      return
    }
    
    // If dropped on a scheduled post, we need to find the actual timeslot container
    // The pointerWithin detection should find the timeslot if dropping in empty space,
    // but if dropping directly on the post card, we use the post's timeslot as fallback
    // Only do this if we haven't already detected a timeslot
    if (overId.startsWith('scheduled-post-') && !overId.startsWith('timeslot-')) {
      const targetPostId = parseInt(overId.replace('scheduled-post-', ''), 10)
      const targetPost = scheduled.find(s => s.id === targetPostId)
      if (targetPost && targetPost.scheduled_time) {
        // Extract the timeslot from the target post's scheduled time
        const postDate = new Date(targetPost.scheduled_time)
        const dateStr = format(postDate, 'yyyy-MM-dd')
        const hour = postDate.getHours()
        const minute = postDate.getMinutes()
        const timeStr = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`
        overId = `timeslot-${dateStr}-${timeStr}`
        // Continue processing with the timeslot ID
      } else {
        // Can't find the post, treat as cancelled
        dragJustEndedRef.current = true
        setTimeout(() => {
          dragJustEndedRef.current = false
        }, 100)
        return
      }
    }
    
    // Only process drops on valid calendar drop zones
    // If dropped on sidebar or any other area, treat as cancelled
    const isValidDropZone = overId.startsWith('timeslot-') || overId.startsWith('calendar-day-')
    
    if (!isValidDropZone) {
      // Not a valid drop zone - treat as cancelled drag
      dragJustEndedRef.current = true
      setTimeout(() => {
        dragJustEndedRef.current = false
      }, 100)
      return
    }
    
    // Helper function to parse timeslot and call appropriate handler
    const handleTimeslotDrop = (date, time, autoSchedule) => {
      // Always set dragJustEndedRef to prevent click events after successful drops
      dragJustEndedRef.current = true
      setTimeout(() => {
        dragJustEndedRef.current = false
      }, 300) // Longer delay for successful drops to ensure click is blocked
      
      if (isDraft) {
        const draftId = activeId.replace('draft-', '')
        if (draftId) {
          handleDraftDrop(draftId, date, time, autoSchedule)
        }
      } else if (isScheduledPost) {
        const postId = parseInt(activeId.replace('scheduled-post-', ''), 10)
        if (postId) {
          handlePostReschedule(postId, date, time, autoSchedule)
        }
      }
    }
    
    if (overId.startsWith('timeslot-')) {
      // Dropped on a time slot - auto-schedule/reschedule!
      // Format: timeslot-2024-01-15-0900
      const parts = overId.split('-')
      if (parts.length >= 5) {
        // parts[0] = "timeslot", parts[1] = YYYY, parts[2] = MM, parts[3] = DD, parts[4] = HHMM
        const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}` // YYYY-MM-DD
        const timeStr = parts[4] || '1200' // HHMM (4 digits)
        
        // Debug: log the detected timeslot
        console.log('Dropping on timeslot:', overId, 'timeStr:', timeStr, 'expected hour:', timeStr.substring(0, 2))
        
        // Validate date string
        if (dateStr.length !== 10) {
          console.error('Invalid date format:', dateStr)
          setActiveId(null)
          setIsDraggingState(false)
          return
        }
        
        const date = new Date(dateStr + 'T00:00:00') // Add time to ensure proper parsing
        
        if (isNaN(date.getTime())) {
          console.error('Invalid date:', dateStr, 'parsed as:', date)
          setActiveId(null)
          setIsDraggingState(false)
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
          setActiveId(null)
          setIsDraggingState(false)
          return
        }
        
        const time = `${hour}:${minute}`
        console.log('=== TIMESLOT PARSING ===')
        console.log('Full overId:', overId)
        console.log('Parts array:', parts)
        console.log('Date string:', dateStr)
        console.log('Time string (HHMM):', timeStr)
        console.log('Hour string:', hour, 'Hour number:', hourNum)
        console.log('Minute string:', minute, 'Minute number:', minuteNum)
        console.log('Final time:', time)
        console.log('Final date:', dateStr)
        console.log('Will schedule to:', dateStr, time)
        handleTimeslotDrop(date, time, true) // autoSchedule = true
      } else {
        console.error('Invalid timeslot format:', overId, 'parts:', parts)
        dragJustEndedRef.current = true
        setTimeout(() => {
          dragJustEndedRef.current = false
        }, 100)
      }
    } else if (overId.startsWith('calendar-day-')) {
      // Dropped on calendar day - format: calendar-day-2024-01-15
      const dateStr = overId.replace('calendar-day-', '')
      const date = new Date(dateStr)
      
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateStr)
        dragJustEndedRef.current = true
        setTimeout(() => {
          dragJustEndedRef.current = false
        }, 100)
        return
      }
      
      // For month view: if it's a scheduled post being dragged, auto-reschedule to the dropped day
      // For other views or drafts: open dialog
      if (isScheduledPost && calendarView === 'month') {
        // Auto-reschedule to the dropped day at default time (12:00)
        handleTimeslotDrop(date, '12:00', true) // autoSchedule = true
      } else {
        // Open dialog for manual scheduling/rescheduling
        handleTimeslotDrop(date, '12:00', false) // autoSchedule = false
      }
    }
  }

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd} 
      collisionDetection={(args) => {
        // Use pointerWithin for precise pointer-based detection
        const pointerCollisions = pointerWithin(args)
        
        // Filter to only timeslot and calendar-day droppables (ignore draggable post cards)
        const droppableCollisions = pointerCollisions.filter(collision => {
          const id = collision.id.toString()
          return id.startsWith('timeslot-') || id.startsWith('calendar-day-')
        })
        
        if (droppableCollisions.length > 0) {
          // If multiple droppables found, prefer the one with the smallest area
          // (most specific = the exact timeslot, not a parent container)
          const sorted = droppableCollisions.sort((a, b) => {
            const aRect = a.data?.droppableContainer?.rect
            const bRect = b.data?.droppableContainer?.rect
            if (!aRect || !bRect) return 0
            const aArea = aRect.width * aRect.height
            const bArea = bRect.width * bRect.height
            // Prefer smaller area (more specific timeslot)
            return aArea - bArea
          })
          
          const selected = sorted[0]
          const selectedId = selected.id.toString()
          if (selectedId.startsWith('timeslot-')) {
            const parts = selectedId.split('-')
            if (parts.length >= 5) {
              const hour = parts[4]?.substring(0, 2)
              console.log('Collision detection selected timeslot:', selectedId, 'hour:', hour)
            }
          }
          
          return [selected]
        }
        
        // If no droppable found with pointerWithin, try closestCorners
        const cornerCollisions = closestCorners(args)
        const droppableCornerCollisions = cornerCollisions.filter(collision => {
          const id = collision.id.toString()
          return id.startsWith('timeslot-') || id.startsWith('calendar-day-')
        })
        
        if (droppableCornerCollisions.length > 0) {
          return [droppableCornerCollisions[0]]
        }
        
        // Return all collisions as fallback
        return pointerCollisions.length > 0 ? pointerCollisions : cornerCollisions
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
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
                  className="pl-9 h-9 text-sm bg-muted/50 border-muted"
                />
              </div>
            </div>

            {/* Right: Spacer */}
            <div className="flex items-center shrink-0 w-10">
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Drafts Sidebar */}
          <SidebarDroppableWrapper>
            <div className="w-64 sm:w-64 md:w-64 border-r bg-muted/30 flex flex-col h-full min-h-0 flex-shrink-0">
              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                      {/* Sort Filter - Sticky at top */}
                      <div className="sticky top-0 z-10 mb-3 pb-3 bg-muted/30 backdrop-blur-sm -mx-4 px-4 -mt-4 pt-4">
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-full h-8 text-xs border-muted/50 bg-background hover:bg-muted/40 focus:bg-background transition-all duration-200">
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
                            dragJustEndedRef={dragJustEndedRef}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SidebarDroppableWrapper>

          {/* Calendar View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden min-h-0 p-6">
              <CalendarView
                key={`calendar-${calendarKey}`}
                scheduledPosts={scheduled.map(s => ({ ...s, type: 'scheduled' }))}
                drafts={drafts}
                dragJustEndedRef={dragJustEndedRef}
                draggedItemsRef={draggedItemsRef}
                currentDate={calendarCurrentDate}
                onDateChange={(date) => {
                  try {
                    // Validate date is a valid Date object
                    if (date instanceof Date && !isNaN(date.getTime())) {
                      setCalendarCurrentDate(date)
                    }
                  } catch (error) {
                    console.error('Error in onDateChange:', error)
                  }
                }}
                onViewChange={(view) => {
                  try {
                    if (view) {
                      setCalendarView(view)
                    }
                  } catch (error) {
                    console.error('Error in onViewChange:', error)
                  }
                }}
                onDateClick={(date) => {
                  // Auto-fill date when clicking calendar
                  if (selectedDraft && !scheduledDate) {
                    setScheduledDate(format(date, 'yyyy-MM-dd'))
                    setShowScheduleDialog(true)
                  }
                }}
                onPostClick={(post) => {
                  try {
                    // Show post details - allow cancel/reschedule
                    // If post has draft_id, try to find the actual draft from store
                    let draftToSelect = post
                    if (post && post.draft_id) {
                      const actualDraft = drafts.find(d => {
                        // Match by draft_id if available, or by id
                        return d.id === post.draft_id || String(d.id) === String(post.draft_id)
                      })
                      if (actualDraft) {
                        draftToSelect = actualDraft
                      }
                    }
                    setSelectedDraft(draftToSelect)
                    // Pre-fill date/time from scheduled post
                    if (post && post.scheduled_time) {
                      const scheduledDate = new Date(post.scheduled_time)
                      if (!isNaN(scheduledDate.getTime())) {
                        setScheduledDate(format(scheduledDate, 'yyyy-MM-dd'))
                        setScheduledTime(format(scheduledDate, 'HH:mm'))
                      }
                    }
                    // Prioritize draft's platform tag if available, otherwise use post.platform
                    const draftPlatform = getPlatformFromTags(draftToSelect?.tags)
                    const postPlatform = draftPlatform || post?.platform || 'twitter'
                    setPlatform(postPlatform)
                    lastSelectedPlatformRef.current = postPlatform
                    setShowScheduleDialog(true)
                  } catch (error) {
                    console.error('Error handling post click:', error)
                    showToast.error('Error', 'Failed to open post details. Please try again.')
                  }
                }}
                onDraftDrop={handleDraftDrop}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog 
        open={showScheduleDialog} 
        onOpenChange={(open) => {
          setShowScheduleDialog(open)
          // When dialog closes, preserve platform selection but reset other fields
          if (!open) {
            setSelectedDraft(null)
            setScheduledDate('')
            setScheduledTime('')
            // Platform is preserved for next time
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
            <DialogDescription>
              Schedule or post immediately to {platform === 'twitter' ? 'Twitter/X' : 'LinkedIn'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Platform Selection - Same UI as DraftEditor */}
            <div>
              <label className="block text-sm font-medium mb-2">Platform</label>
              <div className="flex items-center gap-0 bg-background/95 backdrop-blur-sm border rounded-full px-1.5 py-0.5 shadow-sm w-fit">
                <button
                  onClick={() => {
                    setPlatform('linkedin')
                    lastSelectedPlatformRef.current = 'linkedin'
                  }}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full transition-all",
                    "hover:bg-muted/50"
                  )}
                  title="LinkedIn"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className={cn(
                      "h-3 w-3 fill-current",
                      platform === 'linkedin' 
                        ? "text-[#0A66C2] dark:text-[#71B7FB]" 
                        : "text-muted-foreground"
                    )}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </button>
                <div className="h-3 w-px bg-border" />
                <button
                  onClick={() => {
                    setPlatform('twitter')
                    lastSelectedPlatformRef.current = 'twitter'
                  }}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-full transition-all",
                    "hover:bg-muted/50"
                  )}
                  title="Twitter/X"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className={cn(
                      "h-2.5 w-2.5 fill-current",
                      platform === 'twitter' 
                        ? "text-black dark:text-white" 
                        : "text-muted-foreground"
                    )}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path d={simpleIcons.siX.path} />
                  </svg>
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
                    onChange={(e) => {
                      const selectedDate = e.target.value
                      setScheduledDate(selectedDate)
                      // If selected date is today, validate time is in future
                      if (selectedDate === today) {
                        const now = new Date()
                        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        if (scheduledTime && scheduledTime <= currentTime) {
                          // Suggest a time 1 hour from now
                          const futureTime = new Date(now.getTime() + 60 * 60 * 1000)
                          setScheduledTime(`${String(futureTime.getHours()).padStart(2, '0')}:${String(futureTime.getMinutes()).padStart(2, '0')}`)
                        }
                      }
                    }}
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
            
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 sm:gap-2">
            {/* Left side: Secondary actions */}
            <div className="flex gap-2 w-full sm:w-auto">
              {(selectedDraft?.tags?.includes('confirmed') || (selectedDraft?.id && scheduled.some(s => s.id === selectedDraft.id))) && (
                <Button
                  variant="outline"
                  onClick={handleEditDraft}
                  disabled={loading}
                  className="flex-1 sm:flex-initial"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Send to Inbox
                </Button>
              )}
              {selectedDraft && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 sm:flex-initial"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            
            {/* Right side: Primary actions */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="default"
                onClick={handlePostNow}
                disabled={loading || !selectedDraft?.content?.trim()}
                className="flex-1 sm:flex-initial"
              >
                <Send className="mr-2 h-4 w-4" />
                Post Now
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={loading || !selectedDraft?.content?.trim() || !scheduledDate || !scheduledTime}
                className="flex-1 sm:flex-initial"
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay - shows dragged item following cursor */}
      <DragOverlay style={{ zIndex: 9999 }}>
        {activeId ? (() => {
          const activeIdStr = activeId.toString()
          
          // Handle draft drag
          if (activeIdStr.startsWith('draft-')) {
            const draftId = activeIdStr.replace('draft-', '')
            const draggedDraft = drafts.find(d => d.id === draftId)
            if (!draggedDraft) return null
            
            const preview = getPreviewText(draggedDraft.content || '')
            const hasPrompt = draggedDraft.prompt && draggedDraft.prompt.trim().length > 0
            const draftPlatform = getPlatformFromTags(draggedDraft.tags)
            
            return (
              <Card className="w-64 shadow-2xl border-2 border-primary/50 rotate-3 opacity-95 cursor-grabbing" style={{ willChange: 'transform' }}>
                <CardContent className="p-3">
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
                              className="h-2.5 w-2.5 shrink-0 fill-current text-black dark:text-white"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <path d={simpleIcons.siX.path} />
                            </svg>
                          ) : draftPlatform === 'linkedin' ? (
                            <svg
                              role="img"
                              viewBox="0 0 24 24"
                              className="h-3 w-3 shrink-0 fill-current text-[#0A66C2] dark:text-[#71B7FB]"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 leading-snug font-medium">
                    {preview || <span className="italic opacity-50">No content</span>}
                  </p>
                </CardContent>
              </Card>
            )
          }
          
          // Handle scheduled post drag
          if (activeIdStr.startsWith('scheduled-post-')) {
            const postId = parseInt(activeIdStr.replace('scheduled-post-', ''), 10)
            const draggedPost = scheduled.find(s => s.id === postId)
            if (!draggedPost) return null
            
            const preview = getPreviewText(draggedPost.content || '')
            
            return (
              <Card className="w-64 shadow-2xl border-2 border-primary/50 rotate-3 opacity-95 cursor-grabbing" style={{ willChange: 'transform' }}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center">
                        {draggedPost.platform === 'twitter' ? (
                          <svg
                            role="img"
                            viewBox="0 0 24 24"
                            className="h-2.5 w-2.5 shrink-0 fill-current text-black dark:text-white"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            <path d={simpleIcons.siX.path} />
                          </svg>
                        ) : draggedPost.platform === 'linkedin' ? (
                          <svg
                            role="img"
                            viewBox="0 0 24 24"
                            className="h-3 w-3 shrink-0 fill-current text-[#0A66C2] dark:text-[#71B7FB]"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        ) : null}
                      </div>
                      <Badge variant="outline" className="h-3.5 px-1 text-[8px]">
                        {format(new Date(draggedPost.scheduled_time), 'HH:mm')}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 leading-snug font-medium">
                    {preview || <span className="italic opacity-50">No content</span>}
                  </p>
                </CardContent>
              </Card>
            )
          }
          
          return null
        })() : null}
      </DragOverlay>
    </DndContext>
  )
}

// Sidebar Droppable Wrapper - catches drops to prevent calendar detection
function SidebarDroppableWrapper({ children }) {
  const { setNodeRef } = useDroppable({
    id: 'sidebar-drop-zone',
    data: { type: 'sidebar' },
  })

  return (
    <div ref={setNodeRef} className="h-full flex flex-col min-w-0">
      {children}
    </div>
  )
}

// Draggable Draft Component
function DraggableDraft({ draft, onClick, isSelected, dragJustEndedRef }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `draft-${draft.id}`,
    data: draft,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    willChange: 'transform',
  } : undefined

  const preview = getPreviewText(draft.content || '')
  const hasPrompt = draft.prompt && draft.prompt.trim().length > 0
  const draftPlatform = getPlatformFromTags(draft.tags)
  
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

  // Track mouse position to distinguish clicks from drags
  const mouseDownPosRef = useRef(null)
  const hasMovedRef = useRef(false)
  const dragStartedRef = useRef(false)

  const handleMouseDown = (e) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
    hasMovedRef.current = false
    dragStartedRef.current = false
  }

  const handleMouseMove = (e) => {
    if (mouseDownPosRef.current && !dragStartedRef.current) {
      const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x)
      const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y)
      // If mouse moved more than 5px, consider it a drag
      if (deltaX > 5 || deltaY > 5) {
        hasMovedRef.current = true
        dragStartedRef.current = true
      }
    }
  }

  const handleClick = (e) => {
    // Prevent click if drag just ended
    if (dragJustEndedRef?.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // If mouse moved significantly or drag started, it was a drag, not a click
    if (hasMovedRef.current || dragStartedRef.current || isDragging) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    onClick()
  }

  const handleMouseUp = () => {
    // Small delay to check if it was a click before clearing
    setTimeout(() => {
      mouseDownPosRef.current = null
      hasMovedRef.current = false
      dragStartedRef.current = false
    }, 100)
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={cn(
        "cursor-grab active:cursor-grabbing border-border/80 hover:border-border hover:shadow-md hover:scale-[1.02]",
        // Only apply transitions when not dragging for better performance
        !isDragging && "transition-all duration-200",
        isDragging && "opacity-30 scale-95 rotate-2 shadow-lg z-50",
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
            {draftPlatform && (
              <div className="flex items-center">
                {draftPlatform === 'twitter' ? (
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className="h-2.5 w-2.5 shrink-0 fill-current text-black dark:text-white"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path d={simpleIcons.siX.path} />
                  </svg>
                ) : draftPlatform === 'linkedin' ? (
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className="h-3 w-3 shrink-0 fill-current text-[#0A66C2] dark:text-[#71B7FB]"
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
        <p className="text-xs text-muted-foreground line-clamp-1 leading-snug font-medium">
          {preview || <span className="italic opacity-50">No content</span>}
        </p>
      </CardContent>
    </Card>
  )
}
