import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddEventDialog } from './AddEventDialog'

// Mock the useCreateEvent hook
vi.mock('../hooks/useEvents', () => ({
  useCreateEvent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

describe('AddEventDialog', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('should render the add event button', () => {
    render(<AddEventDialog babyId="test-baby-id" workspaceId="test-workspace-id" />, {
      wrapper,
    })

    // The button should be in the document (it's a fixed position button)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })
})

