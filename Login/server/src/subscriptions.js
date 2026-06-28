import { query } from './db.js';

const ACTIVE_STATUSES = ['active', 'grace'];
const READ_ONLY_STATUSES = ['read_only'];
const BLOCKED_STATUSES = ['suspended', 'cancelled'];
const PLATFORM_ONLY_MODULES = ['clientes'];

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayDateOnly() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return null;
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTextArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );
}

function removePlatformOnlyModules(values) {
  return normalizeTextArray(values).filter((key) => !PLATFORM_ONLY_MODULES.includes(key));
}

function slugifyPlanKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function normalizePlanPayload(payload = {}, fallbackKey = '') {
  const name = String(payload.name || '').trim();
  const key = slugifyPlanKey(payload.key || fallbackKey || name);
  const monthlyPrice = payload.monthlyPrice ?? payload.monthly_price;
  const annualPrice = payload.annualPrice ?? payload.annual_price;
  const displayOrder = payload.displayOrder ?? payload.display_order;
  const graceDays = payload.graceDays ?? payload.grace_days;
  const expirationAccessMode = payload.expirationAccessMode || payload.expiration_access_mode || 'read_only';

  return {
    key,
    name,
    clientType: String(payload.clientType || payload.client_type || 'ips_hospital').trim(),
    description: payload.description == null ? null : String(payload.description).trim() || null,
    includedSuites: normalizeTextArray(payload.includedSuites || payload.included_suites),
    includedModules: removePlatformOnlyModules(payload.includedModules || payload.included_modules),
    monthlyPrice: monthlyPrice === '' || monthlyPrice == null ? null : Number(monthlyPrice),
    annualPrice: annualPrice === '' || annualPrice == null ? null : Number(annualPrice),
    currency: String(payload.currency || 'COP').trim().toUpperCase().slice(0, 3) || 'COP',
    displayOrder: displayOrder === '' || displayOrder == null ? 100 : Number(displayOrder),
    graceDays: graceDays === '' || graceDays == null ? 0 : Number(graceDays),
    expirationAccessMode: ['read_only', 'blocked'].includes(expirationAccessMode) ? expirationAccessMode : 'read_only',
    isActive: payload.isActive ?? payload.is_active ?? true
  };
}

function computeEffectiveState(row) {
  const today = todayDateOnly();
  const status = row?.status || 'active';
  const accessMode = row?.access_mode || 'full';
  const periodEnd = toDateOnly(row?.current_period_ends_at);
  const graceEnd = toDateOnly(row?.grace_ends_at);

  if (BLOCKED_STATUSES.includes(status) || accessMode === 'blocked') {
    return {
      effectiveStatus: status === 'cancelled' ? 'cancelled' : 'suspended',
      accessMode: 'blocked',
      daysRemaining: periodEnd ? diffDays(today, periodEnd) : null,
      isReadOnly: false,
      isBlocked: true
    };
  }

  if (READ_ONLY_STATUSES.includes(status) || accessMode === 'read_only') {
    return {
      effectiveStatus: 'read_only',
      accessMode: 'read_only',
      daysRemaining: periodEnd ? diffDays(today, periodEnd) : null,
      isReadOnly: true,
      isBlocked: false
    };
  }

  if (periodEnd && periodEnd < today) {
    if (graceEnd && graceEnd >= today) {
      return {
        effectiveStatus: 'grace',
        accessMode: 'full',
        daysRemaining: diffDays(today, graceEnd),
        isReadOnly: false,
        isBlocked: false
      };
    }
    return {
      effectiveStatus: 'read_only',
      accessMode: 'read_only',
      daysRemaining: diffDays(today, periodEnd),
      isReadOnly: true,
      isBlocked: false
    };
  }

  return {
    effectiveStatus: ACTIVE_STATUSES.includes(status) ? status : 'active',
    accessMode: 'full',
    daysRemaining: periodEnd ? diffDays(today, periodEnd) : null,
    isReadOnly: false,
    isBlocked: false
  };
}

