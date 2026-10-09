# SPATDEL Supabase SQL

SQL setup and migration scripts for the SPATDEL Supabase database are stored in this folder.

## Apply the lifetime tenant spin reward

1. Open your SPATDEL project in the Supabase dashboard.
2. Open **SQL Editor** and create a new query.
3. Copy the complete contents of `migrations/20261009000000_tenant_lifetime_spin_reward.sql` from this repository into the query.
4. Run it once and confirm that it completes successfully.

The migration adds the `tenant_rewards.reward_amount` and `spun_at` fields, restricts tenants to reading their own reward, and creates the secure `claim_tenant_spin_reward()` function. The function validates the signed-in user's `profiles.role`, chooses one of the six allowed naira amounts, and prevents a second lifetime claim. It does not modify any property's stored price.

Do not manually grant clients permission to insert, update, or delete reward rows. Reward claims must go through the database function.

## Apply role-aware chat and property review

After reviewing the SQL migration, open the Supabase dashboard for SPATDEL, go to **SQL Editor**, and run the complete file:
`migrations/20261010000000_role_chat_and_property_review.sql`.

This adds participant-based direct chats, secure row-level policies, and the `spatdel_start_chat` function. It also adds property review metadata (`approval_status`, `submitted_by`, `reviewed_by`, `reviewed_at`, `review_note`, and `images`), synchronizes `verified` with approval status, creates the public `property-images` storage bucket, and adds agent/landlord submission policies.

The follow-up migration `20261011000000_listing_purpose_and_admin_delete.sql` adds the explicit `listing_purpose` field (`rent` or `sale`), ensures descriptions can be null, and grants admins permission to delete unsuitable property listings. Run this migration after the role-chat/property-review migration. It is safe to run even if the first migration already added the listing-purpose column and admin delete policy.

The website now has:
- An agent/landlord property submission dashboard at `/agent`. Signed-in agents and landlords can upload up to five photos, submit listing details for review, and track submission status. Photos are optional during initial submission, but admins may request them before approval.
- Admin review controls in `/admin`, including submitted-photo viewing and approval/pending status.
- Universal direct messaging at `/messages`. Signed-in users can start chats with tenants, agents, landlords, or admins; each message shows the sender's role from their SPATDEL profile. The landing-page profile menu and tenant dashboard link to Messages.

**Important:** the migration must be run manually in Supabase SQL Editor before these features can work. The website code has not yet been verified against your live Supabase database or built locally.
