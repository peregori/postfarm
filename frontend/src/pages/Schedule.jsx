import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calendar, Clock, Save, Twitter, Linkedin } from 'lucide-react'
import { draftsApi, schedulerApi } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export default function Schedule() {
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draftId')

  const [drafts, setDrafts] = useState([])
  const [selectedDraft, setSelectedDraft] = useState(null)
  const [content, setContent] = useState('')
  const [platform, setPlatform] = useState('twitter')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [calendar, setCalendar] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDrafts()
    loadCalendar()
    if (draftId) {
      loadDraft(draftId)
    }
  }, [draftId])

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
      setContent(draft.content)
    } catch (error) {
      console.error('Failed to load draft:', error)
    }
  }

  const loadCalendar = async () => {
    try {
      const data = await schedulerApi.calendar()
      setCalendar(data.calendar || {})
    } catch (error) {
      console.error('Failed to load calendar:', error)
    }
  }

  const handleSchedule = async () => {
    if (!content.trim() || !scheduledDate || !scheduledTime) {
      alert('Please fill in all required fields')
      return
    }

    const scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`

    setLoading(true)
    try {
      await schedulerApi.schedule({
        draft_id: selectedDraft?.id || null,
        platform,
        content,
        scheduled_time: scheduledDateTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      alert('Post scheduled successfully!')
      setContent('')
      setScheduledDate('')
      setScheduledTime('')
      loadCalendar()
    } catch (error) {
      console.error('Failed to schedule post:', error)
      alert('Failed to schedule post. ' + (error.response?.data?.detail || ''))
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Scheduling Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2" size={28} />
              Schedule Post
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Draft Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Select Draft (optional)
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedDraft?.id || ''}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) {
                    loadDraft(id)
                  } else {
                    setSelectedDraft(null)
                    setContent('')
                  }
                }}
              >
                <option value="">Create new content</option>
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {draft.title || `Draft #${draft.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform Selection */}
            <div className="mb-6">
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

            {/* Content */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Content{' '}
                <span className="text-xs text-muted-foreground">
                  ({content.length} characters
                  {platform === 'twitter' && ` / 280 max`})
                </span>
              </label>
              <Textarea
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter or edit the content to post..."
                maxLength={platform === 'twitter' ? 280 : undefined}
              />
            </div>

            {/* Schedule Time */}
            <div className="grid grid-cols-2 gap-4 mb-6">
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

            {/* Schedule Button */}
            <Button
              onClick={handleSchedule}
              disabled={loading || !content.trim() || !scheduledDate || !scheduledTime}
              className="w-full"
            >
              {loading ? (
                <>
                  <Spinner className="mr-2" size={20} />
                  Scheduling...
                </>
              ) : (
                <>
                  <Save className="mr-2" size={20} />
                  Schedule Post
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {Object.keys(calendar).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No scheduled posts
                </p>
              ) : (
                Object.entries(calendar)
                  .sort()
                  .map(([date, posts]) => (
                    <div key={date} className="mb-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </h4>
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          className="p-3 bg-muted/30 rounded-lg mb-2"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs text-muted-foreground">
                              {post.platform === 'twitter' ? (
                                <Twitter size={14} />
                              ) : (
                                <Linkedin size={14} />
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.scheduled_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground line-clamp-2">
                            {post.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
