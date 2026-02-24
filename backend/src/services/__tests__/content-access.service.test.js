jest.mock('../contents.service', () => ({
  getContentByIdForUnlock: jest.fn(),
  getUserContentUnlock: jest.fn(),
}));

jest.mock('../subscriptions.service', () => ({
  getActiveSubscriptionForMember: jest.fn(),
}));

const contentsService = require('../contents.service');
const subscriptionsService = require('../subscriptions.service');
const { resolveContentAccess } = require('../content-access.service');

describe('content-access.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires unlock for subscription content even when user has active subscription', async () => {
    contentsService.getContentByIdForUnlock.mockResolvedValue({
      id: 'c-1',
      access_type: 'subscription',
      is_purchasable: false,
      price_cents: 0,
      price_currency: 'USD',
      subscription_discount_percent: 30,
    });
    contentsService.getUserContentUnlock.mockResolvedValue(null);
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue({
      subscription: { id: 'sub-1' },
      memberRole: 'owner',
    });

    const result = await resolveContentAccess({
      userId: 'u-1',
      contentId: 'c-1',
    });

    expect(result.access.can_read).toBe(false);
    expect(result.access.denial.code).toBe('SUBSCRIPTION_UNLOCK_REQUIRED');
    expect(result.access.has_active_subscription).toBe(true);
  });

  it('returns payment required denial for paid content without unlock or subscription', async () => {
    contentsService.getContentByIdForUnlock.mockResolvedValue({
      id: 'c-2',
      access_type: 'paid',
      is_purchasable: true,
      price_cents: 1500,
      price_currency: 'USD',
      subscription_discount_percent: 30,
    });
    contentsService.getUserContentUnlock.mockResolvedValue(null);
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue(null);

    const result = await resolveContentAccess({
      userId: 'u-2',
      contentId: 'c-2',
    });

    expect(result.access.can_read).toBe(false);
    expect(result.access.denial.code).toBe('CONTENT_LOCKED_PAYMENT_REQUIRED');
    expect(result.access.pricing.final_price_cents).toBe(1500);
  });

  it('applies subscription discount on paid content pricing for active subscriber', async () => {
    contentsService.getContentByIdForUnlock.mockResolvedValue({
      id: 'c-3',
      access_type: 'paid',
      is_purchasable: true,
      price_cents: 1000,
      price_currency: 'USD',
      subscription_discount_percent: 30,
    });
    contentsService.getUserContentUnlock.mockResolvedValue(null);
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue({
      subscription: { id: 'sub-3' },
      memberRole: 'member',
    });

    const result = await resolveContentAccess({
      userId: 'u-3',
      contentId: 'c-3',
    });

    expect(result.access.pricing.discount_percent).toBe(30);
    expect(result.access.pricing.final_price_cents).toBe(700);
    expect(result.access.can_read).toBe(false);
  });

  it('allows read when content already unlocked even without subscription', async () => {
    contentsService.getContentByIdForUnlock.mockResolvedValue({
      id: 'c-4',
      access_type: 'subscription_or_paid',
      is_purchasable: true,
      price_cents: 900,
      price_currency: 'USD',
      subscription_discount_percent: 30,
    });
    contentsService.getUserContentUnlock.mockResolvedValue({
      id: 'unlock-1',
      source: 'paid',
    });
    subscriptionsService.getActiveSubscriptionForMember.mockResolvedValue(null);

    const result = await resolveContentAccess({
      userId: 'u-4',
      contentId: 'c-4',
    });

    expect(result.access.unlocked).toBe(true);
    expect(result.access.can_read).toBe(true);
    expect(result.access.denial).toBeNull();
  });
});
