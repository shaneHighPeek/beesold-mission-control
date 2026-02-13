# Workflow Lifecycle Diagram

```text
┌──────────┐
│  DRAFT   │
└────┬─────┘
     │ client starts intake
     v
┌───────────────┐
│  IN_PROGRESS  │
└────┬──────────┘
     │ client submits
     v
┌────────────┐
│ SUBMITTED  │
└────┬───────┘
     │ system: run Klor
     v
┌─────────────────┐
│ KLOR_SYNTHESIS  │
└────┬────────────┘
     │ system: run Council
     v
┌─────────────────┐
│ COUNCIL_RUNNING │
└────┬────────────┘
     │ report generated
     v
┌──────────────┐
│ REPORT_READY │
└───┬──────┬───┘
    │      │
    │      └───────────────┐
    │ operator rejects      │ return for rework
    v                       │
┌───────────┐               │
│ APPROVED  │<──────────────┘
└───────────┘
```

## Notes

- All transitions are explicit and validated by state machine rules.
- No automatic publish occurs after report creation.
- `REPORT_READY` is the required human-approval gate.
