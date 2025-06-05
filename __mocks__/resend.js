module.exports = {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({}),
      },
    })),
  };
  