function normalizePlan(row) {
  if (!row) return null;
  return {
    key: row.key,
    name: row.name,
    client_type: row.client_type,
    description: row.description,
    included_suites: normalizeJsonArray(row.included_suites),
    included_modules: removePlatformOnlyModules(normalizeJsonArray(row.included_modules)),
    monthly_price: row.monthly_price == null ? null : Number(row.monthly_price),
    annual_price: row.annual_price == null ? null : Number(row.annual_price),
    currency: row.currency || 'COP',
    grace_days: row.grace_days == null ? 0 : Number(row.grace_days),
    expiration_access_mode: row.expiration_access_mode || 'read_only',
    display_order: row.display_order,
    is_active: row.is_active,
    clients_count: row.clients_count == null ? 0 : Number(row.clients_count)
  };
}

function normalizeSubscription(row) {
  const state = computeEffectiveState(row || {});
  return {
    client_id: row?.client_id ?? null,
    plan_key: row?.plan_key ?? null,
    plan_name: row?.plan_name ?? null,
    plan_client_type: row?.plan_client_type ?? null,
    plan_description: row?.plan_description ?? null,
    plan_included_suites: normalizeJsonArray(row?.plan_included_suites),
    plan_included_modules: removePlatformOnlyModules(normalizeJsonArray(row?.plan_included_modules)),
    plan_monthly_price: row?.plan_monthly_price == null ? null : Number(row.plan_monthly_price),
    plan_annual_price: row?.plan_annual_price == null ? null : Number(row.plan_annual_price),
    plan_grace_days: row?.plan_grace_days == null ? 0 : Number(row.plan_grace_days),
    plan_expiration_access_mode: row?.plan_expiration_access_mode || 'read_only',
    billing_cycle: row?.billing_cycle || 'monthly',
    status: row?.status || 'active',
    access_mode: row?.access_mode || 'full',
    current_period_starts_at: toDateOnly(row?.current_period_starts_at),
    current_period_ends_at: toDateOnly(row?.current_period_ends_at),
    grace_ends_at: toDateOnly(row?.grace_ends_at),
    amount: row?.amount == null ? null : Number(row.amount),
    currency: row?.currency || 'COP',
    notes: row?.notes || null,
    updated_at: row?.updated_at || null,
    effective_status: state.effectiveStatus,
    effective_access_mode: state.accessMode,
    days_remaining: state.daysRemaining,
    is_read_only: state.isReadOnly,
    is_blocked: state.isBlocked
  };
}

async function findSubscriptionPlan(planKey) {
  if (!planKey) return null;
  const { rows } = await query(
    `SELECT key, name, client_type, description, included_suites, included_modules,
            monthly_price, annual_price, currency, grace_days, expiration_access_mode,
            display_order, is_active
     FROM subscription_plans
     WHERE key = $1 AND is_active = TRUE`,
    [planKey]
  );
  return normalizePlan(rows[0]);
}

export async function listSubscriptionPlans({ includeInactive = false } = {}) {
  const { rows } = await query(
    `SELECT key, name, client_type, description, included_suites, included_modules,
            monthly_price, annual_price, currency, grace_days, expiration_access_mode,
            display_order, is_active,
            COALESCE((
              SELECT COUNT(*)::int
              FROM client_subscriptions cs
              WHERE cs.plan_key = subscription_plans.key
            ), 0) AS clients_count
     FROM subscription_plans
     WHERE ($1::boolean = TRUE OR is_active = TRUE)
     ORDER BY display_order, name`,
    [includeInactive]
  );
  return rows.map(normalizePlan);
}

