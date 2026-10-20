---
name: Reactive entry routing
description: Persistent entry gates must track route changes as well as authentication.
---

Entry gates that choose redirects must subscribe to both the router pathname
and query string, even if their descendant route switch already subscribes.

**Why:** Reading the browser URL alone left the persistent gate with stale
render output after student/invitation redirects. The address could change
while the interface remained blank. Testing only direct destination loads did
not expose this.

**How to apply:** Preserve router subscriptions when changing entry gates.
Exercise actual redirects and in-app navigation, including invitation query
retention. Keep the student identity provider outside lazy route boundaries so
route loading does not restart authentication.
