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
  setHours,
  setMinutes,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Grid3x3, LayoutGrid, List, Search, Clock } from 'lucide-react'
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
import { useDroppable } from '@dnd-kit/core'
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

export default function Calendar({ 
  scheduledPosts = [], 
  onDateClick, 
  onPostClick, 
  onDraftDrop,
  defaultTimeRange = { start: 8, end: 20 },
  drafts = [] // Optional: pass drafts to show draft names in List view
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState(VIEWS.MONTH)
  const [timeRange] = useState(defaultTimeRange)
  
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

  const getPostsForDate = (date) => {
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduled_time)
      return isSameDay(postDate, date)
    })
  }

  const getPostsForDateAndHour = (date, hour) => {
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduled_time)
      return isSameDay(postDate, date) && getHours(postDate) === hour
    })
  }

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
          "min-h-[80px] sm:min-h-[100px] md:min-h-[120px] border-b border-r last:border-r-0 p-2 sm:p-2.5 md:p-3 cursor-pointer transition-all duration-300",
          !isCurrentMonth && "bg-muted/10 text-muted-foreground",
          isOver && "bg-primary/15 ring-2 ring-primary/60 shadow-lg scale-[1.02]",
          "hover:bg-accent/50 hover:shadow-md"
        )}
        onClick={() => onDateClick && onDateClick(day)}
      >
        <div className="text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">
          <span className={cn(
            "inline-flex items-center justify-center min-w-[24px] sm:min-w-[28px] h-6 sm:h-7",
            isCurrentDay 
              ? "text-primary ring-2 ring-primary rounded-full font-bold" 
              : "text-foreground"
          )}>
            {format(day, 'd')}
          </span>
        </div>
        <div className="space-y-1 sm:space-y-1.5">
          {visiblePosts.map((post) => (
            <Card
              key={post.id}
              onClick={(e) => {
                e.stopPropagation()
                onPostClick && onPostClick(post)
              }}
              className="cursor-pointer hover:shadow-md transition-all duration-200 border hover:border-foreground/30 active:scale-[0.98]"
            >
              <CardContent className="p-1.5 sm:p-2">
                <div className="flex items-start gap-1.5 sm:gap-1.5">
                  {post.platform === 'twitter' ? (
                    <svg
                      role="img"
                      viewBox="0 0 24 24"
                      className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 mt-0.5"
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
                      className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 mt-0.5"
                      fill="currentColor"
                      style={{ color: '#0A66C2' }}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium line-clamp-2 mb-1 leading-tight break-words">
                      {post.content}
                    </p>
                    <Badge variant="outline" className="text-[8px] sm:text-[9px] h-3 sm:h-3.5 px-1 sm:px-1.5 font-medium">
                      {format(new Date(post.scheduled_time), 'HH:mm')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
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
          "min-h-[50px] sm:min-h-[60px] md:min-h-[70px] border-r border-border p-1 sm:p-1.5 transition-all duration-300",
          dayIdx === 6 && "border-r-0",
          isOver && "bg-primary/15 ring-2 ring-primary/60 shadow-inner scale-[1.02]",
          "hover:bg-accent/40 hover:shadow-md"
        )}
      >
        {postsForSlot.map((post) => (
          <Card
            key={post.id}
            onClick={(e) => {
              e.stopPropagation()
              onPostClick && onPostClick(post)
            }}
            className="mb-1 sm:mb-1.5 cursor-pointer hover:shadow-md transition-all duration-200 border hover:border-foreground/30 active:scale-[0.98]"
          >
            <CardContent className="p-1 sm:p-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {post.platform === 'twitter' ? (
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0"
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
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0"
                    fill="currentColor"
                    style={{ color: '#0A66C2' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                )}
                <span className="text-[10px] sm:text-xs line-clamp-1 flex-1 break-words">{post.content}</span>
              </div>
            </CardContent>
          </Card>
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
        >
          <div className="space-y-2 sm:space-y-3">
            {postsForSlot.length === 0 ? (
              <div className="text-[10px] sm:text-xs text-muted-foreground/50 italic py-2">
                No posts scheduled
              </div>
            ) : (
              postsForSlot.map((post) => (
                <Card
                  key={post.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPostClick && onPostClick(post)
                  }}
                  className="cursor-pointer hover:shadow-md transition-all duration-150 border hover:border-foreground/30"
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                      {post.platform === 'twitter' ? (
                        <svg
                          role="img"
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0"
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
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0"
                          fill="currentColor"
                          style={{ color: '#0A66C2' }}
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      )}
                      <Badge variant="outline" className="text-[10px] sm:text-xs font-medium">
                        {format(new Date(post.scheduled_time), 'HH:mm')}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed line-clamp-3 break-words">
                      {post.content}
                    </p>
                  </CardContent>
                </Card>
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
              <div key={day} className="p-2 sm:p-2.5 md:p-3 text-center text-xs sm:text-sm font-semibold text-muted-foreground border-r border-border last:border-r-0">
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
        <div className="flex flex-col h-full overflow-hidden border border-b-0 rounded-t-lg bg-background">
          <div className="sticky top-0 z-10 grid grid-cols-[80px_repeat(7,1fr)] sm:grid-cols-[100px_repeat(7,1fr)] md:grid-cols-[120px_repeat(7,1fr)] lg:grid-cols-[140px_repeat(7,1fr)] border-b border-border bg-muted/50 flex-shrink-0 transition-all duration-200">
            <div className="p-2 sm:p-2.5 md:p-3 text-xs sm:text-sm font-semibold text-muted-foreground border-r border-border bg-background flex items-center justify-end">
              Time
            </div>
            {weekDays.map((day, idx) => {
              const isCurrentDay = isToday(day)
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "p-2 sm:p-2.5 md:p-3 text-center border-r border-border transition-colors duration-200",
                    idx === 6 && "border-r-0",
                    isCurrentDay 
                      ? "bg-primary/10" 
                      : "bg-background"
                  )}
                >
                  <div className={cn(
                    "text-[10px] sm:text-xs font-medium text-muted-foreground mb-0.5 sm:mb-1",
                    isCurrentDay && "text-primary"
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-lg sm:text-xl font-bold",
                    isCurrentDay && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 border-b rounded-b-lg">
            {hours.map((hour, hourIdx) => (
              <div key={hour} className={cn(
                "grid grid-cols-[80px_repeat(7,1fr)] sm:grid-cols-[100px_repeat(7,1fr)] md:grid-cols-[120px_repeat(7,1fr)] lg:grid-cols-[140px_repeat(7,1fr)] border-b border-border hover:bg-muted/20 transition-colors duration-200",
                hourIdx === hours.length - 1 && "border-b-0"
              )}>
                <div className="p-2 sm:p-2.5 md:p-3 text-xs sm:text-sm font-medium text-muted-foreground border-r border-border bg-muted/20 flex items-center justify-end">
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
        <div className="flex flex-col h-full overflow-hidden border border-b-0 rounded-t-lg bg-background">
          <div className="sticky top-0 z-10 border-b border-border bg-muted/50 flex-shrink-0">
            <div className={cn(
              "p-4 sm:p-5 md:p-6 text-center transition-colors duration-200",
              isToday(currentDate) && "bg-primary/10"
            )}>
              <div className={cn(
                "text-xs font-medium text-muted-foreground mb-1",
                isToday(currentDate) && "text-primary"
              )}>
                {format(currentDate, 'EEEE')}
              </div>
              <div className={cn(
                "text-2xl sm:text-3xl font-bold",
                isToday(currentDate) && "text-primary"
              )}>
                {format(currentDate, 'd')}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                {format(currentDate, 'MMMM yyyy')}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 border-b rounded-b-lg">
            {hours.map((hour, hourIdx) => (
              <DayTimeSlot key={hour} hour={hour} isLast={hourIdx === hours.length - 1} />
            ))}
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
            <div className="flex flex-col h-full overflow-hidden">
              {/* Table Header */}
              <div className="sticky top-0 z-10 bg-muted/30 border-b border-border/50 flex-shrink-0">
                <div className="grid grid-cols-[1.5fr_1.5fr_2fr] gap-3 sm:gap-4 px-4 sm:px-5 md:px-6 py-2.5">
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
              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
                <div className="divide-y divide-border">
                  {filteredAndSortedPosts.map((post) => {
                    const postDate = new Date(post.scheduled_time)
                    const isPast = postDate < new Date()
                    const isToday = isSameDay(postDate, new Date())
                    
                    return (
                      <div
                        key={post.id}
                        onClick={() => onPostClick && onPostClick(post)}
                        className={cn(
                          "grid grid-cols-[1.5fr_1.5fr_2fr] gap-3 sm:gap-4 px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 cursor-pointer transition-all duration-150 hover:bg-accent/50 border-b border-border/50",
                          isPast && "opacity-60"
                        )}
                      >
                        {/* Date & Time Column */}
                        <div className="flex items-center min-w-0">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className={cn(
                              "text-xs sm:text-sm font-medium leading-tight",
                              isToday && "text-primary font-semibold"
                            )}>
                              {isToday ? 'Today' : format(postDate, 'MMM d, yyyy')}
                            </span>
                            <div className="flex items-center gap-1">
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
                          <p className="text-xs sm:text-sm leading-relaxed line-clamp-2 text-foreground break-words">
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
