jest.mock('../../services/content-access.service', () => ({
  resolveContentAccess: jest.fn(),
}));

const { resolveContentAccess } = require('../../services/content-access.service');
const {
  resolveContentAccessContext,
  requireReadableContent,
} = require('../contentAccess');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('contentAccess middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolveContentAccessContext returns 401 when unauthenticated', async () => {
    const req = { user: null, params: { id: 'c-1' } };
    const res = mockRes();
    const next = jest.fn();

    await resolveContentAccessContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('resolveContentAccessContext attaches context and calls next', async () => {
    const req = { user: { id: 'u-1' }, params: { id: 'c-1' } };
    const res = mockRes();
    const next = jest.fn();

    resolveContentAccess.mockResolvedValue({
      access: { can_read: true },
      content: { id: 'c-1' },
    });

    await resolveContentAccessContext(req, res, next);

    expect(req.contentAccessContext).toBeTruthy();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireReadableContent returns 403 for NO_ACTIVE_SUBSCRIPTION', () => {
    const req = {
      contentAccessContext: {
        access: {
          can_read: false,
          denial: { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'subscription required' },
          content_id: 'c-1',
          access_type: 'subscription',
          has_active_subscription: false,
          is_purchasable: false,
          pricing: { currency: 'USD', base_price_cents: 0, discount_percent: 0, final_price_cents: 0 },
        },
      },
    };
    const res = mockRes();
    const next = jest.fn();

    requireReadableContent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireReadableContent returns 402 for payment-required lock', () => {
    const req = {
      contentAccessContext: {
        access: {
          can_read: false,
          denial: { code: 'CONTENT_LOCKED_PAYMENT_REQUIRED', message: 'payment required' },
          content_id: 'c-2',
          access_type: 'paid',
          has_active_subscription: false,
          is_purchasable: true,
          pricing: { currency: 'USD', base_price_cents: 1000, discount_percent: 0, final_price_cents: 1000 },
        },
      },
    };
    const res = mockRes();
    const next = jest.fn();

    requireReadableContent(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireReadableContent calls next when access is granted', () => {
    const req = {
      contentAccessContext: {
        access: { can_read: true },
      },
    };
    const res = mockRes();
    const next = jest.fn();

    requireReadableContent(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
