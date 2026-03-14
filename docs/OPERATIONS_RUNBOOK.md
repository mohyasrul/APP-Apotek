# MediSir Operations Runbook

## Table of Contents
1. [Incident Response](#incident-response)
2. [Backup & Restore](#backup--restore)
3. [Deployment Procedures](#deployment-procedures)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Database Operations](#database-operations)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P0 | Critical - System down | 15 minutes | Complete outage, data loss |
| P1 | High - Major feature broken | 1 hour | Checkout failing, auth broken |
| P2 | Medium - Feature degraded | 4 hours | Slow performance, minor bugs |
| P3 | Low - Minor issue | 24 hours | UI glitches, cosmetic issues |

### Incident Response Process

1. **Detect** - Monitoring alert or user report
2. **Triage** - Assess severity and impact
3. **Communicate** - Notify stakeholders via designated channel
4. **Investigate** - Root cause analysis
5. **Mitigate** - Apply fix or workaround
6. **Resolve** - Permanent fix deployed
7. **Post-mortem** - Document lessons learned

### On-Call Contacts

| Role | Primary | Secondary |
|------|---------|-----------|
| Engineering | [TBD] | [TBD] |
| Product | [TBD] | [TBD] |
| Support | [TBD] | [TBD] |

---

## Backup & Restore

### Supabase Automatic Backups

Supabase provides automatic daily backups with 7-day retention (Free/Pro) or 30-day retention (Enterprise).

### Manual Backup Procedure

```bash
# Export database schema
pg_dump -h $SUPABASE_DB_HOST -U postgres -d postgres --schema-only > schema_backup.sql

# Export data (exclude large tables if needed)
pg_dump -h $SUPABASE_DB_HOST -U postgres -d postgres --data-only > data_backup.sql
```

### Point-in-Time Recovery (PITR)

For Pro/Enterprise plans:
1. Go to Supabase Dashboard > Database > Backups
2. Select "Point in Time Recovery"
3. Choose desired timestamp
4. Confirm restoration

### Restore Procedure

```bash
# Restore schema first
psql -h $SUPABASE_DB_HOST -U postgres -d postgres < schema_backup.sql

# Then restore data
psql -h $SUPABASE_DB_HOST -U postgres -d postgres < data_backup.sql
```

### Verification Checklist

- [ ] All tables restored
- [ ] Row counts match expected
- [ ] Foreign key constraints valid
- [ ] RLS policies active
- [ ] Test login with known credentials
- [ ] Test checkout flow

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing in CI
- [ ] No high/critical security vulnerabilities
- [ ] Migration scripts reviewed
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Standard Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm ci

# 3. Build application
npm run build

# 4. Deploy to hosting (example: Vercel)
vercel --prod

# 5. Run database migrations (if any)
supabase db push
```

### Rollback Procedure

```bash
# Option 1: Revert to previous deployment
vercel rollback

# Option 2: Revert git commit and redeploy
git revert HEAD
git push origin main
```

### Database Migration Rollback

Always create a rollback script for each migration:

```sql
-- Migration: 20260318_new_feature.sql
-- Rollback: 20260318_new_feature_rollback.sql

-- Rollback commands here
DROP TABLE IF EXISTS new_table;
ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Error rate | > 1% | > 5% |
| P95 latency | > 500ms | > 2000ms |
| Database connections | > 50% | > 80% |
| Storage usage | > 70% | > 90% |

### Sentry Error Monitoring

Errors are automatically reported to Sentry in production. Key dashboards:
- Error trends
- Release health
- User impact

### Health Check Endpoints

```bash
# Application health
curl https://medisir.app/api/health

# Database connectivity
SELECT 1;
```

### Alert Channels

- **Slack**: #medisir-alerts
- **Email**: ops@medisir.app
- **SMS**: P0 incidents only

---

## Database Operations

### Safe Migration Practices

1. Always test migrations on staging first
2. Use transactions for multi-statement migrations
3. Add `IF EXISTS` / `IF NOT EXISTS` clauses
4. Never run during peak hours
5. Have rollback script ready

### Common Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Index Maintenance

```sql
-- Find missing indexes (slow queries)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Rebuild indexes (during maintenance window)
REINDEX TABLE table_name;
```

---

## Troubleshooting Guide

### Common Issues

#### 1. "Cannot login" errors

**Possible causes:**
- Supabase auth service down
- Invalid/expired JWT
- RLS policy blocking

**Resolution:**
```sql
-- Check if user exists
SELECT id, email, role FROM auth.users WHERE email = 'user@example.com';

-- Check user profile
SELECT * FROM public.users WHERE id = '<user_id>';
```

#### 2. "Checkout failed" errors

**Possible causes:**
- Insufficient stock
- RPC function error
- Network timeout

**Resolution:**
```sql
-- Check stock levels
SELECT id, name, stock FROM medicines WHERE id = '<medicine_id>';

-- Check recent failed transactions
SELECT * FROM audit_logs
WHERE action = 'create' AND entity_type = 'transaction'
ORDER BY created_at DESC LIMIT 10;
```

#### 3. Slow dashboard loading

**Possible causes:**
- Missing indexes
- Large dataset
- Network latency

**Resolution:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT ...;

-- Add index if needed
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

#### 4. "RLS policy violation" errors

**Possible causes:**
- User not authenticated
- Wrong effective_user_id
- Policy misconfiguration

**Resolution:**
```sql
-- Check current user
SELECT auth.uid(), public.get_effective_user_id();

-- Test RLS policy
SET request.jwt.claim.sub = '<user_id>';
SELECT * FROM medicines LIMIT 1;
```

---

## Emergency Contacts

| Service | Contact |
|---------|---------|
| Supabase Support | support.supabase.com |
| Vercel Support | vercel.com/support |
| Domain Registrar | [TBD] |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial runbook created | MediSir Team |
