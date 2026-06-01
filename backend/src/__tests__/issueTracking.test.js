'use strict';

jest.mock('../repositories/repositoryIssuesRepository', () => ({
  listAllByRepositoryId: jest.fn(),
  listActiveByRepositoryId: jest.fn(),
  listByRepositoryIdAndFingerprints: jest.fn(),
  listActiveByRepositoryIds: jest.fn(),
  insertRow: jest.fn(),
  updateById: jest.fn(),
}));

jest.mock('../lib/repositorySyncMutex', () => ({
  withRepositoryIssueSyncLock: (_repoId, fn) => fn(),
}));

const repositoryIssuesRepository = require('../repositories/repositoryIssuesRepository');
const { syncRepositoryIssuesLocked, reconcileRepositoryIssueFingerprints } = require('../services/issueTrackingService');
const { buildIssueFingerprint } = require('../analyzers/issueFingerprint');

const repoId = 'repo-1';
const reviewId = 'review-1';

describe('issueTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryIssuesRepository.listAllByRepositoryId.mockResolvedValue({ data: [], error: null });
  });

  it('Scenario E: incomplete scan does not resolve missing active issues', async () => {
    const activeRow = {
      id: 'issue-a',
      repository_id: repoId,
      fingerprint: buildIssueFingerprint({
        filePath: 'src/old.js',
        category: 'security',
        severity: 'critical',
        matchedRuleSlug: 'secret-literal',
        title: 'Secret',
      }),
      file_path: 'src/old.js',
      severity: 'critical',
      category: 'security',
      title: 'Secret',
      description: 'd',
      status: 'open',
    };

    repositoryIssuesRepository.listActiveByRepositoryId.mockResolvedValue({
      data: [activeRow],
      error: null,
    });
    repositoryIssuesRepository.listByRepositoryIdAndFingerprints.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await syncRepositoryIssuesLocked(repoId, reviewId, [], { scanComplete: false });

    expect(repositoryIssuesRepository.updateById).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'resolved' })
    );
    expect(result.resolvedThisRun).toHaveLength(0);
    expect(result.activeCount).toBe(1);
  });

  it('Scenario A: complete scan resolves issues absent from detection', async () => {
    const fp = buildIssueFingerprint({
      filePath: 'src/stays.js',
      category: 'security',
      matchedRuleSlug: 'x',
      title: 't',
    });
    const activeRow = {
      id: 'issue-stays',
      repository_id: repoId,
      fingerprint: fp,
      file_path: 'src/stays.js',
      severity: 'warning',
      category: 'security',
      title: 't',
      description: 'd',
      status: 'open',
    };
    const goneRow = {
      id: 'issue-gone',
      repository_id: repoId,
      fingerprint: buildIssueFingerprint({
        filePath: 'src/fixed.js',
        category: 'security',
        matchedRuleSlug: 'y',
        title: 'gone',
      }),
      file_path: 'src/fixed.js',
      severity: 'warning',
      category: 'security',
      title: 'gone',
      description: 'd',
      status: 'open',
    };

    repositoryIssuesRepository.listActiveByRepositoryId
      .mockResolvedValueOnce({ data: [activeRow, goneRow], error: null })
      .mockResolvedValueOnce({ data: [activeRow], error: null })
      .mockResolvedValueOnce({ data: [activeRow], error: null });
    repositoryIssuesRepository.listByRepositoryIdAndFingerprints.mockResolvedValue({
      data: [activeRow],
      error: null,
    });
    repositoryIssuesRepository.updateById.mockResolvedValue({ data: {}, error: null });

    const detected = [
      {
        filePath: 'src/stays.js',
        severity: 'warning',
        category: 'security',
        matchedRuleSlug: 'x',
        title: 't',
        description: 'd',
      },
    ];

    const result = await syncRepositoryIssuesLocked(repoId, reviewId, detected, {
      scanComplete: true,
    });

    expect(result.resolvedThisRun).toHaveLength(1);
    expect(result.activeCount).toBe(1);
    expect(repositoryIssuesRepository.updateById).toHaveBeenCalledWith(
      'issue-gone',
      expect.objectContaining({ status: 'resolved' })
    );
  });

  it('reconcile updates legacy fingerprint to canonical', async () => {
    const legacyFp = require('../analyzers/issueFingerprint').buildLegacyIssueFingerprint({
      filePath: 'src/a.js',
      category: 'security',
      severity: 'critical',
      matchedRuleSlug: 'secret-literal',
      title: 'Secret',
    });
    const newFp = buildIssueFingerprint({
      filePath: 'src/a.js',
      category: 'security',
      severity: 'warning',
      matchedRuleSlug: 'secret-literal',
      title: 'Secret',
    });

    repositoryIssuesRepository.listAllByRepositoryId.mockResolvedValue({
      data: [
        {
          id: 'row-1',
          fingerprint: legacyFp,
          file_path: 'src/a.js',
          category: 'security',
          severity: 'critical',
          matched_rule: 'secret-literal',
          title: 'Secret',
          description: 'd',
          status: 'open',
        },
      ],
      error: null,
    });
    repositoryIssuesRepository.listByRepositoryIdAndFingerprints.mockResolvedValue({
      data: [],
      error: null,
    });
    repositoryIssuesRepository.updateById.mockResolvedValue({ data: {}, error: null });

    await reconcileRepositoryIssueFingerprints(repoId);

    expect(repositoryIssuesRepository.updateById).toHaveBeenCalledWith('row-1', {
      fingerprint: newFp,
    });
  });
});
