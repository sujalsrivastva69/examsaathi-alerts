import { describe, expect, it } from "vitest";
import {
  filterReminderAudience,
  needsPublicationEnqueue,
} from "../../services/notifications/notification-policy.js";

describe("notification policy", () => {
  it("only enqueues publication events when type or rules version changed", () => {
    expect(
      needsPublicationEnqueue({
        next_notification_type: "new_vacancy",
        rules_version: 2,
        last_enqueued_notification_type: "new_vacancy",
        last_enqueued_rules_version: 2,
      }),
    ).toBe(false);
    expect(
      needsPublicationEnqueue({
        next_notification_type: "important_correction",
        rules_version: 2,
        last_enqueued_notification_type: "new_vacancy",
        last_enqueued_rules_version: 2,
      }),
    ).toBe(true);
    expect(
      needsPublicationEnqueue({
        next_notification_type: "new_vacancy",
        rules_version: 3,
        last_enqueued_notification_type: "new_vacancy",
        last_enqueued_rules_version: 2,
      }),
    ).toBe(true);
  });

  it("filters reminder recipients using one batched action result", () => {
    const matches = [
      { user_id: "saved" },
      { user_id: "applied" },
      { user_id: "dismissed" },
      { user_id: "no-action" },
    ];
    const actions = [
      { user_id: "applied", status: "submitted" },
      { user_id: "dismissed", status: "not_interested" },
      { user_id: "saved", status: "interested" },
    ];

    expect(filterReminderAudience(matches, actions).map(({ user_id }) => user_id)).toEqual([
      "saved",
      "no-action",
    ]);
  });
});
