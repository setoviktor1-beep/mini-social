## Sargas RLS Audit

Scope reviewed:
- `supabase/migrations/`
- Server code paths using `createClient()` and related Supabase server helpers that touch `profiles`, `service_requests`, or `receipts`

### Finding 1: `service_requests` ownership can be reassigned to arbitrary users, which grants third-party read access
Severity: High

Evidence:
- `supabase/migrations/20260323090000_harden_profile_and_service_request_rls.sql:107`
- `supabase/migrations/20260323090000_harden_profile_and_service_request_rls.sql:111`
- `supabase/migrations/20260323090000_harden_profile_and_service_request_rls.sql:112`

Problem:
- The active `UPDATE` policy is:
  - `USING (auth.uid() = client_id OR auth.uid() = master_id)`
  - `WITH CHECK (auth.uid() = client_id OR auth.uid() = master_id)`
- This only requires the caller to remain either the `client_id` or the `master_id` on the new row.
- It does not freeze the opposite ownership column.

Impact:
- A legitimate client can update their own request and set `master_id` to any arbitrary user UUID.
- That newly assigned user then immediately satisfies the `SELECT` policy at `supabase/migrations/20260323090000_harden_profile_and_service_request_rls.sql:101` and can read the request.
- An assigned master can likewise rewrite `client_id` to any arbitrary UUID while keeping `master_id = auth.uid()`.
- Result: users can tamper with request ownership metadata and disclose a request to unrelated third parties.

Minimal exploit example:
```sql
update public.service_requests
set master_id = '<victim-user-uuid>'
where id = '<my-request-id>';
```

Why this is an RLS flaw:
- The policy protects access based on row ownership fields, but it also allows attackers who already control one side of the row to rewrite the other side of the access-control boundary.
- That converts an allowed self-update into cross-user disclosure.

Recommended fix:
- Split update permissions by actor and lock ownership columns in `WITH CHECK`.
- At minimum:
  - clients should only be able to update client-controlled fields while `client_id` stays `auth.uid()`
  - masters should only be able to update master-controlled fields while `master_id` stays `auth.uid()`
  - changes to `client_id` and `master_id` should be disallowed for ordinary authenticated users and handled only by trusted backend code if needed
- A trigger that rejects changes to `client_id`/`master_id` for non-service-role callers is the safest patch.

### No additional verified cross-user findings in scope
- `profiles`: I did not find a current scoped path that lets ordinary users read or modify other users' profile rows through RLS in the reviewed migrations/server helpers.
- `receipts`: table RLS is self-scoped (`auth.uid() = user_id`), and I did not find a verified cross-user table read/write path in the reviewed scope.
