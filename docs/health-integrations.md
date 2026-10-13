<a id="integraciones-de-salud-y-acceso-a-la-nube"></a>
# Health integrations and cloud access

The public demo retains local recording, import and dashboards. A future connection
that stores data on a server belongs to an operator-configured instance; this
distribution does not automatically connect providers, users or credentials.
[Modes and configuration](deployment.md).

Status checked against official sources on **October 4, 2026**. Dashboards, goals
and [normalized JSON](health-import.md) import are available in Klisteni. **No
automatic Google Health, Health Connect or Samsung connection is implemented.**
Cloud-enabled accounts prepare persistence for future integrations; payment or
lifetime access does not enable a provider that is not integrated yet.

<a id="dos-rutas-distintas"></a>
## Two distinct routes

| Route | Data source | Pending dependency |
| --- | --- | --- |
| Google Health API | Google cloud API with OAuth 2.0 | Project admission, provider configuration/authorization and connector implementation |
| Health Connect | Phone storage through the Android API | Klisteni Android application, permissions and synchronization protocol |

Google sign-in grants no Health Connect permission and does not establish that
watch data is available through Google Health API. The [existing Android proposal](health-sync.md)
retains Samsung Health → Health Connect → Android application → Klisteni account
and requires testing on a real phone.

<a id="google-health-api-disponibilidad-real"></a>
## Google Health API: actual availability

Google Health API is a new web API using Google OAuth 2.0. At the documented review,
the official availability notice stated: **“we are not onboarding new projects at
this time”**. A new project's integration cannot be promised active until Google
enables access. This route does not depend on restoring Google Fit or using the
old Fitbit API. [Published availability](https://developers.google.com/health/get-started).

Public instructions allow preparation: Google Cloud project, enabled API, web
OAuth client, return URI and test users. The read example uses
`https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly` and
`GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints`.
This establishes the contract's existence, not Klisteni project access or coverage
of every dashboard category. [Official codelab](https://developers.google.com/health/codelabs/make-your-first-api-call).

<a id="camino-de-implementación-cuando-exista-acceso"></a>
## Implementation path once access is available

1. **Confirm project enablement.** Complete provider steps and a real read with an
   authorized account. Record categories, provenance, historical interval and
   available permissions. One exercise response does not establish a full health catalog.
2. **Add separate authorization.** Link health permission from a valid Klisteni
   session with cloud access. Store one-use OAuth state on the server, validate
   the callback and restrict permissions to offered categories. Health authorization
   changes neither the user's role nor plan.
3. **Store credentials on the server.** Encrypt tokens with a key outside the DB
   and Git; never send them to localStorage, personal exports or analytics. Request
   offline access only for agreed synchronization. Google recommends refreshing
   tokens when needed and avoiding scheduled mass refreshes.
   [Access and authorization](https://developers.google.com/health/migration/data-access).
4. **Normalize without inventing data.** Preserve source ID/modification, units,
   timezone and provenance; paginate the full window. Implement corrections,
   deletions and cursors before calling synchronization automatic. The current
   file importer does not implement that incremental protocol.
5. **Enforce cloud access.** Server checks must block new ingestion after trial or
   payment expiry while retaining history reads/exports. Renewing a subscription
   does not renew permissions revoked in Google.
6. **Separate disconnection and deletion.** Revoke tokens and stop jobs on
   disconnection; delete data only when the person chooses it. Isolate credentials,
   queues and cursors by user and connection.
7. **Test actual limits.** Partial/revoked permission, expired token, pagination,
   repeated batches, correction, deletion, account change, missing cloud access
   and failure recovery. Compare with the source account without logging personal measurements.

The UI must show the localized **Pendiente de habilitación** status until
authorization, reading, persistence and revocation are tested. A connect button,
issued token or successful empty response does not justify “synchronized”. The
last measurement, last query and last confirmed save are distinct instants.

<a id="lo-que-se-puede-usar-ahora"></a>
## Available now

Use manual records, goals, dashboards and normalized files. In local mode they
remain in the browser; an account with trial, paid period or lifetime entitlement
can save them in the cloud. Optional analytics consent remains separate from
personal-health-data authorization. Dashboard values, notes, routines, credentials
and provider responses are not sent to Umami.
