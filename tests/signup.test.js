jest.mock('resend'); // ✅ Mock "resend" mail service

const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/user");

// ✅ Set global timeout for this test suite
jest.setTimeout(5000); // 10 seconds

beforeAll(async () => {
  process.env.RESEND_API_KEY = "FAKE_KEY"; // dummy key
  await mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })});

// Updated signup tests using mocks
jest.mock('@sendgrid/mail');

jest.mock('../models/user', () => {
  const m = jest.fn();
  m.findOne = jest.fn();
  m.deleteOne = jest.fn();
  m.find = jest.fn();
  return m;
});

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: jest.fn().mockResolvedValue(true) }
    }))
  };
}, { virtual: true });

// avoid real mongoose connection
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(true),
  Promise: global.Promise,
}));

jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const User = require('../models/user');
const bcrypt = require('bcrypt');

beforeEach(() => {
  process.env.secretKey = '12345678901234567890123456789012';
  process.env.secretkey = '12345678901234567890123456789012';
  process.env.expire = '60000';
  process.env.RESEND_API_KEY = 'test';
  jest.clearAllMocks();
  User.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true) }));
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('POST /user/signup', () => {
  it('should register a new user successfully', async () => {
    User.findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/user/signup')
      .send({ firstname: 'Test', lastname: 'User', email: 'test@example.com', password: 'test1234' });

    expect(res.statusCode).toBe(201);
    expect(res.body.msg).toMatch(/User Registration Successfull/i);
    expect(User).toHaveBeenCalled();
  });

  it('should fail if email is missing', async () => {
    const res = await request(app)
      .post('/user/signup')
      .send({ firstname: 'Test', lastname: 'User', password: 'test1234' });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toMatch(/Either email or password field is empty/i);
  });

});
