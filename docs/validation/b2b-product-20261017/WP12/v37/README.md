# Corrected QA repeated complete verification

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `92d951c2a6de3b954ef617ecabd3d02e245c46e8`. The two-file correction requires positive exact side-input counts and verifies every expected left value before incomplete-side completion rejection. It bounds the real history heading wait to 30 seconds and records observed timing/statuses without sleeps or altered app responses.

ALTERNATIVES-005 and ALTERNATIVES-009 each passed three complete repetitions across Chromium/WebKit at 320, 430, and 1440 in both modes: 36/36 instances per mode, 72/72 total. This represents 12 unique scenario/context combinations per mode, each repeated three times. Zero retries, timeouts or skips. All actual owned schema IDs captured live and removed after each run; source/build hashes verified before and after execution.

There are 72 real history heading observations; measured wait range 163–2195ms. Acknowledgments over 5000 ms: 0. All observed headings became visible within the 30-second bound. These measurements do not prove when the UI became ready in the original failed attempt or establish an app root cause. Every full scenario continued through its original app/API/export assertions.

[Original complete failed matrices](../v36/README.md) remain immutable on QA ff78328 with all four failures. Targeted repetitions are not pooled into full acceptance. New uncapped full matrices run separately on unchanged app d2adf75 and this exact corrected QA pin. HTTPS remains unexecuted without existing trusted TLS inputs. GitGuardian remains neutral because this PR exceeds configured scan size; no clean scan is claimed.
