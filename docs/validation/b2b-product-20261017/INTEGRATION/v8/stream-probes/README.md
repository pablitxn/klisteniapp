# Independent SSE lifecycle reproduction

Executed read-only by the architecture reviewer on Node v24.19.0 from
`/workspace/klisteniapp`. Repository HEAD was
`c10cc3d398aba821d53a59b248c09090b0110992`. At first execution the three relevant
modules matched that revision; unrelated integration edits were present.

The exact inline scripts and their stdout are preserved here. The `.before.jsonl`
files transcribe the successful tool outputs byte for byte, including final
newlines; they were preserved after execution because root began the fix while
the reviewer was reporting it. The scripts originally ran via stdin, so rerun
them from the repository root with:

```sh
node --input-type=module < /tmp/b2b-stream-leak-proof/proxy-leak.mjs
node --input-type=module < /tmp/b2b-stream-leak-proof/late-entry-leak.mjs
```

Both probes use actual Node HTTP sockets and the actual ProductEventHub and
serveProductEvents. LISTEN and authorization are synthetic in-memory stubs. No
PostgreSQL, accounts, sessions, grants, production data, limits or repository
files are modified. Every temporary server/listener is closed in each probe.

## Proxy cancellation leak

Each of ten sequential requests consumes the initial ready frame and immediately
destroys the client. A direct API control releases every listener. Each HTTP
proxy independently retains eight listeners and then produces the real hub's
429 response, with its original eight-per-actor cap unchanged. Both proxy paths
observe only request.aborted, which does not signal a completed GET's later
downstream response disconnection. They need response.close cancellation of
both upstream request and upstream response.

## Already-closed API entry leak

The upstream delays serveProductEvents invocation by 100 ms, simulating preceding
authentication/preflight. The client disconnects after the HTTP handler has
entered. The function subsequently sees request.aborted and response.destroyed
already true, misses the past close event, subscribes anyway, and retains one
listener. Rejecting an already-dead transport before subscribing closes this
distinct race; the existing post-subscribe closed fence must remain.

These probes establish lifecycle defects, not complete browser or trusted HTTPS
acceptance. Root owns fixes, permanent regressions and the composed QA rerun.
