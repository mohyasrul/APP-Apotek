# MediSir Compliance Guide

## Overview

This document outlines the compliance controls implemented in MediSir to support pharmacy operations in accordance with Indonesian pharmaceutical regulations.

## Regulatory Framework

MediSir is designed to help pharmacies comply with:

- **PMK 73/2016** - Standar Pelayanan Kefarmasian di Apotek
- **PP 51/2009** - Pekerjaan Kefarmasian
- **UU 36/2009** - Kesehatan

---

## Medicine Categories & Dispensing Rules

### Category Definitions

| Category | Indonesian Term | Description | Prescription Required |
|----------|-----------------|-------------|----------------------|
| `bebas` | Obat Bebas | Over-the-counter | No |
| `bebas_terbatas` | Obat Bebas Terbatas | Limited OTC | No |
| `keras` | Obat Keras | Prescription drugs | **Yes** |
| `narkotika` | Narkotika | Narcotics | **Yes** + Apoteker |
| `psikotropika` | Psikotropika | Psychotropics | **Yes** + Apoteker |
| `resep` | Obat Resep | Generic prescription | **Yes** |

### System Enforcement

MediSir enforces dispensing rules at the database level via the `process_checkout` RPC:

```sql
-- Excerpt from process_checkout function
SELECT requires_prescription INTO v_rule_requires_rx
  FROM public.dispensing_rules
 WHERE user_id = v_user_id AND category = v_med_category;

IF v_rule_requires_rx IS TRUE AND p_prescription_id IS NULL THEN
  RAISE EXCEPTION 'Obat "%" kategori "%" wajib ada resep dokter', v_med_name, v_med_category;
END IF;
```

### Configuration

Pharmacy owners can customize dispensing rules in Settings > Dispensing Rules (Professional+ plans).

---

## Audit Trail

### Immutable Audit Logs

All critical actions are logged to `audit_logs` table with:
- User ID (actor)
- Action type (create/update/delete)
- Entity type and ID
- Before/after data (JSONB)
- Timestamp
- Severity level

### Audit Log Protection

Audit logs cannot be modified or deleted:

```sql
CREATE TRIGGER trg_prevent_audit_log_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_deletion();

CREATE TRIGGER trg_prevent_audit_log_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_update();
```

### Critical Actions Logged

| Action | Severity | Details |
|--------|----------|---------|
| Transaction created | Info | Total, items count, payment method |
| Transaction voided | **Critical** | Reason, voided by, timestamp |
| Medicine stock adjusted | Warning | Before/after stock |
| Stock opname approved | Warning | Items changed, approver |
| User role changed | Critical | Old/new role |

---

## Prescription Management

### Prescription Lifecycle

1. **Pending** - New prescription entered
2. **Dispensed** - Linked to transaction
3. **Voided** - Cancelled (with reason)

### Validity Period

- Default validity: 30 days from prescription date
- Configurable per prescription
- System warns when dispensing expired prescriptions

### Required Fields

- Patient name
- Doctor name
- Prescription date
- At least one prescription item

---

## Void Controls

### Role-Based Restrictions

| Role | Void Time Limit | Approval Required |
|------|-----------------|-------------------|
| Kasir | 2 hours | No |
| Owner | 36 hours | No |

### Void Requirements

1. Reason must be provided (mandatory)
2. Stock automatically restored
3. Audit log entry created (severity: critical)
4. Transaction marked as voided (not deleted)

---

## Stock Opname (Physical Inventory)

### Workflow

1. **Draft** - Opname created, items being added
2. **In Progress** - Counting in progress
3. **Completed** - All items counted
4. **Approved** - Owner approves, stock adjusted

### Approval Requirements

- Only pharmacy owner can approve
- Differences logged to stock movements
- Audit trail created

---

## User Roles & Permissions

### Role Matrix

| Permission | Owner | Kasir |
|------------|-------|-------|
| POS / Checkout | ✓ | ✓ |
| View medicines | ✓ | ✓ |
| Edit medicines | ✓ | ✓ |
| View reports | ✓ | ✗ |
| Void (2 hours) | ✓ | ✓ |
| Void (36 hours) | ✓ | ✗ |
| Stock opname | ✓ | ✗ |
| Manage team | ✓ | ✗ |
| Billing | ✓ | ✗ |
| Settings | ✓ | Limited |

### Multi-Tenant Isolation

Each pharmacy's data is isolated using Row Level Security (RLS):

```sql
CREATE POLICY "Users manage pharmacy medicines"
  ON public.medicines FOR ALL
  USING (user_id = public.get_effective_user_id())
  WITH CHECK (user_id = public.get_effective_user_id());
```

Kasir automatically inherits owner's data via `get_effective_user_id()` function.

---

## Receipt Requirements (PMK 73/2016)

MediSir receipts include:

- [x] Pharmacy name
- [x] Pharmacy address
- [x] Phone number
- [x] SIA (Surat Izin Apotek) number
- [x] Apoteker name
- [x] SIPA (Surat Izin Praktek Apoteker) number
- [x] Transaction date/time
- [x] Transaction number
- [x] Item details (name, quantity, price)
- [x] Total amount

---

## Data Retention

| Data Type | Retention Period | Notes |
|-----------|------------------|-------|
| Transactions | Indefinite | Required for tax/audit |
| Audit logs | Indefinite | Compliance requirement |
| Medicines | Until deleted | Soft delete recommended |
| Prescriptions | 5 years minimum | Per regulation |

---

## Security Measures

### Authentication

- Supabase Auth with email/password
- JWT tokens with automatic refresh
- Session timeout after 30 minutes idle

### Rate Limiting

- Login attempts: 5 per 15 minutes
- Signup attempts: 3 per 15 minutes
- Password reset: 3 per 15 minutes

### Data Protection

- All data encrypted in transit (HTTPS)
- All data encrypted at rest (Supabase)
- RLS prevents cross-tenant data access

---

## Compliance Checklist for Pharmacies

Before going live, ensure:

- [ ] SIA number entered in Settings
- [ ] SIPA number entered in Settings
- [ ] Apoteker name entered
- [ ] Pharmacy address complete
- [ ] Dispensing rules configured for restricted categories
- [ ] At least one test transaction completed
- [ ] Receipt format verified

---

## Contact

For compliance questions, contact:
- Email: compliance@medisir.app
- WhatsApp: +62 812-3456-7890

---

*Last updated: March 2026*
