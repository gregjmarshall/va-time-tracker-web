# Rounding and billable time

## Rounding

Every entry stores two durations: the **actual** time, and the **rounded** time used for billing.

- Reports, retainers, budgets, capacity and the timesheet all use the **rounded** time.
- pip supports rounding **up**, **down** or to the **nearest** 15 minutes (or another interval) for each entry.
- Right now, **new entries aren't rounded**. There's no setting for it in the app yet, so the rounded time is the same as the actual time.

<!-- UX: rounding exists in the data model but has no workspace setting; reported to the coordinator. -->

## Billable

Each entry is either **billable** or **non-billable**. New entries are billable by default.

- Only **Managers and Admins** can change it, with the **Billable** tickbox on a manual entry.
- Team members' entries are billable unless a Manager changes them.
- In **Reports**, you can filter by billable or non-billable. The chart shows billable time in teal and non-billable in sky blue.
- On the **Timesheet**, the week header shows the total and billable hours.
