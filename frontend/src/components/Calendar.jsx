import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  addDays,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3x3, LayoutGrid, List, Search, Clock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import * as simpleIcons from 'simple-icons'

// Custom hook for dynamic post visibility calculation
function useDynamicPostVisibility(dayPosts, cellRef, options = {}) {
  const { cardHeight = 60, spacing = 6, minVisible = 1, headerHeight = 50 } = options
  const [visibleCount, setVisibleCount] = useState(minVisible)

  useEffect(() => {
    if (!cellRef.current || dayPosts.length === 0) {
      setVisibleCount(minVisible)
      return
    }

    const calculateVisible = () => {
      const cell = cellRef.current
      if (!cell) return

      const cellHeight = cell.offsetHeight
      const availableHeight = cellHeight - headerHeight
      
      if (availableHeight <= 0) {
        setVisibleCount(minVisible)
        return
      }

      let heightUsed = 0
      let count = 0

      for (let i = 0; i < dayPosts.length; i++) {
        const cardHeightWithSpacing = cardHeight + (i > 0 ? spacing : 0)
        if (heightUsed + cardHeightWithSpacing <= availableHeight) {
          heightUsed += cardHeightWithSpacing
          count++
        } else {
          break
        }
      }

      // Always show at least minVisible, but never more than available posts
      setVisibleCount(Math.max(minVisible, Math.min(count || minVisible, dayPosts.length)))
    }

    calculateVisible()

    const resizeObserver = new ResizeObserver(() => {
      calculateVisible()
    })

    resizeObserver.observe(cellRef.current)

    // Also listen to window resize for additional responsiveness
    window.addEventListener('resize', calculateVisible)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', calculateVisible)
    }
  }, [dayPosts.length, cardHeight, spacing, minVisible, headerHeight])

  return visibleCount
}

const VIEWS = {
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  LIST: 'list'
}

// Day View Event Card Component
function DayViewEventCard({ post, top, height, onClick }) {
  let postDate
  const timeStr = post.scheduled_time
  if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
    postDate = new Date(timeStr)
  } else {
    postDate = new Date(timeStr + 'Z')
  }
  const timeDisplay = format(postDate, 'HH:mm')
  
  return (
    <div
      className={cn(
        "w-full rounded-lg border cursor-pointer transition-all duration-200 overflow-hidden z-10 h-full",
        "hover:shadow-sm active:scale-[0.98]",
        post.platform === 'linkedin'
          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40 hover:border-blue-400/60 dark:hover:border-blue-600/40"
          : "bg-slate-100/70 dark:bg-slate-900/35 border-slate-300/75 dark:border-slate-700/55 hover:border-slate-500/75 dark:hover:border-slate-500/55"
      )}
      style={{ minHeight: '32px' }}
      onClick={onClick}
    >
      <div className="p-1 sm:p-1.5 h-full flex flex-col gap-1">
        {/* Top row: Checkmark + time on left, platform icon on right */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <Check className="h-2.5 w-2.5 text-muted-foreground/50" strokeWidth={2.5} />
            <span className="text-[8px] sm:text-[9px] font-medium text-muted-foreground/70 leading-none">
              {timeDisplay}
            </span>
          </div>
          
          {/* Platform Icon */}
          <div className="shrink-0">
            {post.platform === 'twitter' ? (
              <svg
                role="img"
                viewBox="0 0 24 24"
                className="h-3 w-3 shrink-0"
                fill="currentColor"
                style={{ color: '#000000' }}
                preserveAspectRatio="xMidYMid meet"
              >
                <path d={simpleIcons.siX.path} />
              </svg>
            ) : (
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
            )}
          </div>
        </div>
        
        {/* Bottom row: Content text */}
        <p className="text-[10px] sm:text-[11px] font-medium text-foreground leading-tight break-words truncate">
          {post.content}
        </p>
      </div>
    </div>
  )
}

