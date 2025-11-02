import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Twitter, Linkedin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function Calendar({ scheduledPosts = [], onDateClick, onPostClick }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getPostsForDate = (date) => {
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduled_time)
      return isSameDay(postDate, date)
    })
  }

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {weekDays.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayPosts = getPostsForDate(day)
            const isCurrentMonth = format(day, 'MM') === format(currentDate, 'MM')
            const isCurrentDay = isToday(day)

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[100px] border-b border-r p-2 cursor-pointer transition-colors",
                  !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                  isCurrentDay && "bg-accent/30",
                  "hover:bg-accent/50"
                )}
                onClick={() => onDateClick && onDateClick(day)}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  isCurrentDay && "text-primary font-bold"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPostClick && onPostClick(post)
                      }}
                      className={cn(
                        "text-xs p-1 rounded truncate cursor-pointer",
                        post.platform === 'twitter' 
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" 
                          : "bg-blue-600/20 text-blue-700 dark:text-blue-300"
                      )}
                      title={post.content}
                    >
                      <div className="flex items-center gap-1">
                        {post.platform === 'twitter' ? (
                          <Twitter className="h-3 w-3" />
                        ) : (
                          <Linkedin className="h-3 w-3" />
                        )}
                        <span className="truncate">{post.content.substring(0, 20)}...</span>
                      </div>
                      <div className="text-[10px] opacity-70 mt-0.5">
                        {format(new Date(post.scheduled_time), 'HH:mm')}
                      </div>
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayPosts.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50"></div>
          <span className="text-muted-foreground">Twitter / X</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-600/20 border border-blue-600/50"></div>
          <span className="text-muted-foreground">LinkedIn</span>
        </div>
      </div>
    </div>
  )
}

