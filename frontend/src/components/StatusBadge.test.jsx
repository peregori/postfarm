import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  describe('returns null for hidden statuses', () => {
    it('returns null when status is undefined', () => {
      const { container } = render(<StatusBadge />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when status is null', () => {
      const { container } = render(<StatusBadge status={null} />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when status is "scheduled"', () => {
      const { container } = render(<StatusBadge status="scheduled" />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null when status is "cancelled"', () => {
      const { container } = render(<StatusBadge status="cancelled" />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('renders for visible statuses', () => {
    it('renders green indicator for "posted" status', () => {
      const { container } = render(<StatusBadge status="posted" />)
      const badge = container.firstChild
      expect(badge).not.toBeNull()
      expect(badge).toHaveClass('bg-green-500')
    })

    it('renders red indicator for "failed" status', () => {
      const { container } = render(<StatusBadge status="failed" />)
      const badge = container.firstChild
      expect(badge).not.toBeNull()
      expect(badge).toHaveClass('bg-red-500')
    })

    it('renders yellow indicator for "publishing" status', () => {
      const { container } = render(<StatusBadge status="publishing" />)
      const badge = container.firstChild
      expect(badge).not.toBeNull()
      expect(badge).toHaveClass('bg-yellow-500')
    })
  })

  describe('size variants', () => {
    it('renders dot size by default', () => {
      const { container } = render(<StatusBadge status="posted" />)
      const badge = container.firstChild
      expect(badge).toHaveClass('w-1.5', 'h-1.5')
      expect(badge.tagName).toBe('SPAN')
      expect(badge.textContent).toBe('')
    })

    it('renders dot size explicitly', () => {
      const { container } = render(<StatusBadge status="posted" size="dot" />)
      const badge = container.firstChild
      expect(badge).toHaveClass('w-1.5', 'h-1.5')
    })

    it('renders sm size with label', () => {
      render(<StatusBadge status="posted" size="sm" />)
      expect(screen.getByText('Posted')).toBeInTheDocument()
    })

    it('renders md size with label', () => {
      render(<StatusBadge status="failed" size="md" />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('sm size has smaller dot than md size', () => {
      const { container: smContainer } = render(<StatusBadge status="posted" size="sm" />)
      const { container: mdContainer } = render(<StatusBadge status="posted" size="md" />)

      // sm has w-1 h-1 dot inside
      const smDot = smContainer.querySelector('.w-1')
      expect(smDot).toBeInTheDocument()

      // md has w-1.5 h-1.5 dot inside
      const mdDot = mdContainer.querySelector('.w-1\\.5')
      expect(mdDot).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('dot size has title attribute for tooltip', () => {
      const { container } = render(<StatusBadge status="posted" size="dot" />)
      const badge = container.firstChild
      expect(badge).toHaveAttribute('title', 'Posted')
    })

    it('dot size shows "Failed" title for failed status', () => {
      const { container } = render(<StatusBadge status="failed" size="dot" />)
      const badge = container.firstChild
      expect(badge).toHaveAttribute('title', 'Failed')
    })

    it('dot size shows "Publishing" title for publishing status', () => {
      const { container } = render(<StatusBadge status="publishing" size="dot" />)
      const badge = container.firstChild
      expect(badge).toHaveAttribute('title', 'Publishing')
    })
  })

  describe('correct label text', () => {
    it('shows "Posted" for posted status', () => {
      render(<StatusBadge status="posted" size="md" />)
      expect(screen.getByText('Posted')).toBeInTheDocument()
    })

    it('shows "Failed" for failed status', () => {
      render(<StatusBadge status="failed" size="md" />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('shows "Publishing" for publishing status', () => {
      render(<StatusBadge status="publishing" size="md" />)
      expect(screen.getByText('Publishing')).toBeInTheDocument()
    })
  })

  describe('returns null for unknown statuses', () => {
    it('returns null for unknown status string', () => {
      const { container } = render(<StatusBadge status="unknown" />)
      expect(container.firstChild).toBeNull()
    })

    it('returns null for empty string', () => {
      const { container } = render(<StatusBadge status="" />)
      expect(container.firstChild).toBeNull()
    })
  })
})
