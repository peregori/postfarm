import { useState, useMemo } from 'react'
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

    const { setNodeRef, isOver } = useDroppable({
      id: `calendar-day-${format(day, 'yyyy-MM-dd')}`,
      data: { date: day },
    })

    return (
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[120px] border-b border-r last:border-r-0 p-3 cursor-pointer transition-all",
          !isCurrentMonth && "bg-muted/10 text-muted-foreground",
          isOver && "bg-primary/10 ring-2 ring-primary/50 shadow-md",
          "hover:bg-accent/50 hover:shadow-sm"
        )}
        onClick={() => onDateClick && onDateClick(day)}
      >
        <div className="text-sm font-semibold mb-2">
          <span className={cn(
            "inline-flex items-center justify-center min-w-[28px] h-7",
            isCurrentDay 
              ? "text-primary ring-2 ring-primary rounded-full font-bold" 
              : "text-foreground"
          )}>
            {format(day, 'd')}
          </span>
        </div>
        <div className="space-y-1.5">
          {dayPosts.slice(0, 2).map((post) => (
            <Card
              key={post.id}
              onClick={(e) => {
                e.stopPropagation()
                onPostClick && onPostClick(post)
              }}
              className="cursor-pointer hover:shadow-sm transition-all border hover:border-foreground/20"
            >
              <CardContent className="p-2">
                <div className="flex items-start gap-2">
                  {post.platform === 'twitter' ? (
                    <Twitter className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Linkedin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate mb-0.5">
                      {post.content.substring(0, 25)}
                    </p>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {format(new Date(post.scheduled_time), 'HH:mm')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {dayPosts.length > 2 && (
            <Badge variant="secondary" className="w-full text-xs justify-center">
              +{dayPosts.length - 2} more
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
          "min-h-[70px] border-r border-border p-1.5 transition-all",
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
            className="mb-1.5 cursor-pointer hover:shadow-sm transition-all border hover:border-foreground/20"
          >
            <CardContent className="p-1.5">
              <div className="flex items-center gap-1.5">
                {post.platform === 'twitter' ? (
                  <Twitter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <Linkedin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-xs truncate flex-1">{post.content.substring(0, 12)}</span>
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
        "grid grid-cols-[100px_1fr] border-b border-border hover:bg-muted/10 transition-colors",
        isLast && "border-b-0",
        isOver && "bg-primary/5"
      )}>
        <div className="p-4 text-sm font-semibold text-muted-foreground border-r border-border bg-muted/30 flex items-center justify-end flex-shrink-0">
          {format(setMinutes(setHours(new Date(), hour), 0), 'HH:mm')}
        </div>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[100px] p-4 transition-all",
            isOver && "bg-primary/10 ring-2 ring-primary/50"
          )}
        >
          <div className="space-y-3">
            {postsForSlot.length === 0 ? (
              <div className="text-xs text-muted-foreground/50 italic py-2">
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
                  className="cursor-pointer hover:shadow-md transition-all border hover:border-foreground/30"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {post.platform === 'twitter' ? (
                        <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Linkedin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <Badge variant="outline" className="text-xs font-medium">
                        {format(new Date(post.scheduled_time), 'HH:mm')}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-3">
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
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">
            {view === VIEWS.MONTH && format(currentDate, 'MMMM yyyy')}
            {view === VIEWS.WEEK && weekDays && weekDays.length >= 7 && `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`}
            {view === VIEWS.DAY && format(currentDate, 'MMMM d, yyyy')}
          </h3>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value={VIEWS.MONTH} className="gap-2">
                <Grid3x3 className="h-4 w-4" />
                Month
              </TabsTrigger>
              <TabsTrigger value={VIEWS.WEEK} className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Week
              </TabsTrigger>
              <TabsTrigger value={VIEWS.DAY} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Day
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
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
              <div key={day} className="p-3 text-center text-sm font-semibold text-muted-foreground border-r border-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin grid grid-cols-7 bg-background auto-rows-fr min-h-0">
            {days.map((day, idx) => (
              <MonthDayCell key={idx} day={day} idx={idx} />
            ))}
          </div>
        </div>
      )}

      {view === VIEWS.WEEK && weekDays && weekDays.length >= 7 && (
        <div className="flex flex-col h-full overflow-hidden border border-b-0 rounded-t-lg bg-background">
          <div className="sticky top-0 z-10 grid grid-cols-[120px_repeat(7,1fr)] border-b border-border bg-muted/50 flex-shrink-0">
            <div className="p-3 text-sm font-semibold text-muted-foreground border-r border-border bg-background flex items-center justify-end">
              Time
            </div>
            {weekDays.map((day, idx) => {
              const isCurrentDay = isToday(day)
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "p-3 text-center border-r border-border",
                    idx === 6 && "border-r-0",
                    isCurrentDay 
                      ? "bg-primary/10" 
                      : "bg-background"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium text-muted-foreground mb-1",
                    isCurrentDay && "text-primary"
                  )}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-xl font-bold",
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
                "grid grid-cols-[120px_repeat(7,1fr)] border-b border-border hover:bg-muted/20 transition-colors",
                hourIdx === hours.length - 1 && "border-b-0"
              )}>
                <div className="p-3 text-sm font-medium text-muted-foreground border-r border-border bg-muted/20 flex items-center justify-end">
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
              "p-6 text-center",
              isToday(currentDate) && "bg-primary/10"
            )}>
              <div className={cn(
                "text-xs font-medium text-muted-foreground mb-1",
                isToday(currentDate) && "text-primary"
              )}>
                {format(currentDate, 'EEEE')}
              </div>
              <div className={cn(
                "text-3xl font-bold",
                isToday(currentDate) && "text-primary"
              )}>
                {format(currentDate, 'd')}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
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