// Day View Time Slot Component
function DayViewTimeSlot({ hour, hourIdx, currentDate, platform, platformPosts, onPostClick, hours }) {
  const slotId = `timeslot-${format(currentDate, 'yyyy-MM-dd')}-${String(hour).padStart(2, '0')}00`
  const { setNodeRef, isOver } = useDroppable({
    id: slotId,
    data: { date: currentDate, hour },
  })
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute left-0 right-0",
        isOver && "bg-primary/5"
      )}
      style={{ 
        top: `${hourIdx * 95}px`, 
        height: '95px',
        pointerEvents: 'auto'
      }}
    >
      {/* Posts for this hour and platform */}
      {(() => {
        const postsInHour = platformPosts.filter(post => {
          let postDate
          const timeStr = post.scheduled_time
          if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
            postDate = new Date(timeStr)
          } else {
            postDate = new Date(timeStr + 'Z')
          }
          return getHours(postDate) === hour
        })
        
        // Sort by minute to stack them properly
        const sortedPosts = [...postsInHour].sort((a, b) => {
          let dateA, dateB
          const timeStrA = a.scheduled_time
          const timeStrB = b.scheduled_time
          if (timeStrA.includes('Z') || timeStrA.match(/[+-]\d{2}:\d{2}$/)) {
            dateA = new Date(timeStrA)
          } else {
            dateA = new Date(timeStrA + 'Z')
          }
          if (timeStrB.includes('Z') || timeStrB.match(/[+-]\d{2}:\d{2}$/)) {
            dateB = new Date(timeStrB)
          } else {
            dateB = new Date(timeStrB + 'Z')
          }
          return getMinutes(dateA) - getMinutes(dateB)
        })
        
        return sortedPosts.map((post, index) => {
          let postDate
          const timeStr = post.scheduled_time
          if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
            postDate = new Date(timeStr)
          } else {
            postDate = new Date(timeStr + 'Z')
          }
          
          const postMinute = getMinutes(postDate)
          // Calculate position: each hour is 95px
          // Stack cards vertically with consistent spacing (same as grid padding = 4px)
          const cardHeight = 40 // Height per card
          const spacing = 4 // Spacing between cards (matches py-1 = 4px)
          const gridPadding = 4 // Top padding from grid (matches py-1 = 4px)
          // Position: start from top padding, then stack cards with spacing
          const topOffset = gridPadding + (index * (cardHeight + spacing))
          
          return (
            <div
              key={post.id}
              className="absolute left-0 right-0 px-1"
              style={{ top: `${topOffset}px`, height: `${cardHeight}px` }}
            >
              <DraggableScheduledPost
                post={post}
                variant="day"
                onClick={(e) => {
                  e.stopPropagation()
                  onPostClick && onPostClick(post)
                }}
              >
                <DayViewEventCard
                  post={post}
                  top={0}
                  height={cardHeight}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPostClick && onPostClick(post)
                  }}
                />
              </DraggableScheduledPost>
            </div>
          )
        })
      })()}
    </div>
  )
}

