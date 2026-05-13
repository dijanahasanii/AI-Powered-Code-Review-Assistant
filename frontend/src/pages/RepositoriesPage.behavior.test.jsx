import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import RepositoriesPage from './RepositoriesPage';
import { ToastProvider } from '../components/common/Toast';
import { createTestQueryClient } from '../test/createTestQueryClient';

const reposListMock = vi.hoisted(() => vi.fn());
const reposListGithubMock = vi.hoisted(() => vi.fn());
const reposConnectMock = vi.hoisted(() => vi.fn());

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
  reposApi: {
    list: (...args) => reposListMock(...args),
    listGithub: (...args) => reposListGithubMock(...args),
    connect: (...args) => reposConnectMock(...args),
    disconnect: vi.fn(),
    syncWebhook: vi.fn(),
  },
  reviewsApi: {
    list: vi.fn(),
    getOne: vi.fn(),
    getStats: vi.fn(),
    trigger: vi.fn(),
    triggerLatest: vi.fn(),
    retryPending: vi.fn(),
  },
  authApi: { getMe: vi.fn(), githubCallback: vi.fn() },
  default: {},
}));

function renderRepos() {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/repositories']}>
          <Routes>
            <Route path="/repositories" element={<RepositoriesPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('RepositoriesPage (user behavior)', () => {
  beforeEach(() => {
    reposListMock.mockReset();
    reposListGithubMock.mockReset();
    reposConnectMock.mockReset();
    reposListGithubMock.mockResolvedValue({ data: { data: [] } });
  });

  it('shows repositories error panel when list fails', async () => {
    reposListMock.mockRejectedValue(new Error('boom'));

    renderRepos();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await screen.findByText(/Network error|connected repositories/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    expect(reposListMock).toHaveBeenCalledTimes(2);
  });

  it('shows empty state when user has no connected repos', async () => {
    reposListMock.mockResolvedValue({ data: { data: [], success: true } });

    renderRepos();

    expect(
      await screen.findByRole('heading', { name: /no repositories connected/i })
    ).toBeInTheDocument();
  });

  it('shows repo card when connected list returns data', async () => {
    reposListMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'repo-uuid-1',
            full_name: 'acme/demo',
            github_repo_id: 42,
            is_private: false,
            webhook_active: true,
            language: 'TypeScript',
            code_reviews: [],
          },
        ],
        success: true,
      },
    });

    renderRepos();

    expect(await screen.findByText('acme/demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review latest/i })).toBeInTheDocument();
  });

  it('opens GitHub picker and shows success toast after connect', async () => {
    reposListMock
      .mockResolvedValueOnce({ data: { data: [], success: true } })
      .mockResolvedValue({ data: { data: [], success: true } });

    reposListGithubMock.mockResolvedValue({
      data: {
        data: [
          {
            githubRepoId: 99,
            fullName: 'acme/new-repo',
            name: 'new-repo',
            description: '',
            language: 'JS',
            isPrivate: false,
          },
        ],
      },
    });

    reposConnectMock.mockResolvedValue({
      data: {
        data: {
          id: 'new-id',
          full_name: 'acme/new-repo',
          webhook_active: true,
          github_repo_id: 99,
        },
      },
    });

    const user = userEvent.setup();
    renderRepos();

    await screen.findByRole('heading', { name: /no repositories connected/i });

    await user.click(screen.getByRole('button', { name: /connect repo/i }));
    expect(await screen.findByRole('heading', { name: /pick a repo from github/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /connect acme\/new-repo/i }));

    expect(await screen.findByText('Repository connected')).toBeInTheDocument();
  });
});
