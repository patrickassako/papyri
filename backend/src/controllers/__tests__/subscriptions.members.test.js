jest.mock('../../services/subscriptions.service', () => ({
  getActiveSubscriptionForMember: jest.fn(),
  ensureOwnerMembership: jest.fn(),
  getPlan: jest.fn(),
  computeSubscriptionAmountCents: jest.fn(),
  toMajorAmount: jest.fn(),
}));

jest.mock('../../services/flutterwave.service', () => ({
  isConfigured: jest.fn(),
  initiatePayment: jest.fn(),
  verifyPayment: jest.fn(),
}));

jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

const subscriptionsService = require('../../services/subscriptions.service');
const { supabaseAdmin } = require('../../config/database');
const {
  addMember,
  removeMember,
  updateUsersLimit,
} = require('../subscriptions.controller');

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('subscriptions.controller family member rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addMember rejects non-owner requester', async () => {
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue({
      memberRole: 'member',
      subscription: { id: 'sub-1', users_limit: 3, user_id: 'owner-1' },
    });
    subscriptionsService.ensureOwnerMembership.mockResolvedValue({});

    const req = { user: { id: 'u-1' }, body: { userId: 'u-2' } };
    const res = mockRes();

    await addMember(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'ONLY_OWNER_CAN_ADD_MEMBERS',
    }));
  });

  it('addMember rejects when users_limit is reached', async () => {
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue({
      memberRole: 'owner',
      subscription: { id: 'sub-1', users_limit: 2, user_id: 'owner-1' },
    });
    subscriptionsService.ensureOwnerMembership.mockResolvedValue({});

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'subscription_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 2, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const req = { user: { id: 'owner-1' }, body: { userId: 'u-3' } };
    const res = mockRes();

    await addMember(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'MEMBER_LIMIT_REACHED',
    }));
  });

  it('removeMember blocks removing subscription owner', async () => {
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue({
      memberRole: 'owner',
      subscription: { id: 'sub-1', users_limit: 3, user_id: 'owner-1' },
    });
    subscriptionsService.ensureOwnerMembership.mockResolvedValue({});

    const req = { user: { id: 'owner-1' }, params: { userId: 'owner-1' } };
    const res = mockRes();

    await removeMember(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'OWNER_CANNOT_BE_REMOVED',
    }));
  });

  it('updateUsersLimit rejects values below active members count', async () => {
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue({
      memberRole: 'owner',
      subscription: { id: 'sub-1', users_limit: 5, user_id: 'owner-1', plan_id: 'plan-1', plan_snapshot: {} },
    });
    subscriptionsService.ensureOwnerMembership.mockResolvedValue({});
    subscriptionsService.getPlan.mockResolvedValue({
      includedUsers: 1,
      basePriceCents: 1000,
      extraUserPriceCents: 0,
    });

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'subscription_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 4, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const req = { user: { id: 'owner-1' }, body: { usersLimit: 3 } };
    const res = mockRes();

    await updateUsersLimit(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'USERS_LIMIT_BELOW_ACTIVE_MEMBERS',
    }));
  });
});
