const jwt = require('jsonwebtoken');
const { getUserFromSocketToken } = require('../utils/socketUserFromToken');

jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

const { supabase } = require('../config/database');

describe('getUserFromSocketToken', () => {
  beforeEach(() => {
    supabase.single.mockReset();
  });

  it('returns null for missing token', async () => {
    expect(await getUserFromSocketToken(null)).toBeNull();
    expect(await getUserFromSocketToken('')).toBeNull();
  });

  it('returns null for invalid JWT', async () => {
    expect(await getUserFromSocketToken('not-a-jwt')).toBeNull();
  });

  it('returns null when user not in database', async () => {
    const token = jwt.sign({ userId: 'gone-user' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    supabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
    expect(await getUserFromSocketToken(token)).toBeNull();
  });

  it('returns user row for valid JWT and existing user', async () => {
    const row = {
      id: 'user-uuid-1',
      github_id: 1,
      username: 'alice',
      email: 'a@ex.com',
      avatar_url: null,
    };
    const token = jwt.sign({ userId: row.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    supabase.single.mockResolvedValueOnce({ data: row, error: null });
    const out = await getUserFromSocketToken(token);
    expect(out).toEqual(row);
  });
});
