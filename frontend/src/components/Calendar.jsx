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
import { ChevronLeft, ChevronRight, Twitter, Linkedin, Calendar as CalendarIcon, Grid3x3, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDroppable } from '@dnd-kit/core'

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
  DAY: 'day'
}

export default function Calendar({ 
  scheduledPosts = [], 
  onDateClick, 
  onPostClick, 
  onDraftDrop,
  defaultTimeRange = { start: 8, end: 20 }
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState(VIEWS.MONTH)
  const [timeRange] = useState(defaultTimeRange)

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

  const handlePrevious = () => {
    if (view === VIEWS.MONTH) {
      setCurrentDate(subMonths(currentDate, 1))
    } else if (view === VIEWS.WEEK) {
      setCurrentDate(addDays(currentDate, -7))
    } else {
      setCurrentDate(addDays(currentDate, -1))
    }
  }

  const handleNext = () => {
    if (view === VIEWS.MONTH) {
      setCurrentDate(addMonths(currentDate, 1))
    } else if (view === VIEWS.WEEK) {
      setCurrentDate(addDays(currentDate, 7))
    } else {
      setCurrentDate(addDays(currentDate, 1))
    }
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
          "min-h-[80px] sm:min-h-[100px] md:min-h-[120px] border-b border-r last:border-r-0 p-2 sm:p-2.5 md:p-3 cursor-pointer transition-all duration-200",
          !isCurrentMonth && "bg-muted/10 text-muted-foreground",
          isOver && "bg-primary/10 ring-2 ring-primary/50 shadow-md",
          "hover:bg-accent/50 hover:shadow-sm"
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
              className="cursor-pointer hover:shadow-sm transition-all duration-150 border hover:border-foreground/20"
            >
              <CardContent className="p-1.5 sm:p-2">
                <div className="flex items-start gap-1.5 sm:gap-2">
                  {post.platform === 'twitter' ? (
                    <Twitter className="h-2.5 w-2.5 sm:h-3 sm:w-3 mt-0.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Linkedin className="h-2.5 w-2.5 sm:h-3 sm:w-3 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium line-clamp-2 mb-0.5 leading-tight">
                      {post.content}
                    </p>
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] h-3 sm:h-4 px-1 sm:px-1.5">
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
          "min-h-[50px] sm:min-h-[60px] md:min-h-[70px] border-r border-border p-1 sm:p-1.5 transition-all duration-200",
          dayIdx === 6 && "border-r-0",
          isOver && "bg-primary/10 ring-2 ring-primary/50 shadow-inner",
          "hover:bg-accent/40 hover:shadow-sm"
        )}
      >
        {postsForSlot.map((post) => (
          <Card
            key={post.id}
            onClick={(e) => {
              e.stopPropagation()
              onPostClick && onPostClick(post)
            }}
            className="mb-1 sm:mb-1.5 cursor-pointer hover:shadow-sm transition-all duration-150 border hover:border-foreground/20"
          >
            <CardContent className="p-1 sm:p-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {post.platform === 'twitter' ? (
                  <Twitter className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
                ) : (
                  <Linkedin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-[10px] sm:text-xs line-clamp-1 flex-1">{post.content}</span>
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
            "min-h-[80px] sm:min-h-[90px] md:min-h-[100px] p-3 sm:p-3.5 md:p-4 transition-all duration-200",
            isOver && "bg-primary/10 ring-2 ring-primary/50"
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
                        <Twitter className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Linkedin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                      )}
                      <Badge variant="outline" className="text-[10px] sm:text-xs font-medium">
                        {format(new Date(post.scheduled_time), 'HH:mm')}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed line-clamp-3">
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
          </h3>
          <Button variant="outline" size="sm" onClick={handleToday} className="text-xs sm:text-sm">
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Toggle */}
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-8 sm:h-9">
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

          <div className="flex gap-1 sm:gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevious} className="h-8 w-8 sm:h-9 sm:w-9">
              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext} className="h-8 w-8 sm:h-9 sm:w-9">
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            </Button>
          </div>
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

      </div>
    </div>
  )
}