export default function Calendar({ 
  scheduledPosts = [], 
  onDateClick, 
  onPostClick, 
  onDraftDrop,
  defaultTimeRange = { start: 8, end: 20 },
  drafts = [] // Optional: pass drafts to show draft names in List view
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  // Use localStorage to persist view state across re-renders
  const [view, setView] = useState(() => {
    const savedView = localStorage.getItem('calendar-view')
    return savedView && Object.values(VIEWS).includes(savedView) ? savedView : VIEWS.MONTH
  })
  const [timeRange] = useState(defaultTimeRange)
  
  // Save view to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('calendar-view', view)
  }, [view])
  
  // Debug: Log when scheduledPosts prop changes
  useEffect(() => {
    console.log('Calendar component - scheduledPosts prop changed:', scheduledPosts.length, 'posts')
    const fridayPosts = scheduledPosts.filter(p => {
      const postDate = new Date(p.scheduled_time)
      return format(postDate, 'yyyy-MM-dd') === '2026-01-09'
    })
    if (fridayPosts.length > 0) {
      console.log('Calendar - Friday 9th posts:', fridayPosts.map(p => ({ id: p.id, time: p.scheduled_time, hour: new Date(p.scheduled_time).getHours() })))
    }
  }, [scheduledPosts])
  
  // List view filters
  const [dateFilter, setDateFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Memoize calculations
  const { days, weekDays } = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday = 1
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    const weekDaysArray = eachDayOfInterval({ 
      start: weekStart, 
      end: addDays(weekStart, 6) 
    })

    return {
      days: monthDays,
      weekDays: weekDaysArray
    }
  }, [currentDate])

  // Use useMemo to ensure these functions use latest scheduledPosts
  const getPostsForDate = useCallback((date) => {
    return scheduledPosts.filter(post => {
      // Backend stores times in UTC. If the string doesn't have timezone info,
      // it's UTC and we need to parse it as such. Otherwise, parse normally.
      let postDate
      const timeStr = post.scheduled_time
      if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
        // Has timezone info (Z or +HH:MM), parse normally
        postDate = new Date(timeStr)
      } else {
        // No timezone info - backend returns UTC times, so treat as UTC
        postDate = new Date(timeStr + 'Z')
      }
      // isSameDay compares dates in local time
      return isSameDay(postDate, date)
    })
  }, [scheduledPosts])

  const getPostsForDateAndHour = useCallback((date, hour) => {
    return scheduledPosts.filter(post => {
      // Backend stores times in UTC. If the string doesn't have timezone info,
      // it's UTC and we need to parse it as such. Otherwise, parse normally.
      let postDate
      const timeStr = post.scheduled_time
      if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
        // Has timezone info (Z or +HH:MM), parse normally
        postDate = new Date(timeStr)
      } else {
        // No timezone info - backend returns UTC times, so treat as UTC
        postDate = new Date(timeStr + 'Z')
      }
      // getHours() returns local hours after timezone conversion, which matches the timeslot hour
      return isSameDay(postDate, date) && getHours(postDate) === hour
    })
  }, [scheduledPosts])

  // Get posts for day view grouped by platform
  const getPostsForDateByPlatform = useCallback((date) => {
    const dayPosts = getPostsForDate(date)
    const grouped = {
      twitter: [],
      linkedin: []
    }
    dayPosts.forEach(post => {
      const platform = post.platform || 'twitter'
      if (platform === 'twitter' || platform === 'linkedin') {
        grouped[platform].push(post)
      }
    })
    return grouped
  }, [getPostsForDate])

  // Filter and sort scheduled posts for List View
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = [...scheduledPosts]
    
    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = addDays(today, 1)
      const nextWeek = addDays(today, 7)
      
      filtered = filtered.filter(post => {
        const postDate = new Date(post.scheduled_time)
        switch (dateFilter) {
          case 'today':
            return isSameDay(postDate, today)
          case 'tomorrow':
            return isSameDay(postDate, tomorrow)
          case 'next7days':
            return postDate >= today && postDate < nextWeek
          case 'upcoming':
            return postDate >= today
          case 'past':
            return postDate < today
          default:
            return true
        }
      })
    }
    
    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter(post => post.platform === platformFilter)
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(post => {
        const content = post.content?.toLowerCase() || ''
        return content.includes(query)
      })
    }
    
    // Sort chronologically
    return filtered.sort((a, b) => {
      const dateA = new Date(a.scheduled_time)
      const dateB = new Date(b.scheduled_time)
      return dateA - dateB
    })
  }, [scheduledPosts, dateFilter, platformFilter, searchQuery])

  const handlePrevious = () => {
    if (view === VIEWS.MONTH) {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === VIEWS.WEEK) {
      setCurrentDate(addDays(currentDate, -7))
    } else if (view === VIEWS.DAY) {
      setCurrentDate(addDays(currentDate, -1))
    }
    // List view doesn't need navigation
  }

  const handleNext = () => {
    if (view === VIEWS.MONTH) {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === VIEWS.WEEK) {
      setCurrentDate(addDays(currentDate, 7))
    } else if (view === VIEWS.DAY) {
      setCurrentDate(addDays(currentDate, 1))
    }
    // List view doesn't need navigation
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: timeRange.end - timeRange.start + 1 }, (_, i) => timeRange.start + i)

  // Month View Component
  const MonthDayCell = ({ day, idx }) => {
    const dayPosts = getPostsForDate(day)
    const isCurrentMonth = format(day, 'MM') === format(currentDate, 'MM')
    const isCurrentDay = isToday(day)
    const cellRef = useRef(null)
    
    // Calculate visible posts based on available space
    const visibleCount = useDynamicPostVisibility(dayPosts, cellRef, {
      cardHeight: 52, // Responsive card height estimate
      spacing: 6,
      minVisible: dayPosts.length > 0 ? 1 : 0,
      headerHeight: 40,
    })

    const { setNodeRef, isOver } = useDroppable({
      id: `calendar-day-${format(day, 'yyyy-MM-dd')}`,
      data: { date: day },
    })

    // Combine refs
    const combinedRef = useCallback((node) => {
      setNodeRef(node)
      cellRef.current = node
    }, [setNodeRef])

    const visiblePosts = dayPosts.slice(0, visibleCount)
    const remainingCount = dayPosts.length - visibleCount

    return (
      <div
        ref={combinedRef}
        className={cn(
          "min-h-[80px] sm:min-h-[100px] md:min-h-[120px] border-b border-r last:border-r-0 p-1.5 sm:p-2 md:p-2.5 cursor-pointer transition-all duration-300",
          !isCurrentMonth && "bg-muted/10 text-muted-foreground",
          isOver && "bg-primary/15 ring-2 ring-primary/60 shadow-lg scale-[1.02]",
          "hover:bg-accent/50 hover:shadow-md"
        )}
        onClick={() => onDateClick && onDateClick(day)}
      >
        <div className="text-[10px] sm:text-xs font-semibold mb-0.5 sm:mb-1">
          <span className={cn(
            "inline-flex items-center justify-start min-w-0 h-4 sm:h-5",
            isCurrentDay 
              ? "text-primary ring-2 ring-primary rounded-full font-bold px-1.5 py-0.5" 
              : "text-foreground"
          )}>
            {format(day, 'd')}
          </span>
        </div>
        <div className="space-y-1 sm:space-y-1.5">
          {visiblePosts.map((post) => (
            <DraggableScheduledPost
              key={post.id}
              post={post}
              variant="month"
              itemCount={visiblePosts.length}
              onClick={(e) => {
                e.stopPropagation()
                onPostClick && onPostClick(post)
              }}
            />
          ))}
          {remainingCount > 0 && (
            <Badge variant="secondary" className="w-full text-[10px] sm:text-xs justify-center py-0.5">
              +{remainingCount} more
            </Badge>
          )}
        </div>
      </div>
    )
  }

  // Week View Time Slot Cell
  const WeekTimeSlot = ({ day, hour, dayIdx, hourIdx }) => {
    const postsForSlot = getPostsForDateAndHour(day, hour)
    const slotId = `timeslot-${format(day, 'yyyy-MM-dd')}-${String(hour).padStart(2, '0')}00`

    const { setNodeRef, isOver } = useDroppable({
      id: slotId,
      data: { date: day, hour },
    })

    return (
      <div
        key={`${hour}-${dayIdx}`}
        ref={setNodeRef}
        className={cn(
          "min-h-[50px] border-r border-border p-1 relative transition-all duration-200 overflow-hidden",
          dayIdx === 6 && "border-r-0",
          isOver && "bg-primary/10 ring-1 ring-primary/40",
          "hover:bg-muted/30"
        )}
        style={{ pointerEvents: 'auto' }}
      >
        {postsForSlot.map((post) => (
          <DraggableScheduledPost
            key={post.id}
            post={post}
            variant="week"
            itemCount={postsForSlot.length}
            onClick={(e) => {
              e.stopPropagation()
              onPostClick && onPostClick(post)
            }}
          />
        ))}
      </div>
    )
  }

  // Day View Time Slot
  const DayTimeSlot = ({ hour, isLast = false }) => {
    const postsForSlot = getPostsForDateAndHour(currentDate, hour)
    const slotId = `timeslot-${format(currentDate, 'yyyy-MM-dd')}-${String(hour).padStart(2, '0')}00`

    const { setNodeRef, isOver } = useDroppable({
      id: slotId,
      data: { date: currentDate, hour },
    })

    return (
      <div key={hour} className={cn(
        "grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] md:grid-cols-[100px_1fr] border-b border-border hover:bg-muted/10 transition-colors duration-200",
        isLast && "border-b-0",
        isOver && "bg-primary/5"
      )}>
        <div className="p-3 sm:p-3.5 md:p-4 text-xs sm:text-sm font-semibold text-muted-foreground border-r border-border bg-muted/30 flex items-center justify-end flex-shrink-0">
          {format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}
        </div>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[80px] sm:min-h-[90px] md:min-h-[100px] p-3 sm:p-3.5 md:p-4 transition-all duration-300",
            isOver && "bg-primary/15 ring-2 ring-primary/60 scale-[1.01]"
          )}
          style={{ pointerEvents: 'auto' }}
        >
          <div className="space-y-2 sm:space-y-3">
            {postsForSlot.length === 0 ? (
              <div className="text-[10px] sm:text-xs text-muted-foreground/50 italic py-2">
                No posts scheduled
              </div>
            ) : (
              postsForSlot.map((post) => (
                <DraggableScheduledPost
                  key={post.id}
                  post={post}
                  variant="day"
                  itemCount={postsForSlot.length}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPostClick && onPostClick(post)
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <h3 className="text-sm sm:text-base font-semibold">
            {view === VIEWS.MONTH && format(currentDate, 'MMMM yyyy')}
            {view === VIEWS.WEEK && weekDays && weekDays.length >= 7 && `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`}
            {view === VIEWS.DAY && format(currentDate, 'MMMM d, yyyy')}
            {view === VIEWS.LIST && 'Scheduled Posts'}
          </h3>
          {view !== VIEWS.LIST && (
            <Button variant="outline" size="sm" onClick={handleToday} className="text-xs sm:text-sm">
              Today
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Toggle */}
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-8 sm:h-9">
              <TabsTrigger value={VIEWS.LIST} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <List className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
              <TabsTrigger value={VIEWS.MONTH} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Grid3x3 className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Month</span>
              </TabsTrigger>
              <TabsTrigger value={VIEWS.WEEK} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Week</span>
              </TabsTrigger>
              <TabsTrigger value={VIEWS.DAY} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden sm:inline">Day</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {view !== VIEWS.LIST && (
            <div className="flex gap-1 sm:gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevious} className="h-8 w-8 sm:h-9 sm:w-9">
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8 sm:h-9 sm:w-9">
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 min-h-0">
      {view === VIEWS.MONTH && (
        <div className="flex flex-col h-full overflow-hidden border rounded-lg">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50 flex-shrink-0">
            {weekDayNames.map((day) => (
              <div key={day} className="p-1.5 sm:p-2 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground border-r border-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin grid grid-cols-7 bg-background auto-rows-min min-h-0 transition-all duration-200">
            {days.map((day, idx) => (
              <MonthDayCell key={idx} day={day} idx={idx} />
            ))}
          </div>
        </div>
      )}

      {view === VIEWS.WEEK && weekDays && weekDays.length >= 7 && (
        <div className="flex flex-col h-full overflow-hidden border rounded-lg bg-background">
          <div className="sticky top-0 z-10 grid grid-cols-[50px_repeat(7,1fr)] border-b border-border/60 bg-background flex-shrink-0">
            <div className="p-1.5 text-[10px] font-semibold text-muted-foreground/60 border-r border-border/60 bg-muted/30 flex items-center justify-end">
            </div>
            {weekDays.map((day, idx) => {
              const isCurrentDay = isToday(day)
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "p-2 text-center border-r border-border/60 transition-colors duration-200",
                    idx === 6 && "border-r-0",
                    isCurrentDay 
                      ? "bg-primary/8 border-b-2 border-b-primary" 
                      : "bg-muted/20"
                  )}
                >
                  <div className={cn(
                    "text-[10px] font-medium text-muted-foreground mb-0.5",
                    isCurrentDay && "text-primary font-semibold"
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-base font-bold leading-none",
                    isCurrentDay && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
            {hours.map((hour, hourIdx) => (
              <div key={hour} className={cn(
                "grid grid-cols-[50px_repeat(7,1fr)] border-b border-border",
                hourIdx === hours.length - 1 && "border-b-0"
              )}>
                <div className="p-1.5 text-[10px] font-medium text-muted-foreground/70 border-r border-border bg-muted/20 flex items-center justify-end pr-2">
                  {format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}
                </div>
                {weekDays.map((day, dayIdx) => (
                  <WeekTimeSlot 
                    key={`${hour}-${dayIdx}`}
                    day={day} 
                    hour={hour} 
                    dayIdx={dayIdx}
                    hourIdx={hourIdx}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === VIEWS.DAY && (
        <div className="flex flex-col h-full overflow-hidden border rounded-lg bg-background">
          {/* Day View Content with Timeline and Platform Columns */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {/* Header Row - Sticky */}
            <div className="sticky top-0 z-10 grid grid-cols-[70px_repeat(2,1fr)] border-b border-border bg-muted/50">
              <div className="h-10 border-r border-border bg-muted/30 flex-shrink-0"></div>
              {['twitter', 'linkedin'].map((platform) => (
                <div key={platform} className="h-10 border-r last:border-r-0 border-border flex items-center gap-2 px-2.5">
                  {platform === 'twitter' ? (
                      <svg
                        role="img"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="currentColor"
                        style={{ color: '#000000' }}
                      >
                        <path d={simpleIcons.siX.path} />
                      </svg>
                    ) : (
                      <svg
                        role="img"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="currentColor"
                        style={{ color: '#0A66C2' }}
                      >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  )}
                  <span className="text-xs font-medium text-foreground">
                    {platform === 'twitter' ? 'Twitter/X' : 'LinkedIn'}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid Content */}
            <div className="grid grid-cols-[70px_repeat(2,1fr)] relative" style={{ height: `${hours.length * 95}px` }}>
              {/* Hour lines extending across all columns */}
              {hours.map((hour, hourIdx) => (
                <div 
                  key={hour} 
                  className="absolute left-0 right-0 border-b border-border pointer-events-none" 
                  style={{ top: `${hourIdx * 95}px`, zIndex: 1 }}
                >
                </div>
              ))}

              {/* Timeline Column */}
              <div className="border-r border-border bg-muted/30 relative z-0">
                {hours.map((hour, hourIdx) => (
                  <div 
                    key={hour} 
                    className="absolute left-0 right-0 flex items-center justify-end pr-2 pointer-events-none" 
                    style={{ top: `${hourIdx * 95}px`, height: '95px', zIndex: 2 }}
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Platform Columns */}
              {['twitter', 'linkedin'].map((platform) => {
                const platformPosts = getPostsForDateByPlatform(currentDate)[platform] || []
                return (
                  <div key={platform} className="border-r last:border-r-0 border-border relative z-0">
                    {/* Droppable zones for each hour */}
                    {hours.map((hour, hourIdx) => (
                      <DayViewTimeSlot
                        key={hour}
                        hour={hour}
                        hourIdx={hourIdx}
                        currentDate={currentDate}
                        platform={platform}
                        platformPosts={platformPosts}
                        onPostClick={onPostClick}
                        hours={hours}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {view === VIEWS.LIST && (
        <div className="flex flex-col h-full overflow-hidden border rounded-lg bg-background">
          {/* Filters Section */}
          <div className="flex-shrink-0 border-b border-border bg-muted/40 p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-9 text-xs sm:text-sm border-border bg-background hover:bg-muted/50 shadow-sm">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="next7days">Next 7 Days</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Platform Filter */}
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-9 text-xs sm:text-sm border-border bg-background hover:bg-muted/50 shadow-sm">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Search */}
              <div className="relative sm:col-span-2 lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs sm:text-sm border-border bg-background hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
                />
              </div>
            </div>
          </div>
          
          {filteredAndSortedPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="mb-4 p-3 rounded-full bg-muted/50">
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">No scheduled posts</h3>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                {searchQuery || dateFilter !== 'all' || platformFilter !== 'all' 
                  ? 'No posts match your filters' 
                  : 'Schedule drafts from the sidebar to see them here'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Table Header */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur support-[backdrop-filter]:bg-background/60 border-b border-border/50 flex-shrink-0">
                <div className="grid grid-cols-[1.5fr_1.5fr_2fr] gap-3 sm:gap-4 px-3 sm:px-4 md:px-5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Date & Time
                    </span>
                  </div>
                  <div className="flex items-center justify-start">
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Platform
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Content
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Table Body */}
              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 py-2 bg-muted/30">
                <div className="flex flex-col gap-1.5 px-3 sm:px-4 md:px-5">
                  {filteredAndSortedPosts.map((post) => {
                    // Parse scheduled_time correctly - if no timezone, treat as UTC (backend stores in UTC)
                    let postDate
                    const timeStr = post.scheduled_time
                    if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
                      // Has timezone info, parse normally
                      postDate = new Date(timeStr)
                    } else {
                      // No timezone info - backend returns UTC times, so treat as UTC
                      postDate = new Date(timeStr + 'Z')
                    }
                    const isPast = postDate < new Date()
                    const isToday = isSameDay(postDate, new Date())
                    
                    return (
                      <DraggableScheduledPost
                        key={post.id}
                        post={post}
                        onClick={() => onPostClick && onPostClick(post)}
                      >
                        <div
                          className={cn(
                            "rounded-lg border cursor-pointer transition-all duration-150 overflow-hidden",
                            "hover:shadow-sm active:scale-[0.98]",
                            post.platform === 'linkedin'
                              ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40 hover:border-blue-400/60 dark:hover:border-blue-600/40"
                              : "bg-slate-100/70 dark:bg-slate-900/35 border-slate-300/75 dark:border-slate-700/55 hover:border-slate-500/75 dark:hover:border-slate-500/55",
                            isPast && "opacity-60"
                          )}
                        >
                        <div className="grid grid-cols-[1.5fr_1.5fr_2fr] gap-3 sm:gap-4 py-1.5 px-3 sm:px-4 md:px-5 -ml-px">
                        {/* Date & Time Column */}
                        <div className="flex items-center min-w-0">
                          <div className="flex flex-col gap-0 min-w-0">
                            <span className={cn(
                              "text-xs sm:text-sm font-medium leading-none",
                              isToday && "text-primary font-semibold"
                            )}>
                              {isToday ? 'Today' : format(postDate, 'MMM d, yyyy')}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[10px] sm:text-xs text-muted-foreground">
                                {format(postDate, 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Platform Column */}
                        <div className="flex items-center justify-start">
                          <div className="w-4 flex items-center justify-start">
                            {post.platform === 'twitter' ? (
                              <svg
                                role="img"
                                viewBox="0 0 24 24"
                                className="h-4 w-4 shrink-0"
                                fill="currentColor"
                                style={{ color: '#000000' }}
                                preserveAspectRatio="xMidYMid meet"
                              >
                                <path d={simpleIcons.siX.path} />
                              </svg>
                            ) : (
                              <svg
                                role="img"
                                viewBox="0 0 24 24"
                                className="h-4 w-4 shrink-0"
                                fill="currentColor"
                                style={{ color: '#0A66C2' }}
                                preserveAspectRatio="xMidYMid meet"
                              >
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                        
                        {/* Content Column */}
                        <div className="min-w-0 flex items-center">
                          <p className="text-xs sm:text-sm leading-snug line-clamp-2 text-foreground break-words">
                            {(() => {
                              // Try to get full content from draft if available
                              if (post.draft_id && drafts.length > 0) {
                                const draft = drafts.find(d => d.id === post.draft_id || String(d.id) === String(post.draft_id))
                                if (draft && draft.content) {
                                  return draft.content
                                }
                              }
                              // Fall back to post content
                              return post.content || 'No content'
                            })()}
                          </p>
                        </div>
                        </div>
                        </div>
                      </DraggableScheduledPost>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  )
}

// Unified Scheduled Post Card Component
function ScheduledPostCard({ post, variant = 'default', itemCount = 1, onClick }) {
  // Parse scheduled_time correctly - if no timezone, treat as UTC (backend stores in UTC)
  let postDate
  const timeStr = post.scheduled_time
  if (timeStr.includes('Z') || timeStr.match(/[+-]\d{2}:\d{2}$/)) {
    postDate = new Date(timeStr)
  } else {
    postDate = new Date(timeStr + 'Z')
  }
  const timeDisplay = format(postDate, 'HH:mm')
  
  // Determine size based on variant and item count
  const isCompact = variant === 'month' || variant === 'week' || itemCount > 2
  const isList = variant === 'list'
  
  if (isList) {
    // List view has its own layout, return null here as it's handled separately
    return null
  }

  const cardPadding = isCompact 
    ? 'p-1 sm:p-1.5' 
    : 'p-1.5 sm:p-2'
  const checkmarkSize = isCompact 
    ? 'h-2.5 w-2.5' 
    : 'h-3 w-3'
  const iconSize = isCompact 
    ? 'h-3 w-3' 
    : 'h-3.5 w-3.5'
  const textSize = isCompact 
    ? 'text-[10px] sm:text-[11px]' 
    : 'text-xs sm:text-sm'
  const timeSize = isCompact 
    ? 'text-[8px] sm:text-[9px]' 
    : 'text-[9px] sm:text-[10px]'
  const rowGap = isCompact 
    ? 'gap-1' 
    : 'gap-1 sm:gap-1.5'

  const handleClick = (e) => {
    e?.stopPropagation()
    onClick?.(e)
  }

  return (
    <div
      className={cn(
        "rounded-lg border cursor-pointer transition-all duration-200 overflow-hidden",
        "hover:shadow-sm active:scale-[0.98]",
        post.platform === 'linkedin'
          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40 hover:border-blue-400/60 dark:hover:border-blue-600/40"
          : "bg-slate-100/70 dark:bg-slate-900/35 border-slate-300/75 dark:border-slate-700/55 hover:border-slate-500/75 dark:hover:border-slate-500/55",
        isCompact && "mb-1 last:mb-0"
      )}
      onClick={handleClick}
    >
      <div className={cn(cardPadding, "flex flex-col", rowGap)}>
        {/* Top row: Checkmark + time on left, platform icon on right */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1">
            <Check className={cn("text-muted-foreground/50", checkmarkSize)} strokeWidth={2.5} />
            <span className={cn(timeSize, "font-medium text-muted-foreground/70 leading-none")}>
              {timeDisplay}
            </span>
          </div>
          
          {/* Platform Icon */}
          <div className="shrink-0">
            {post.platform === 'twitter' ? (
              <svg
                role="img"
                viewBox="0 0 24 24"
                className={cn(iconSize, "shrink-0")}
                fill="currentColor"
                style={{ color: '#000000' }}
                preserveAspectRatio="xMidYMid meet"
              >
                <path d={simpleIcons.siX.path} />
              </svg>
            ) : (
              <svg
                role="img"
                viewBox="0 0 24 24"
                className={cn(iconSize, "shrink-0")}
                fill="currentColor"
                style={{ color: '#0A66C2' }}
                preserveAspectRatio="xMidYMid meet"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            )}
          </div>
        </div>
        
        {/* Bottom row: Content text */}
        <p className={cn(
          textSize, 
          "font-medium text-foreground leading-tight break-words truncate"
        )}>
          {post.content}
        </p>
      </div>
    </div>
  )
}

// Draggable Scheduled Post Component
function DraggableScheduledPost({ post, children, onClick, variant, itemCount }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-post-${post.id}`,
    data: { post, type: 'scheduled' },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    willChange: 'transform',
  } : undefined

  const handleClick = (e) => {
    e?.stopPropagation()
    onClick?.(e)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 z-50"
      )}
    >
      {children ? (
        <div onClick={handleClick}>
          {children}
        </div>
      ) : (
        <ScheduledPostCard post={post} variant={variant} itemCount={itemCount} onClick={handleClick} />
      )}
    </div>
  )
}