export async function createSubscriptionPlan(payload) {
  const values = normalizePlanPayload(payload);
  if (!values.key || !values.name) {
    throw new Error('PLAN_INVALID');
  }
  const { rows } = await query(
    `INSERT INTO subscription_plans (
       key, name, client_type, description, included_suites, included_modules,
       monthly_price, annual_price, currency, grace_days, expiration_access_mode,
       display_order, is_active
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)
     RETURNING key, name, client_type, description, included_suites, included_modules,
       monthly_price, annual_price, currency, grace_days, expiration_access_mode,
       display_order, is_active`,
    [
      values.key,
      values.name,
      values.clientType,
      values.description,
      JSON.stringify(values.includedSuites),
      JSON.stringify(values.includedModules),
      values.monthlyPrice,
      values.annualPrice,
      values.currency,
      values.graceDays,
      values.expirationAccessMode,
      values.displayOrder,
      values.isActive
    ]
  );
  return normalizePlan(rows[0]);
}

export async function updateSubscriptionPlan(planKey, payload) {
  const values = normalizePlanPayload(payload, planKey);
  if (!values.name) {
    throw new Error('PLAN_INVALID');
  }
  const { rows } = await query(
    `UPDATE subscription_plans
     SET name = $2,
         client_type = $3,
         description = $4,
         included_suites = $5::jsonb,
         included_modules = $6::jsonb,
         monthly_price = $7,
         annual_price = $8,
         currency = $9,
         grace_days = $10,
         expiration_access_mode = $11,
         display_order = $12,
         is_active = $13
     WHERE key = $1
     RETURNING key, name, client_type, description, included_suites, included_modules,
       monthly_price, annual_price, currency, grace_days, expiration_access_mode,
       display_order, is_active`,
    [
      planKey,
      values.name,
      values.clientType,
      values.description,
      JSON.stringify(values.includedSuites),
      JSON.stringify(values.includedModules),
      values.monthlyPrice,
      values.annualPrice,
      values.currency,
      values.graceDays,
      values.expirationAccessMode,
      values.displayOrder,
      values.isActive
    ]
  );
  if (!rows[0]) {
    throw new Error('PLAN_NOT_FOUND');
  }
  return normalizePlan(rows[0]);
}

export async function applySubscriptionPlanToClients(planKey) {
  const plan = await findSubscriptionPlan(planKey);
  if (!plan) {
    throw new Error('PLAN_NOT_FOUND');
  }
  const { rows } = await query(
    'SELECT client_id FROM client_subscriptions WHERE plan_key = $1',
    [planKey]
  );
  for (const row of rows) {
    await applySubscriptionPlan(row.client_id, planKey);
  }
  return { affected_clients: rows.length };
}

export async function ensureClientSubscription(clientId) {
  await query(
    `INSERT INTO client_subscriptions (client_id, billing_cycle, status, access_mode, currency)
     VALUES ($1, 'monthly', 'active', 'full', 'COP')
     ON CONFLICT (client_id) DO NOTHING`,
    [clientId]
  );
}

export async function clientHasActiveAdmin(clientId) {
  const { rows } = await query(
    `SELECT 1
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.client_id = $1
       AND u.is_active = TRUE
       AND r.name = 'client_admin'
     LIMIT 1`,
    [clientId]
  );
  return rows.length > 0;
}

export async function applySubscriptionPlan(clientId, planKey) {
  const plan = await findSubscriptionPlan(planKey);
  if (!plan) {
    throw new Error('PLAN_NOT_FOUND');
  }

  await query(
    `INSERT INTO client_software_access (client_id, suite_key, enabled, license_status, plan_name)
     SELECT $1,
            s.key,
            s.key = ANY($2::text[]),
            CASE WHEN s.key = ANY($2::text[]) THEN 'active' ELSE 'trial' END,
            $3
     FROM software_suites s
     WHERE s.is_active = TRUE
     ON CONFLICT (client_id, suite_key)
     DO UPDATE SET enabled = EXCLUDED.enabled,
                   license_status = EXCLUDED.license_status,
                   plan_name = EXCLUDED.plan_name`,
    [clientId, plan.included_suites, plan.name]
  );

  await query('DELETE FROM client_modules WHERE client_id = $1', [clientId]);
  if (plan.included_modules.length) {
    await query(
      `INSERT INTO client_modules (client_id, module_key, enabled)
       SELECT $1, m.key, TRUE
       FROM modules m
       WHERE m.is_active = TRUE
         AND m.key = ANY($2::text[])
       ON CONFLICT (client_id, module_key)
       DO UPDATE SET enabled = TRUE`,
      [clientId, plan.included_modules]
    );
  }

  return plan;
}

