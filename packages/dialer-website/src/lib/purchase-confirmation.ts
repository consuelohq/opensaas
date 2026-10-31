export const purchaseConfirmation = (value: unknown) => {
  if (
    !value ||
    typeof value !== 'object' ||
    !('paid' in value) ||
    typeof value.paid !== 'boolean'
  )
    throw new Error('Invalid purchase response');
  const result = value as Record<string, unknown>;
  const paid = result.paid === true,
    claimed = result.claimed === true;
  const status = typeof result.status === 'string' ? result.status : 'pending';
  const allSelectedPaid =
    result.allSelectedPaid === undefined
      ? paid
      : result.allSelectedPaid === true;
  const paymentPending = result.paymentPending === true;
  let portalUrl: string | null = null;
  if (result.nextPortalUrl !== undefined && result.nextPortalUrl !== null) {
    if (typeof result.nextPortalUrl !== 'string')
      throw new Error('Invalid Stripe confirmation');
    const url = new URL(result.nextPortalUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'billing.stripe.com' ||
      url.username ||
      url.password ||
      url.port
    )
      throw new Error('Invalid Stripe confirmation');
    portalUrl = url.href;
  }
  const canConnect = paid && status === 'active';
  const complete = canConnect && allSelectedPaid && !paymentPending;
  return {
    paid,
    claimed,
    canConnect,
    complete,
    clearClaim: complete && claimed,
    needsNumbers: paid && !allSelectedPaid,
    paymentPending,
    portalUrl,
    status,
  };
};
export const numberConfirmationRedirect = (
  id: string,
  result: ReturnType<typeof purchaseConfirmation>,
  query: URLSearchParams,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): string | null => {
  if (
    !result.needsNumbers ||
    !result.canConnect ||
    result.paymentPending ||
    !result.portalUrl ||
    query.get('checkout') === 'cancelled' ||
    query.has('numbers')
  )
    return null;
  try {
    const key = 'consuelo-number-confirmation:' + id;
    if (storage.getItem(key)) return null;
    storage.setItem(key, 'opened');
    return result.portalUrl;
  } catch {
    return null;
  }
};
