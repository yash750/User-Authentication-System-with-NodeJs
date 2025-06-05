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
  });
});

afterAll(async () => {
  await User.deleteOne({ email: "testuser@example.com" }); // cleanup test user
  await mongoose.connection.close();
});

describe("POST /user/signup", () => {
  it("should register a new user successfully", async () => {
    const res = await request(app)
      .post("/user/signup")
      .send({
        firstname: "Test",
        lastname: "User",
        email: "testuser@example.com",
        password: "test1234"
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.msg).toMatch(/User Registration Successfull. Please check your email for verification link. !!/i);
  });

  it("should fail if email is missing", async () => {
    const res = await request(app)
      .post("/user/signup")
      .send({
        firstname: "Test",
        lastname: "User",
        password: "test1234"
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.msg).toMatch(/Either email or password field is empty/i);
  });
});
