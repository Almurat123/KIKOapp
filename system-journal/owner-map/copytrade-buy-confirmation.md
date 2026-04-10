# Owner Map: Copytrade Buy Confirmation

Updated: 2026-04-10

## Owns

- Promoting a pending copytrade position into `open`
- Persisting confirmed follower-buy amount
- Recording follower buy facts
- Reconciling buy-confirm races against pending mirror-sell state
- Releasing durable historical target-sell events into exit scheduling
- Keeping canonical order state aligned with the confirmed buy outcome

## Does Not Own

- Detecting target sells from webhook or chain history
- Executing exit intents
- Long-tail stale-position cleanup in monitors
- Wallet price snapshot availability

## Boundary Rule

If buy confirmation can prove the follower buy succeeded and a durable target
sell already exists, this owner must not leave the position in a plain `open`
state without replaying exit work.

## Failure Signal

If an `open` position repeatedly logs `TP/SL check skipped: Price not available`
and has no exit intent, first inspect whether buy confirmation missed a durable
target-sell replay.
