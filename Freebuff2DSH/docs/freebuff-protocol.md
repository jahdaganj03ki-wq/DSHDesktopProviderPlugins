# Freebuff protocol notes

The official client currently documents a session admission endpoint and
separate GET/DELETE session operations. Older public gateways use a POST to the
legacy session path. This project deliberately does not silently retry an
admission POST after an unknown timeout because the first request may already
have consumed or claimed a session.

The model list is advisory. Account entitlement and availability are decided
by Freebuff at admission time. The provider therefore maps provider payloads
to stable internal classes instead of treating every 429 as quota exhaustion.
