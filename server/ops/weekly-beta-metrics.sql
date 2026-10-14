-- Run in the Supabase SQL editor as a project administrator.
-- Bounce rate requires the verified Resend webhook configured at
-- POST /api/webhooks/resend and migration 007 applied.
with bounds as (
  select date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as week_start
),
feedback as (
  select
    count(*) filter (where feedback_type = 'wrong_match') as false_match_reports,
    count(*) filter (where feedback_type = 'missed_vacancy') as missed_vacancy_reports,
    count(*) filter (where feedback_type = 'irrelevant_alert') as irrelevant_alert_reports
  from public.beta_feedback, bounds
  where created_at >= bounds.week_start
    and created_at < bounds.week_start + interval '1 week'
),
sent as (
  select count(distinct provider_message_id) as sent_messages
  from public.notification_logs, bounds
  where status = 'sent'
    and provider_message_id is not null
    and created_at >= bounds.week_start
    and created_at < bounds.week_start + interval '1 week'
),
bounced as (
  select count(distinct events.message_id) as bounced_messages
  from public.email_provider_events events
  join public.notification_logs logs
    on logs.provider_message_id = events.message_id
   and logs.status = 'sent'
  cross join bounds
  where events.event_type = 'email.bounced'
    and logs.created_at >= bounds.week_start
    and logs.created_at < bounds.week_start + interval '1 week'
    and events.occurred_at >= bounds.week_start
    and events.occurred_at < bounds.week_start + interval '1 week'
),
duplicate_successes as (
  select count(*) as duplicate_queue_items
  from (
    select queue_id
    from public.notification_logs, bounds
    where status = 'sent'
      and queue_id is not null
      and created_at >= bounds.week_start
      and created_at < bounds.week_start + interval '1 week'
    group by queue_id
    having count(*) > 1
  ) duplicated
),
sent_queue as (
  select count(distinct queue_id) as sent_queue_items
  from public.notification_logs, bounds
  where status = 'sent'
    and queue_id is not null
    and created_at >= bounds.week_start
    and created_at < bounds.week_start + interval '1 week'
),
unsubscribed as (
  select count(*) as unsubscribes
  from public.notification_preferences, bounds
  where unsubscribed_at >= bounds.week_start
    and unsubscribed_at < bounds.week_start + interval '1 week'
),
returning as (
  select count(*) as returning_users
  from auth.users, bounds
  where created_at < bounds.week_start
    and last_sign_in_at >= bounds.week_start
    and last_sign_in_at < bounds.week_start + interval '1 week'
)
select
  bounds.week_start,
  feedback.false_match_reports,
  feedback.missed_vacancy_reports,
  feedback.irrelevant_alert_reports,
  sent.sent_messages,
  bounced.bounced_messages,
  round(100.0 * bounced.bounced_messages / nullif(sent.sent_messages, 0), 2) as bounce_rate_percent,
  duplicate_successes.duplicate_queue_items,
  sent_queue.sent_queue_items,
  round(100.0 * duplicate_successes.duplicate_queue_items / nullif(sent_queue.sent_queue_items, 0), 2) as duplicate_success_rate_percent,
  unsubscribed.unsubscribes,
  round(100.0 * unsubscribed.unsubscribes / nullif(sent.sent_messages, 0), 2) as unsubscribe_per_sent_email_percent,
  returning.returning_users
from bounds
cross join feedback
cross join sent
cross join bounced
cross join duplicate_successes
cross join sent_queue
cross join unsubscribed
cross join returning;
