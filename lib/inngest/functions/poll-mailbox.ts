import { inngest } from "@/lib/inngest/client";
import { pollAllMailboxes } from "@/lib/finance/mailbox/poller";

/**
 * The "auto-pull" accounts inbox watcher — replaces the Dropbox/make.com
 * sorting chain. Runs every 5 minutes; also runnable on demand (the admin
 * Mailbox Settings "Poll now" action) for local/demo environments with no
 * real scheduler.
 */
export const pollMailbox = inngest.createFunction(
  { id: "poll-mailbox", triggers: [{ cron: "*/5 * * * *" }, { event: "mailbox/poll.requested" }] },
  async ({ step }) => {
    const results = await step.run("poll-all-mailboxes", () => pollAllMailboxes());
    return { results };
  }
);
