import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import ReviewsPage from './ReviewsPage';
import { createTestQueryClient } from '../test/createTestQueryClient';

const reviewsListMock = vi.hoisted(() => vi.fn());

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', username: 'tester' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../api/client', () => ({
  reviewsApi: {
    list: (...args) => reviewsListMock(...args),
    getOne: vi.fn(),
    getStats: vi.fn(),
    trigger: vi.fn(),
    triggerLatest: vi.fn(),
    retryPending: vi.fn(),
  },
  reposApi: {
    list: vi.fn(),
    listGithub: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    syncWebhook: vi.fn(),
  },
  authApi: { getMe: vi.fn(), githubCallback: vi.fn() },
  default: {},
}));

function renderReviews() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reviews']}>
        <Routes>
          <Route path="/reviews" element={<ReviewsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ReviewsPage (user behavior)', () => {
  beforeEach(() => {
    reviewsListMock.mockReset();
  });

  it('shows loading skeletons then review rows when API succeeds', async () => {
    reviewsListMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                data: {
                  data: [
                    {
                      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                      commit_sha: 'abcdef1234567890abcdef1234567890abcd',
                      status: 'completed',
                      overall_score: 88,
                      branch: 'main',
                      author: 'dev',
                      created_at: new Date().toISOString(),
                      repositories: { full_name: 'org/app' },
                    },
                  ],
                  pagination: { page: 1, limit: 15, total: 1 },
                },
              }),
            15
          );
        })
    );

    renderReviews();

    expect(screen.getByRole('heading', { name: /reviews/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('abcdef1')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Open analysis/i })).toHaveAttribute('href', '/reviews/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('shows friendly error UI with retry when the list request fails', async () => {
    reviewsListMock.mockRejectedValue(new Error('network'));

    renderReviews();

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
    expect(screen.getByText(/No response from the server/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    expect(reviewsListMock).toHaveBeenCalledTimes(2);
  });

  it('shows empty state when there are no reviews', async () => {
    reviewsListMock.mockResolvedValue({
      data: {
        data: [],
        pagination: { page: 1, limit: 15, total: 0 },
      },
    });

    renderReviews();

    expect(await screen.findByRole('heading', { name: /no reviews found/i })).toBeInTheDocument();
  });

  it('changes status filter and refetches (completed)', async () => {
    reviewsListMock.mockResolvedValue({
      data: {
        data: [],
        pagination: { total: 0, page: 1, limit: 15 },
      },
    });

    const user = userEvent.setup();
    renderReviews();

    await screen.findByRole('heading', { name: /no reviews found/i });

    const group = screen.getByRole('group', { name: /filter by status/i });
    await user.click(within(group).getByRole('button', { name: /^completed$/i }));

    await waitFor(() => {
      expect(reviewsListMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', page: 1, limit: 15 })
      );
    });
  });
});
