# Subscriber and enterprise email delivery

## Where to configure it

- Personal: **Account → Notifications → Email delivery**.
- Enterprise: **Organizations → select organization → Notifications → Email delivery**.
- An unavailable IMPRIMA publication also links to the email settings for its own scope.

Only organization owners and administrators may change, test or verify an enterprise sender. Other members have a read-only view. Personal settings do not alter another subscriber's settings.

## Delivery modes

**Platform-managed** is the default. It requires a working platform Resend connection and verified platform sender. A subscriber may customize the display name and reply-to address, but cannot impersonate a different From domain.

**Subscriber-owned** supports Resend and Postmark. Verify the sender/domain with the selected provider first, enter its credential in the password field, save, request a test, and enter the six-digit code delivered to the signed-in subscriber's profile email. The connection remains unavailable until verified.

Credentials are encrypted at rest and bound to their personal or organization scope. They are never returned by the API or stored in browser storage. Leaving the credential blank retains the saved key only for the same provider; switching provider requires a new key. Saving connection changes invalidates existing verification codes. The existing application encryption key lifecycle applies: rotating the server session secret can require reconnecting providers.

Tests are explicitly initiated, rate-limited across personal/organization contexts and revisions, expire after ten minutes, and lock after five wrong attempts. A selected provider's failure is reported; another provider is never silently substituted.

## What uses these settings

- IMPRIMA publication codes and mandatory publication control copies.
- Organization billing, high-cost and activity-digest notifications.
- Personal retainer-monitoring notifications.

Existing notification preferences still determine which optional alerts are sent. They do not disable IMPRIMA codes or mandatory control copies. Organization-visible artifact publications are bound to that organization; leaving it prevents further delivery using its connection.

Clerk sign-in, SSO and identity-verification email settings remain separate and unchanged. Operator/infrastructure alerts continue to use platform-owned delivery. SMTP, arbitrary mail gateways and subscriber customization of Clerk identity email delivery are not part of this implementation.

## Publication safeguards remain in force

Every download still requires a single-use publication code. The exact frozen publication bytes must be accepted by the configured transport for the mandatory ATANDA control recipient before download bytes are issued. Sender customization cannot change that recipient or remove the stamped publication wrapper.

Provider acceptance is not proof of inbox delivery or completion of the subscriber's download.

## Release verification

Automated checks mock all providers and private-file storage. No real messages or paid model calls are needed for these checks. An administrator/subscriber must configure a real verified sender and complete an explicit inbox test before relying on subscriber-owned delivery.
