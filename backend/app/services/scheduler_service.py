from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from datetime import datetime, timezone, timedelta
import pytz
import asyncio
from app.services.platform_service import PlatformService
from app.database import SessionLocal
from app.models import ScheduledPost, PostStatus
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)

class SchedulerService:
    """Service for managing scheduled posts"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.platform_service = PlatformService()
        self.is_running = False
        self.max_retries = 3  # Maximum number of retry attempts
        self.retry_delays = [300, 900, 3600]  # 5min, 15min, 1hour in seconds
        
    def start(self):
        """Start the scheduler"""
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("Scheduler started")
            # Load existing scheduled posts
            asyncio.create_task(self._load_scheduled_posts())
    
    def stop(self):
        """Stop the scheduler"""
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Scheduler stopped")
    
    async def _load_scheduled_posts(self):
        """Load and schedule existing posts from database"""
        db = SessionLocal()
        try:
            result = db.execute(
                select(ScheduledPost).where(
                    ScheduledPost.status == PostStatus.SCHEDULED,
                    ScheduledPost.scheduled_time > datetime.now(timezone.utc)
                )
            )
            posts = result.scalars().all()
            
            for post in posts:
                self.schedule_post(post, retry_count=0)
            
            logger.info(f"Loaded {len(posts)} scheduled posts")
        finally:
            db.close()
    
    def schedule_post(self, post: ScheduledPost, retry_count: int = 0):
        """Schedule a post for execution"""
        trigger = DateTrigger(run_date=post.scheduled_time)
        
        self.scheduler.add_job(
            self._publish_post,
            trigger=trigger,
            id=f"post_{post.id}_{retry_count}",
            args=[post.id, retry_count],
            replace_existing=True
        )
        logger.info(f"Scheduled post {post.id} for {post.scheduled_time} (retry: {retry_count})")
    
    async def _publish_post(self, post_id: int, retry_count: int = 0):
        """Publish a scheduled post with retry logic"""
        db = SessionLocal()
        try:
            result = db.execute(
                select(ScheduledPost).where(ScheduledPost.id == post_id)
            )
            post = result.scalar_one_or_none()
            
            if not post:
                logger.error(f"Post {post_id} not found")
                return
            
            if post.status != PostStatus.SCHEDULED and post.status != PostStatus.FAILED:
                logger.warning(f"Post {post_id} is not in scheduled/failed status: {post.status}")
                return
            
            try:
                # Publish to platform
                await self.platform_service.publish_post(
                    platform=post.platform.value,
                    content=post.content
                )
                
                # Update status
                post.status = PostStatus.POSTED
                post.posted_at = datetime.now(timezone.utc)
                post.error_message = None  # Clear any previous errors
                db.commit()
                
                logger.info(f"Successfully posted {post_id} to {post.platform.value}")
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to post {post_id} (attempt {retry_count + 1}): {error_msg}")
                
                # Check if we should retry
                if retry_count < self.max_retries:
                    # Calculate retry delay (exponential backoff)
                    delay_seconds = self.retry_delays[min(retry_count, len(self.retry_delays) - 1)]
                    retry_time = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
                    
                    # Update post with error but keep as scheduled for retry
                    post.status = PostStatus.SCHEDULED
                    post.error_message = f"Attempt {retry_count + 1} failed: {error_msg}. Retrying in {delay_seconds}s"
                    post.scheduled_time = retry_time
                    db.commit()
                    
                    # Reschedule for retry with incremented retry count
                    logger.info(f"Rescheduling post {post_id} for retry {retry_count + 1} at {retry_time}")
                    self.schedule_post(post, retry_count=retry_count + 1)
                    
                else:
                    # Max retries reached - move to permanently failed
                    logger.error(f"Post {post_id} failed after {self.max_retries} attempts. Marking as permanently failed.")
                    post.status = PostStatus.FAILED
                    post.error_message = f"Failed after {self.max_retries} retry attempts. Last error: {error_msg}"
                    db.commit()
                    
        finally:
            db.close()
    
    def unschedule_post(self, post_id: int):
        """Remove a scheduled post from the scheduler"""
        try:
            self.scheduler.remove_job(f"post_{post_id}")
            logger.info(f"Unscheduled post {post_id}")
        except:
            pass  # Job might not exist

# Global scheduler instance
scheduler_service = SchedulerService()

