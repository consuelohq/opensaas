# Personal answering devices

Phone numbers → Receive calls separates the team number customers dial from the rep's personal answering devices. Browser audio is prepared when the rep explicitly starts receiving and grants microphone access. A saved phone destination is not proof of ownership or physical reachability.

An authenticated provisioned rep can POST `/v1/inbound/operator/devices` with `{revision, phone}`; `phone:null` removes personal phone forwarding, including a previously seeded legacy destination. Readback comes from the operator snapshot as a masked suffix and source (`workspace` or `self`). Raw numbers never enter snapshots or capacity/routing evidence. Phone values use the shared contacts normalizer and authenticated encryption with the existing callback-recipient secret, bound to both workspace and rep. Missing encryption fails closed.

The store is a forward-only migration, `20261106_017_rep_answering_devices`. Static bootstrap endpoints remain the default until the first explicit personal edit. A removal tombstone survives restart. Each edit serializes against the workspace authority lock, checks the current device revision and authenticated rep, and rejects any owned capacity, including connecting/unknown/wrap-up. Successful edits withdraw readiness and clear selected endpoints; starting again requires the current device revision. Provider dispatch captures the resolved destination inside that same authority transaction. Device changes cannot reinterpret an escaped command.

The API never accepts a target rep/workspace from the body. It does not edit caller IDs, buy numbers, start receiving, create verification calls, or alter another rep's device settings. Membership and routing eligibility are separate administration contracts.

Validation: operator projection/privacy, controller revision/readiness, device UI, actual Postgres persistence/encryption/removal/concurrent edit and synthetic carrier destination tests. Run the enabled service-backed command in LAUNCH-QA.md to execute the database cases without skips. Browser notification/ringer acceptance remains DEV-1656; this setting alone does not prove browser media or carrier delivery.
