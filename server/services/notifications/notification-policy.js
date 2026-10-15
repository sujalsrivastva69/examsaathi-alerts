import { shouldSuppressDeadlineReminder } from "./reminder-policy.js";

export function needsPublicationEnqueue(vacancy) {
  return (
    vacancy.last_enqueued_notification_type !== vacancy.next_notification_type ||
    vacancy.last_enqueued_rules_version !== vacancy.rules_version
  );
}

export function filterReminderAudience(matches, actions) {
  const actionByUser = new Map(actions.map((action) => [action.user_id, action.status]));
  return matches.filter(
    (match) => !shouldSuppressDeadlineReminder(actionByUser.get(match.user_id)),
  );
}
