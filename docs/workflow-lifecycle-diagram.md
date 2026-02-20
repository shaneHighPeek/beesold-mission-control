# Workflow Lifecycle Diagram

```text
┌───────────┐
│  INVITED  │
└────┬─────┘
     │ client enters portal
     v
┌───────────────┐
│  IN_PROGRESS  │
└────┬──────────┘
     │ client submits partial
     v
┌─────────────────────┐
│ PARTIAL_SUBMITTED   │
└────┬───────┘
     │ operator requests more
     v
┌─────────────────────────┐
│ MISSING_ITEMS_REQUESTED │
└────┬────────────┘
     │ client updates + final submit
     v
┌─────────────────┐
│ FINAL_SUBMITTED │
└────┬────────────┘
     │ system: run Klor
     v
┌─────────────────┐
│ KLOR_SYNTHESIS  │
└───┬──────┬───┘
    │ system: run Council
    v
┌─────────────────┐
│ COUNCIL_RUNNING │
└────┬────────────┘
     │ report generated
     v
┌──────────────┐
│ REPORT_READY │
└────┬─────────┘
     │ operator approves
     v
┌───────────┐
│ APPROVED  │
└───────────┘
```

## Notes

- All transitions are explicit and validated by state machine rules.
- No automatic publish occurs after report creation.
- `REPORT_READY` is the required human-approval gate.
