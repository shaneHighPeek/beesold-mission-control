# Listing Intake UX Principles (Phase 1)

## Objective

Maximize completion rate and input quality by guiding clients through a professional, insurance-style workflow rather than a raw upload/form experience.

## Design Principles

1. **Progressive disclosure over data dumps**
   - Show one conceptual step at a time.
   - Keep cognitive load low.

2. **Always-visible progress**
   - Listing owners should know where they are and what remains.
   - Use step index + progress bar.

3. **Autosave-first architecture**
   - Save after every step change and content update.
   - Reduce abandonment from accidental navigation/loss.

4. **Resume confidence**
   - Tokenized session restores step position and prior entries.
   - Returning users should not rework previously completed steps.

5. **Inline validation at point of entry**
   - Require mandatory fields before completion advance.
   - Keep validation messages immediate and actionable.

6. **Structured help, not chat dependency**
   - Add contextual guidance text per section.
   - Clarify expected data quality and format.

7. **Structured document capture**
   - Capture category + metadata to support deterministic downstream processing.
   - Separate document category collection from freeform uploads.

8. **Pre-submit review gate**
   - Show all captured responses before submission.
   - Confirm that submission starts internal pipeline processing.

9. **Completion momentum cues**
   - Segment completion should provide immediate positive feedback.
   - Next segment intro should reduce perceived friction for long forms.

## Completion Outcomes

A successful intake experience should:

- improve completion rate,
- reduce ambiguous inputs,
- improve synthesis/report quality,
- reduce operator rework.
