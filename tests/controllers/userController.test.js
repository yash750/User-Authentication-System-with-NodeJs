// Comprehensive tests for user controller routes
jest.mock('../../models/user', () => {
  const User = jest.fn();
  User.findOne = jest.fn();
  User.find = jest.fn();
  User.deleteOne = jest.fn();
  return User;
});

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: jest.fn().mockResolvedValue(true) }
    }))
  };
}, { virtual: true });

// mock mongoose to avoid db connection when app loads
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  Promise: global.Promise,
}));

jest.mock('../../authenticate', () => ({
  verifyUser: jest.fn((req, res, next) => {
    req.user = { firstname: 'John', admin: true, tokens: [], save: jest.fn().mockResolvedValue(true) };
    req.token = '';
    next();
  }),
  verifyAdmin: jest.fn((req, res, next) => {
    if (req.user && req.user.admin) return next();
    return res.status(401).json({ error: 'Admin access required !!' });
  }),
  isVerifiedUser: jest.fn((req, res, next) => next())
}));

jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn(),
}));

const request = require('supertest');
const app = require('../../app');
const User = require('../../models/user');
const auth = require('../../authenticate');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const algorithm = 'aes256';

function generateToken(id, exp) {
  const cipher = crypto.createCipher(algorithm, process.env.secretKey);
  let enc = cipher.update(`${id}.${exp}`, 'utf8', 'hex');
  enc += cipher.final('hex');
  return enc;
}

beforeEach(() => {
  process.env.secretKey = '12345678901234567890123456789012';
  process.env.secretkey = '12345678901234567890123456789012';
  process.env.expire = '60000';
  jest.clearAllMocks();
  User.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true), tokens: [] }));
});

describe('GET /user/test-email', () => {
  it('returns simple message', async () => {
    const res = await request(app).get('/user/test-email');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/EndPoint reached/);
  });
});

describe('GET /user/verify-email', () => {
  it('verifies email with valid token', async () => {
    const save = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValueOnce({ emailToken: 'abc', isVerified: false, save });
    const res = await request(app).get('/user/verify-email?token=abc');
    expect(res.statusCode).toBe(200);
    expect(save).toHaveBeenCalled();
  });

  it('fails with missing token', async () => {
    const res = await request(app).get('/user/verify-email');
    expect(res.statusCode).toBe(401);
  });

  it('fails with invalid token', async () => {
    User.findOne.mockResolvedValueOnce(null);
    const res = await request(app).get('/user/verify-email?token=bad');
    expect(res.statusCode).toBe(401);
  });

  it('handles database error', async () => {
    User.findOne.mockRejectedValueOnce(new Error('db'));
    const res = await request(app).get('/user/verify-email?token=abc');
    expect(res.statusCode).toBe(500);
  });
});

describe('POST /user/login', () => {
  it('logs in successfully', async () => {
    bcrypt.compare.mockImplementationOnce((pw, hash, cb) => cb(null, true));
    const save = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValueOnce({ _id: '1', password: 'hashedPassword', tokens: [], save });
    const res = await request(app)
      .post('/user/login')
      .send({ email: 'john@example.com', password: 'secret' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(save).toHaveBeenCalled();
  });

  it('fails if credentials missing', async () => {
    const res = await request(app)
      .post('/user/login')
      .send({ email: 'john@example.com' });
    expect(res.statusCode).toBe(400);
  });

  it('fails when user not found', async () => {
    User.findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/user/login')
      .send({ email: 'john@example.com', password: 'secret' });
    expect(res.statusCode).toBe(404);
  });

  it('fails on wrong password', async () => {
    bcrypt.compare.mockImplementationOnce((pw, hash, cb) => cb(null, false));
    User.findOne.mockResolvedValueOnce({ _id: '1', password: 'hashedPassword', tokens: [], save: jest.fn() });
    const res = await request(app)
      .post('/user/login')
      .send({ email: 'john@example.com', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  it('handles bcrypt error', async () => {
    bcrypt.compare.mockImplementationOnce((pw, hash, cb) => cb(new Error('err')));
    User.findOne.mockResolvedValueOnce({ _id: '1', password: 'hashedPassword', tokens: [], save: jest.fn() });
    const res = await request(app)
      .post('/user/login')
      .send({ email: 'john@example.com', password: 'secret' });
    expect(res.statusCode).toBe(500);
  });
});

describe('GET /user/logout', () => {
  it('logs out with valid token', async () => {
    auth.verifyUser.mockImplementationOnce((req, res, next) => {
      req.user = { tokens: [], save: jest.fn().mockResolvedValue(true) };
      req.token = 'tok';
      next();
    });
    const res = await request(app).get('/user/logout');
    expect(res.statusCode).toBe(200);
  });

  it('fails with invalid token', async () => {
    auth.verifyUser.mockImplementationOnce((req, res) => res.status(401).json({ error: 'Invalid Token !!' }));
    const res = await request(app).get('/user/logout');
    expect(res.statusCode).toBe(401);
  });

  it('fails when not logged in', async () => {
    auth.verifyUser.mockImplementationOnce((req, res, next) => { next(); });
    const res = await request(app).get('/user/logout');
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /user/dump', () => {
  it('dumps users when admin', async () => {
    auth.verifyUser.mockImplementationOnce((req, res, next) => {
      req.user = { admin: true };
      next();
    });
    User.find.mockImplementationOnce(cb => cb(null, [{ admin: false, remove: jest.fn() }, { admin: true }]));
    const res = await request(app).get('/user/dump');
    expect(res.statusCode).toBe(200);
  });

  it('fails when not admin', async () => {
    auth.verifyUser.mockImplementationOnce((req, res, next) => {
      req.user = { admin: false };
      next();
    });
    const res = await request(app).get('/user/dump');
    expect(res.statusCode).toBe(401);
  });

  it('handles database error', async () => {
    auth.verifyUser.mockImplementationOnce((req, res, next) => {
      req.user = { admin: true };
      next();
    });
    User.find.mockImplementationOnce(cb => cb('err'));
    const res = await request(app).get('/user/dump');
    expect(res.statusCode).toBe(404);
  });
});
