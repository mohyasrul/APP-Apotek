# MediSir Commercial Launch Checklist

## Overview

This checklist guides the commercial launch of MediSir from Pilot to General Availability (GA).

---

## Phase 1: Pre-Pilot Preparation

### Technical Readiness

- [ ] All P0/P1 bugs resolved
- [ ] CI/CD pipeline operational
- [ ] Production environment configured
- [ ] SSL certificates valid
- [ ] Domain properly configured
- [ ] CDN caching optimized
- [ ] Error monitoring (Sentry) active
- [ ] Database backups verified

### Compliance Readiness

- [ ] Dispensing rules enforced in DB
- [ ] Audit trail immutable
- [ ] Void controls in place
- [ ] Receipt format PMK 73/2016 compliant
- [ ] User role permissions correct

### Documentation

- [ ] Operations runbook complete
- [ ] Compliance guide published
- [ ] API documentation (if applicable)
- [ ] User onboarding guide
- [ ] FAQ prepared

---

## Phase 2: Pilot Program (5-20 Pharmacies)

### Duration: 2-4 weeks

### Pilot Selection Criteria

- [ ] Mix of pharmacy sizes (small/medium)
- [ ] Geographic distribution (same city cluster preferred)
- [ ] Owner tech-savvy enough for feedback
- [ ] Willing to provide weekly feedback

### Pilot Onboarding

- [ ] Personal onboarding call with each pharmacy
- [ ] Guided first transaction
- [ ] WhatsApp support group created
- [ ] Feedback form shared

### Pilot KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| Transaction success rate | > 99% | Transactions / attempts |
| Onboarding time | < 30 min | Time to first transaction |
| Support ticket rate | < 2/week/pharmacy | Tickets / active pharmacies |
| NPS | > 40 | User survey |
| Daily active usage | > 80% | Active days / total days |

### Pilot Feedback Collection

- [ ] Weekly feedback calls
- [ ] In-app feedback widget
- [ ] Usage analytics review
- [ ] Bug/feature request tracking

---

## Phase 3: Pilot Retrospective

### Success Criteria

- [ ] All pilot KPIs met
- [ ] No P0 incidents during pilot
- [ ] < 5 P1 incidents total
- [ ] 100% pilot pharmacies willing to continue
- [ ] Payment flow tested (if applicable)

### Gap Analysis

Document any gaps found during pilot:

| Gap | Severity | Resolution | ETA |
|-----|----------|------------|-----|
| [Gap 1] | [H/M/L] | [Fix description] | [Date] |

### Go/No-Go Decision

- [ ] Pilot scorecard reviewed
- [ ] All blockers resolved
- [ ] Stakeholder approval obtained

---

## Phase 4: Limited GA (Soft Launch)

### Duration: 2-4 weeks

### Target: 50-100 pharmacies

### Marketing Channels

- [ ] Direct outreach to pilot referrals
- [ ] WhatsApp broadcast to pharmacy networks
- [ ] Social media soft launch
- [ ] Partner referral program

### Pricing Validation

- [ ] Pricing page live
- [ ] Payment gateway integrated (or manual process)
- [ ] Trial-to-paid conversion tracked
- [ ] Refund policy published

### Support Scaling

- [ ] Support SLA defined
- [ ] Help center / FAQ expanded
- [ ] Response templates created
- [ ] Escalation process defined

### Limited GA KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| Trial-to-paid conversion | > 15% | Paid / trial signups |
| 30-day retention | > 70% | Active at day 30 / signups |
| Monthly churn | < 5% | Churned / active |
| Support tickets | < 1/week/pharmacy | Tickets / active |

---

## Phase 5: Full GA

### Prerequisites

- [ ] Limited GA KPIs met
- [ ] Payment processing stable
- [ ] Support capacity sufficient
- [ ] Marketing assets ready
- [ ] Legal/compliance review complete

### Launch Activities

- [ ] Press release / announcement
- [ ] Full marketing campaign launch
- [ ] Webinar / demo schedule
- [ ] Partnership announcements
- [ ] App store listing (if PWA published)

### Post-GA Monitoring

- [ ] Daily KPI dashboard review
- [ ] Weekly incident review
- [ ] Monthly business review
- [ ] Quarterly roadmap planning

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Database overload | High | Medium | Auto-scaling, query optimization |
| Payment failure | High | Low | Fallback payment method, manual process |
| Major bug post-launch | High | Medium | Rapid hotfix process, rollback ready |
| Support overwhelm | Medium | High | Automated responses, priority tiers |
| Competitor response | Medium | Medium | Focus on niche, feature velocity |

---

## Success Metrics (First 6 Months)

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Active pharmacies | 100 | 300 | 1,000 |
| Monthly transactions | 10K | 50K | 200K |
| MRR (IDR) | 10M | 40M | 150M |
| NPS | 40 | 45 | 50 |
| Churn rate | 10% | 7% | 5% |

---

## Team Responsibilities

| Area | Owner | Backup |
|------|-------|--------|
| Product | [TBD] | [TBD] |
| Engineering | [TBD] | [TBD] |
| Support | [TBD] | [TBD] |
| Marketing | [TBD] | [TBD] |
| Finance | [TBD] | [TBD] |

---

## Launch Day Checklist

### T-1 Day

- [ ] Final smoke test on production
- [ ] All team members briefed
- [ ] Support channels ready
- [ ] Monitoring dashboards open

### Launch Day

- [ ] Feature flags enabled
- [ ] Marketing emails sent
- [ ] Social media posts published
- [ ] Team on standby
- [ ] Hourly KPI check

### T+1 Day

- [ ] Launch retrospective
- [ ] Bug triage
- [ ] User feedback review
- [ ] Metrics snapshot

---

## Appendix: Pricing Tiers

| Plan | Monthly | Yearly | Target Segment |
|------|---------|--------|----------------|
| Gratis | Rp 0 | Rp 0 | Trial, very small |
| Starter | Rp 99,000 | Rp 990,000 | Small pharmacies |
| Professional | Rp 249,000 | Rp 2,490,000 | Medium pharmacies |
| Enterprise | Rp 499,000 | Rp 4,990,000 | Chains, high volume |

---

*Document Owner: Product Team*
*Last Updated: March 2026*
