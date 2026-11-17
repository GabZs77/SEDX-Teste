# Project rules
- Community channels are rendered by the standalone Community module; legacy notification URLs redirect to its announcements channel so shared links remain valid.
- Announcements reuse the public site-state notification source and existing read/push controls through SedxAnnouncements.mount; do not introduce a second announcements store.

- Community replies encode a plain-text blockquote in the existing message content field; parse it for display so replies persist without a separate store or service contract change.

- Sentence-order answers use the standalone bank reader to retain original strings and multiplicities; validate complete permutations before CAPTCHA so upstream receives unchanged sentence content.

- Task todo queries include expired assignments and paginate until exhausted; preserve original deadlines and normal CAPTCHA submission so late tasks remain actionable without bypassing upstream rules.

- All client Groq calls share a serial paced queue; preserve provider retry delays and pause bulk selection on exhausted quota rather than failing untouched tasks.
- Groq returns quota exhaustion as HTTP 429 with retry_after_seconds; retries belong to the client queue so server requests do not sleep or amplify quota pressure.

- Task opening calls the official apply endpoint from the authenticated student browser with the validated CAPTCHA; never spoof Origin/Cookie or retry a refusal through a proxy, and pause bulk AI on access refusal so untouched tasks stay pending.

- When task-session renewal is rejected, pause batch submission for same-account reauthentication, retain drafts and confirmed sends, and require a fresh CAPTCHA before resubmitting.
