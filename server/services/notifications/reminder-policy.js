const reminderSuppressedStatuses = new Set(["applied", "submitted", "not_interested"]);

export function shouldSuppressDeadlineReminder(actionStatus) {
  return reminderSuppressedStatuses.has(actionStatus);
}