export async function getClientSubscription(clientId, { includeHistory = false } = {}) {
  await ensureClientSubscription(clientId);
  const { rows } = await query(
    `SELECT cs.*,
            sp.name AS plan_name,
            sp.client_type AS plan_client_type,
            sp.description AS plan_description,
            sp.included_suites AS plan_included_suites,
            sp.included_modules AS plan_included_modules,
            sp.monthly_price AS plan_monthly_price,
            sp.annual_price AS plan_annual_price,
            sp.grace_days AS plan_grace_days,
            sp.expiration_access_mode AS plan_expiration_access_mode
     FROM client_subscriptions cs
     LEFT JOIN subscription_plans sp ON sp.key = cs.plan_key
     WHERE cs.client_id = $1`,
    [clientId]
  );
  const subscription = normalizeSubscription(rows[0]);

  if (!includeHistory) {
    return subscription;
  }

  const [payments, events] = await Promise.all([
    query(
      `SELECT id, paid_at, period_start, period_end, amount, currency, reference, notes, created_at
       FROM subscription_payments
       WHERE client_id = $1
       ORDER BY paid_at DESC, created_at DESC
       LIMIT 12`,
      [clientId]
    ),
    query(
      `SELECT id, action, previous_status, new_status, details, actor_username, created_at
       FROM subscription_events
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [clientId]
    )
  ]);

  return {
    ...subscription,
    payments: payments.rows.map((row) => ({
      ...row,
      paid_at: toDateOnly(row.paid_at),
      period_start: toDateOnly(row.period_start),
      period_end: toDateOnly(row.period_end),
      amount: row.amount == null ? null : Number(row.amount)
    })),
    events: events.rows
  };
}

export async function updateClientSubscription(clientId, payload, actor = {}) {
  await ensureClientSubscription(clientId);
  const before = await getClientSubscription(clientId);
  const planKey = payload.planKey || payload.plan_key || before.plan_key || null;
  const selectedPlan = planKey ? await findSubscriptionPlan(planKey) : null;
  if (planKey && !selectedPlan) {
    throw new Error('PLAN_NOT_FOUND');
  }

  const billingCycle = payload.billingCycle || payload.billing_cycle || before.billing_cycle || 'monthly';
  const amountFromPlan = billingCycle === 'annual'
    ? selectedPlan?.annual_price
    : selectedPlan?.monthly_price;

  const values = {
    planKey,
    billingCycle,
    status: payload.status || before.status || 'active',
    accessMode: payload.accessMode || payload.access_mode || before.access_mode || 'full',
    startsAt: payload.currentPeriodStartsAt ?? payload.current_period_starts_at ?? before.current_period_starts_at ?? null,
    endsAt: payload.currentPeriodEndsAt ?? payload.current_period_ends_at ?? before.current_period_ends_at ?? null,
    graceEndsAt: payload.graceEndsAt ?? payload.grace_ends_at ?? before.grace_ends_at ?? null,
    amount: payload.amount === ''
      ? null
      : payload.amount == null
        ? (before.amount ?? amountFromPlan ?? null)
        : Number(payload.amount),
    currency: payload.currency || selectedPlan?.currency || before.currency || 'COP',
    notes: payload.notes ?? before.notes ?? null,
    updatedBy: actor.userId || null
  };

  if (planKey && planKey !== before.plan_key) {
    await applySubscriptionPlan(clientId, planKey);
  }

  await query(
    `UPDATE client_subscriptions
     SET plan_key = $2,
         billing_cycle = $3,
         status = $4,
         access_mode = $5,
         current_period_starts_at = $6,
         current_period_ends_at = $7,
         grace_ends_at = $8,
         amount = $9,
         currency = $10,
         notes = $11,
         updated_by = $12
     WHERE client_id = $1`,
    [
      clientId,
      values.planKey,
      values.billingCycle,
      values.status,
      values.accessMode,
      values.startsAt,
      values.endsAt,
      values.graceEndsAt,
      values.amount,
      values.currency,
      values.notes,
      values.updatedBy
    ]
  );

  const after = await getClientSubscription(clientId);
  await createSubscriptionEvent(clientId, {
    action: 'SUBSCRIPTION_UPDATE',
    previousStatus: before.effective_status,
    newStatus: after.effective_status,
    details: { before, after },
    actor
  });
  return after;
}

export async function recordSubscriptionPayment(clientId, payload, actor = {}) {
  await ensureClientSubscription(clientId);
  const amount = payload.amount === '' || payload.amount == null ? null : Number(payload.amount);
  const periodStart = payload.periodStart || payload.period_start || null;
  const periodEnd = payload.periodEnd || payload.period_end || null;
  const currency = payload.currency || 'COP';

  const { rows } = await query(
    `INSERT INTO subscription_payments (
       client_id, paid_at, period_start, period_end, amount, currency, reference, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, paid_at, period_start, period_end, amount, currency, reference, notes, created_at`,
    [
      clientId,
      payload.paidAt || payload.paid_at || todayDateOnly(),
      periodStart,
      periodEnd,
      amount,
      currency,
      payload.reference || null,
      payload.notes || null,
      actor.userId || null
    ]
  );

  if (periodStart || periodEnd || amount != null) {
    const current = await getClientSubscription(clientId);
    await updateClientSubscription(
      clientId,
      {
        planKey: payload.planKey || payload.plan_key || current.plan_key,
        billingCycle: payload.billingCycle || current.billing_cycle,
        status: 'active',
        accessMode: 'full',
        currentPeriodStartsAt: periodStart || current.current_period_starts_at,
        currentPeriodEndsAt: periodEnd || current.current_period_ends_at,
        graceEndsAt: payload.graceEndsAt || current.grace_ends_at,
        amount: amount ?? current.amount,
        currency,
        notes: current.notes
      },
      actor
    );
  }

  await createSubscriptionEvent(clientId, {
    action: 'SUBSCRIPTION_PAYMENT_REGISTER',
    previousStatus: null,
    newStatus: 'active',
    details: {
      paymentId: rows[0]?.id,
      periodStart,
      periodEnd,
      amount,
      currency,
      reference: payload.reference || null
    },
    actor
  });

  return {
    ...rows[0],
    paid_at: toDateOnly(rows[0].paid_at),
    period_start: toDateOnly(rows[0].period_start),
    period_end: toDateOnly(rows[0].period_end),
    amount: rows[0].amount == null ? null : Number(rows[0].amount)
  };
}

export async function createSubscriptionEvent(clientId, { action, previousStatus, newStatus, details, actor }) {
  await query(
    `INSERT INTO subscription_events (
       client_id, action, previous_status, new_status, details, actor_user_id, actor_username
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      clientId,
      action,
      previousStatus || null,
      newStatus || null,
      details || {},
      actor?.userId || null,
      actor?.username || null
    ]
  );
}

export async function getClientSubscriptionAccess(clientId) {
  if (!clientId) {
    return {
      effective_status: 'active',
      effective_access_mode: 'full',
      is_read_only: false,
      is_blocked: false
    };
  }
  return getClientSubscription(clientId);
}
