import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { attachApiContractGuard } from './contractGuard';

describe('attachApiContractGuard', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    warn.mockClear();
  });

  it('does not modify successful responses', async () => {
    const client = axios.create();
    attachApiContractGuard(client);
    const payload = {
      success: true,
      data: [{ id: '1' }],
    };
    client.interceptors.response.handlers[0].fulfilled({
      config: { url: '/api/repos', method: 'get' },
      data: payload,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on obvious stats shape drift without throwing', async () => {
    const client = axios.create();
    attachApiContractGuard(client);
    client.interceptors.response.handlers[0].fulfilled({
      config: { url: '/api/reviews/stats', method: 'get' },
      data: { notData: true },
    });
    expect(warn).toHaveBeenCalled();
  });
});
