# Amendment 010: bounded event-stream lifecycle

Root integration fixes the actual gateway lifecycle defect reported by WP12/v5
at QA head `baa8e5a1`. No event DTO, authorization policy, eight-per-actor limit,
128-total limit, healthy stream lifetime or heartbeat interval changes.

Both local HTTP proxy layers previously observed incoming request abortion only.
After a GET finishes, closing its response does not emit that request event.
Consequently each departed browser left its upstream SSE subscription alive.
The unchanged actor cap correctly rejected the ninth subscription. Direct API
disconnects did not leak. Repeated 429s were amplified by one-second client retry.

The gateway and white-label HTTP test proxy now propagate downstream response
closure to both upstream request and response. Cleanup is idempotent, healthy
responses keep flowing, and post-header upstream errors terminate the stream
instead of appending JSON to SSE. The API also rejects an already-dead transport
at handler entry, covering disconnect during awaited authentication before event
listeners were attached.

If sending the initial ready frame encounters backpressure and closes the stream,
the handler returns before allocating a heartbeat timer. A closed subscription
cannot leave an idle interval behind.

Root uses a retry deadline with exponential delay (one second to thirty seconds),
a five-second floor for 429, and the server's Retry-After value when longer.
Visibility and online events cannot bypass that deadline. Only a fresh ready
frame plus successful authority verification resets it. Frames from departed
streams cannot invalidate or reset a replacement connection. Same-context focus
and stream-ready verification share one in-flight controller request; an explicit
identity/branch/revocation change still supersedes it immediately.

Permanent actual-HTTP tests cover direct, gateway and full white-label proxy
chains: sixteen sequential connect/close transitions release every slot; eight
simultaneous streams remain open; the ninth is rejected; another actor can connect;
released slots can be reused. A delayed-auth disconnect never subscribes. Existing
long-lived heartbeat/authorization tests remain unchanged. Pure retry and session
controller checks cover bounded traffic, Retry-After and coalesced validation.

Before/after loopback probes and the exact adapted QA reproduction are preserved
in INTEGRATION/v8. They establish transport repair, not full browser acceptance.
QA must resume its affected real navigation/role/inactivity cells on the newly
published immutable composition. No TLS bypass, limit increase or production
deployment is involved.
