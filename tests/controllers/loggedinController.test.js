// Tests for protected route
jest.mock('../../authenticate', () => ({
  verifyUser: jest.fn((req, res, next) => {
    req.user = { firstname: 'John' };
    next();
  }),
  isVerifiedUser: jest.fn((req, res, next) => next()),
  verifyAdmin: jest.fn((req, res, next) => next())
}));

jest.mock('../../models/user', () => jest.fn());
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: jest.fn() } }))
}), { virtual: true });
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  Promise: global.Promise,
}));

const request = require('supertest');
const app = require('../../app');
const auth = require('../../authenticate');

describe('GET /home/index', () => {
  it('returns welcome message when authenticated', async () => {
    const res = await request(app).get('/home/index');
    expect(res.statusCode).toBe(200);
    expect(res.body.msg).toMatch(/Welcome John/i);
  });

  it('returns unauthorized when middleware denies', async () => {
    auth.verifyUser.mockImplementationOnce((req, res) => res.status(401).json({ error: 'Unauthorized !!' }));
    const res = await request(app).get('/home/index');
    expect(res.statusCode).toBe(401);
  });
});
