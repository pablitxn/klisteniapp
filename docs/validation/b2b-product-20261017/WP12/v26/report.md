# WP12 v26: one Markdown representation checksum correction

This additive receipt corrects one published representation hash in v25 at
`575564720fe64eec9438829c0b0941e49f3bbdc9`. The Markdown cell table was
formatted after the sanitizer computed its publishedDecodedSha256. Consequently
that one inner sanitization-ledger entry describes the pre-format representation.
The v25 evidence-sha256.txt manifest already hashes the formatted committed file
correctly. Original v25 files and history remain unchanged.

[Correction and committed-blob checks](sanitization-hash-correction.json) record
the old inner hash, actual published decoded hash, exact source receipt and every
sanitization-ledger entry check across v23/v24/v25. All other entries match. The
live cell JSON, raw result statuses, source hashes and browser counts are
unaffected. R38 remains a separate two-cell passing wave; R34/R35 remain active.
This receipt executes no additional browser tests and adds no passing case.

Future promoted Markdown is formatted before its publication hash is sealed, or
its immutable encoded representation is preserved. JSON and encoded CLI/error
reports are not passed through Markdown formatting. The full-run collector still
accepts either completed run independently, so neither matrix waits for the other
to receive a receipt. No application or shared test configuration changes.
