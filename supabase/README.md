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

This adds participant-based direct chats, secure row-level policies, and the `spatdel_start_chat` function. It also adds property review metadata (`approval_status`, `submitted_by`, `reviewed_by`, `reviewed_at`, `review_note`, and `images`) while keeping the existing `verified` flag synchronized with approval status.

**Important:** this migration creates the database foundation only. The chat screens, agent listing form, image-storage setup, and admin review controls still need to be wired into the website before the full workflow is ready. Do not treat a successful migration as meaning those UI features are finished.
