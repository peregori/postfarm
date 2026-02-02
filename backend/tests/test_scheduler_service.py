"""
Tests for the scheduler service - scheduled job execution.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, AsyncMock, patch
from app.services.scheduler_service import SchedulerService, ScheduledPostData
from app.models import ScheduledPost, PostStatus, PlatformType


class TestSchedulerService:
    """Tests for SchedulerService class."""

    @pytest.fixture
    def scheduler_service(self):
        """Create a fresh scheduler service for each test."""
        service = SchedulerService()
        yield service
        # Don't try to stop if not properly started

    @pytest.fixture
    def mock_scheduled_post(self):
        """Create a mock scheduled post data object."""
        return ScheduledPostData(
            id="test-post-123",
            scheduled_time=datetime.now(timezone.utc) + timedelta(hours=1),
            platform=PlatformType.TWITTER,
            content="Test tweet content",
            user_id="user-789",
        )

    def test_scheduler_init(self, scheduler_service):
        """Test scheduler initializes correctly."""
        assert scheduler_service.scheduler is not None
        assert scheduler_service.is_running is False
        assert scheduler_service.max_retries == 3
        assert len(scheduler_service.retry_delays) == 3

    def test_scheduler_stop(self, scheduler_service):
        """Test scheduler stops correctly."""
        scheduler_service.is_running = True
        with patch.object(scheduler_service.scheduler, 'shutdown'):
            scheduler_service.stop()
            assert scheduler_service.is_running is False

    def test_schedule_post_adds_job(self, scheduler_service, mock_scheduled_post):
        """Test scheduling a post adds a job to the scheduler."""
        with patch.object(scheduler_service.scheduler, 'add_job') as mock_add_job:
            scheduler_service.schedule_post(mock_scheduled_post, retry_count=0)

            mock_add_job.assert_called_once()
            call_kwargs = mock_add_job.call_args
            assert call_kwargs.kwargs['id'] == f"post_{mock_scheduled_post.id}_0"
            assert call_kwargs.kwargs['args'] == [mock_scheduled_post.id, 0]

    def test_schedule_post_with_retry_count(self, scheduler_service, mock_scheduled_post):
        """Test scheduling a post with retry count."""
        with patch.object(scheduler_service.scheduler, 'add_job') as mock_add_job:
            scheduler_service.schedule_post(mock_scheduled_post, retry_count=2)

            call_kwargs = mock_add_job.call_args
            assert call_kwargs.kwargs['id'] == f"post_{mock_scheduled_post.id}_2"
            assert call_kwargs.kwargs['args'] == [mock_scheduled_post.id, 2]

    def test_unschedule_post_removes_job(self, scheduler_service):
        """Test unscheduling a post removes the job."""
        with patch.object(scheduler_service.scheduler, 'remove_job') as mock_remove:
            scheduler_service.unschedule_post("test-post-123")
            mock_remove.assert_called_once_with("post_test-post-123")

    def test_unschedule_post_handles_missing_job(self, scheduler_service):
        """Test unscheduling a non-existent post doesn't raise."""
        with patch.object(scheduler_service.scheduler, 'remove_job', side_effect=Exception("Job not found")):
            # Should not raise
            scheduler_service.unschedule_post("nonexistent-post")

    def test_unschedule_post_handles_int_id(self, scheduler_service):
        """Test unscheduling works with integer post IDs (SQLite)."""
        with patch.object(scheduler_service.scheduler, 'remove_job') as mock_remove:
            scheduler_service.unschedule_post(123)
            mock_remove.assert_called_once_with("post_123")

    def test_unschedule_post_handles_uuid_id(self, scheduler_service):
        """Test unscheduling works with UUID post IDs (Supabase)."""
        uuid_id = "550e8400-e29b-41d4-a716-446655440000"
        with patch.object(scheduler_service.scheduler, 'remove_job') as mock_remove:
            scheduler_service.unschedule_post(uuid_id)
            mock_remove.assert_called_once_with(f"post_{uuid_id}")


