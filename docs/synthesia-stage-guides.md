# Shared Synthesia stage guides

## Subscriber experience

The shared guide library covers F0–F12, including F9.5, with an explainer and a narrated synthetic worked example for each stage. Reviewed default transcripts are available without a Synthesia connection. Video playback becomes available only after a real render is completed, reviewed and published by an administrator.

Guides are optional teaching aids. They do not create customer artifacts, change assessments, grant badges/certification, consume subscriber render credits, or open production gates. Demonstrations are narrated examples, not recordings of authenticated customer sessions.

## Platform connection

Configure `SYNTHESIA_API_KEY` through the workspace's secure Secrets flow. Use a **Legacy (v2)** scoped key with eligible Synthesia Pro/Enterprise Video API access. Interactive Avatar keys are not compatible. Never paste the key into a script, URL, repository or chat.

Optional non-secret settings: `SYNTHESIA_AVATAR_ID` and `SYNTHESIA_BACKGROUND`. The defaults use Synthesia's documented avatar `anna_costume1_cameraA` and supported solid background `off_white`. Use a test render to confirm the selected avatar, narration and visual settings with your account before authorizing real renders.

Keys belong to the Synthesia account owner, not automatically the workspace. Expiration, disabled keys or owner departure can stop generation/status access. Already published public videos can continue playing independently.

## Administrator workflow

1. Open Stage guides and choose the stage and explainer/worked-example variant.
2. Review the transcript for accuracy, current feature limitations and absence of private/customer information. Save a new version.
3. Explicitly request a test render. Test videos are watermarked and cannot be published.
4. After reviewing the test in Synthesia Studio, save a new revision and explicitly accept Synthesia credits for a real render.
5. Refresh the existing video's status. Rendering and moderation must both complete.
6. Review the actual completed video in Synthesia Studio.
7. Explicitly accept public Synthesia sharing and publish. Public sharing means anyone with the provider's link can view the training video.

Generation is private until this publication step. Current published guides remain available while replacement drafts are prepared. Subscriber views never expose unreviewed admin drafts. Viewing a guide never generates a video.

## Cost and recovery safeguards

Only administrators can create, generate, reconcile or publish. Requests default to test mode in the UI; real renders require explicit per-render credit consent. Platform-wide limits allow two unresolved generation jobs and four render starts per fifteen minutes.

Creation is recorded before the provider request. Timeouts, server errors and malformed accepted responses become `UNKNOWN`, with no automatic redispatch. Reconcile the existing provider video using its UUID; its callback ID and test mode must match the saved revision. Do not generate a duplicate to work around uncertain status.

Synthesia credits are billed by Synthesia and are not part of ARK's LLM cost counter. No live renders are needed for automated tests.

## Current integration boundary

The application embeds only confirmed public Synthesia videos and provides its own accessible transcript. It does not archive video bytes, expose signed download links, record subscriber screens, generate project-specific videos or add a video download route around IMPRIMA Portal. Replacing a shared guide does not revoke previously public Synthesia links; administrators can manage their visibility in Synthesia Studio.

Official references:
- https://help.synthesia.io/en/articles/6341327-how-do-i-use-the-synthesia-api
- https://developers.synthesia.io/docs/video-api-reference/videos/create-a-video
- https://developers.synthesia.io/docs/video-api-reference/videos/retrieve-a-video
- https://developers.synthesia.io/docs/video-api-reference/videos/update-a-video
