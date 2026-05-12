import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import ReviewDetailPage from './ReviewDetailPage';
import { ToastProvider } from '../components/common/Toast';
import { createTestQueryClient } from '../test/createTestQueryClient';

const RID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const getOneMock = vi.hoisted(() => vi.fn());
const retryPendingMock = vi.hoisted(() => vi.fn());

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', username: 'tester' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../context/SocketContext', () => ({
  useSocket: () => ({
    connected: false,
    joinRepo: vi.fn(),
    onReviewUpdate: vi.fn(() => () => {}),
  }),
  SocketProvider: ({ children }) => children,
}));

vi.mock('../api/client', () => ({
  reviewsApi: {
    list: vi.fn(),
    getOne: (...a) => getOneMock(...a),
    getStats: vi.fn(),
    trigger: vi.fn(),
    triggerLatest: vi.fn(),
    retryPending: (...a) => retryPendingMock(...a),
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

const baseReview = {
  id: RID,
  status: 'completed',
  commit_sha: 'deadbeef00000000000000000000000000000000',
  summary: 'Solid change set.',
  overall_score: 90,
  branch: 'main',
  author: 'qa',
  repository_id: 'repo-1',
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  repositories: { full_name: 'org/app', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  review_issues: [],
  review_file_stats: [],
};

function renderDetail() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/reviews/${RID}`]}>
          <Routes>
            <Route path="/reviews/:id" element={<ReviewDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('ReviewDetailPage (user behavior)', () => {
  beforeEach(() => {
    getOneMock.mockReset();
    retryPendingMock.mockReset();
  });

  it('shows not-found messaging when the API returns 404', async () => {
    const err = new Error('Not found');
    err.response = { status: 404 };
    getOneMock.mockRejectedValue(err);

    renderDetail();

    expect(await screen.findByText(/Review not found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all reviews/i })).toBeInTheDocument();
  });

  it('renders review summary and repo when the API succeeds', async () => {
    getOneMock.mockResolvedValue({
      data: { data: { ...baseReview } },
    });

    renderDetail();

    expect(await screen.findByText(/Solid change set\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/analysis summary/i)).toBeInTheDocument();
    expect(screen.getByText('org/app')).toBeInTheDocument();
    expect(screen.getByText('deadbee')).toBeInTheDocument();
    expect(screen.getByText(/Nothing flagged this time/i)).toBeInTheDocument();
  });

  it('calls retry when analysis failed and user clicks Retry analysis', async () => {
    getOneMock.mockResolvedValue({
      data: {
        data: {
          ...baseReview,
          status: 'failed',
          summary: null,
          error_message: 'GitHub timeout',
        },
      },
    });
    retryPendingMock.mockResolvedValue({ data: { success: true } });

    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText(/Analysis pipeline failed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry analysis/i }));
    await waitFor(() => {
      expect(retryPendingMock).toHaveBeenCalledWith(RID);
    });
  });
});