class TestSchedulerServiceLoadPosts:
    """Tests for loading scheduled posts on startup."""

    @pytest.fixture
    def scheduler_service(self):
        """Create a fresh scheduler service for each test."""
        service = SchedulerService()
        yield service
        if service.is_running:
            service.stop()

    @pytest.mark.asyncio
    async def test_load_scheduled_posts_sqlite(self, scheduler_service):
        """Test loading posts from SQLite."""
        mock_post = Mock()
        mock_post.id = 1
        mock_post.draft_id = 1
        mock_post.platform = PlatformType.TWITTER
        mock_post.content = "Test content"
        mock_post.scheduled_time = datetime.now(timezone.utc) + timedelta(hours=1)
        mock_post.status = PostStatus.SCHEDULED
        mock_post.user_id = None

        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [mock_post]

        mock_db = Mock()
        mock_db.execute.return_value = mock_result

        with patch('app.services.scheduler_service.settings') as mock_settings:
            mock_settings.USE_SUPABASE = False
            with patch('app.services.scheduler_service.SessionLocal', return_value=mock_db):
                with patch.object(scheduler_service, 'schedule_post') as mock_schedule:
                    await scheduler_service._load_scheduled_posts()
                    mock_schedule.assert_called_once_with(mock_post, retry_count=0)

    @pytest.mark.asyncio
    async def test_load_scheduled_posts_supabase(self, scheduler_service):
        """Test loading posts from Supabase."""
        future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        mock_posts = [
            {
                "id": "uuid-123",
                "draft_id": "draft-uuid-456",
                "platform": "twitter",
                "content": "Test content",
                "scheduled_time": future_time,
                "status": "scheduled",
                "user_id": "user-789"
            }
        ]

        mock_repo = Mock()
        mock_repo.get_all_scheduled = AsyncMock(return_value=mock_posts)

        with patch('app.services.scheduler_service.settings') as mock_settings:
            mock_settings.USE_SUPABASE = True
            with patch('app.database_supabase.ScheduledPostRepository', return_value=mock_repo):
                with patch.object(scheduler_service, 'schedule_post') as mock_schedule:
                    await scheduler_service._load_scheduled_posts()
                    assert mock_schedule.call_count == 1

    @pytest.mark.asyncio
    async def test_load_scheduled_posts_skips_past_posts(self, scheduler_service):
        """Test that past posts are not scheduled."""
        past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        mock_posts = [
            {
                "id": "uuid-123",
                "draft_id": "draft-uuid-456",
                "platform": "twitter",
                "content": "Past content",
                "scheduled_time": past_time,
                "status": "scheduled",
                "user_id": "user-789"
            }
        ]

        mock_repo = Mock()
        mock_repo.get_all_scheduled = AsyncMock(return_value=mock_posts)

        with patch('app.services.scheduler_service.settings') as mock_settings:
            mock_settings.USE_SUPABASE = True
            with patch('app.database_supabase.ScheduledPostRepository', return_value=mock_repo):
                with patch.object(scheduler_service, 'schedule_post') as mock_schedule:
                    await scheduler_service._load_scheduled_posts()
                    mock_schedule.assert_not_called()

    @pytest.mark.asyncio
    async def test_load_scheduled_posts_handles_errors(self, scheduler_service):
        """Test that errors during load are handled gracefully."""
        mock_repo = Mock()
        mock_repo.get_all_scheduled = AsyncMock(side_effect=Exception("Database error"))

        with patch('app.services.scheduler_service.settings') as mock_settings:
            mock_settings.USE_SUPABASE = True
            with patch('app.database_supabase.ScheduledPostRepository', return_value=mock_repo):
                # Should not raise
                await scheduler_service._load_scheduled_posts()


class TestScheduledPostRepository:
    """Tests for ScheduledPostRepository.get_all_scheduled method."""

    @pytest.mark.asyncio
    async def test_get_all_scheduled_returns_scheduled_posts(self, mock_supabase_client):
        """Test get_all_scheduled returns only scheduled posts."""
        from app.database_supabase import ScheduledPostRepository

        mock_posts = [
            {"id": "1", "status": "scheduled", "scheduled_time": "2025-01-01T10:00:00Z"},
            {"id": "2", "status": "scheduled", "scheduled_time": "2025-01-01T11:00:00Z"},
        ]

        mock_response = Mock()
        mock_response.data = mock_posts
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_response

        repo = ScheduledPostRepository(client=mock_supabase_client)
        result = await repo.get_all_scheduled()

        assert result == mock_posts
        mock_supabase_client.table.assert_called_with("scheduled_posts")

    @pytest.mark.asyncio
    async def test_get_all_scheduled_filters_by_status(self, mock_supabase_client):
        """Test get_all_scheduled filters by scheduled status."""
        from app.database_supabase import ScheduledPostRepository

        mock_response = Mock()
        mock_response.data = []
        mock_supabase_client.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_response

        repo = ScheduledPostRepository(client=mock_supabase_client)
        await repo.get_all_scheduled()

        # Verify eq was called with status filter
        mock_supabase_client.table.return_value.select.return_value.eq.assert_called_with("status", "scheduled")
