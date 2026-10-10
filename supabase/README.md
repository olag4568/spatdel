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


### Searchable chat member directory

Run `supabase/migrations/20261012000000_chat_profile_directory.sql` in the Supabase SQL Editor after the role-aware chat migration. It creates the authenticated `spatdel_search_profiles` RPC so signed-in users can search other SPATDEL profile names and filter the directory by Tenant, Agent, Landlord, or Admin without requiring broad direct access to the profiles table.


### Member profile pages

Run `supabase/migrations/20261013000000_public_member_profiles.sql` in Supabase SQL Editor after the chat profile directory migration. It adds the authenticated `spatdel_get_public_profile` RPC, which exposes only a member's ID, display name, and role for profile pages.

- Member profiles are available at `/profile/[id]`.
- The Messages directory has a separate **View profile** action and **Message** button.
- Clicking a person's name or avatar in an open conversation opens their profile.
- Agent and landlord profiles show approved listings associated with that member.
- The profile currently uses the existing `full_name` field; SPATDEL does not yet store a separate username, bio, or profile photo field.



### Usernames, profile photos, and bios

After the existing chat directory and public profile migrations, run `supabase/migrations/20261014000000_member_profiles.sql` in Supabase SQL Editor. It adds unique usernames, profile photo URLs, bios, a public `profile-photos` storage bucket with per-user upload permissions, and secure RPCs for editing and reading public profile fields. Members can edit these details at `/profile/edit` or from Account Settings. The profile editor accepts JPG, PNG, and WebP images up to 3 MB.

The update RPC only permits changes to a member's display name, username, bio, and photo URL; it does not allow a user to change their account role. The migration refreshes the member directory and public-profile RPCs so the new public fields can be shown in search and messaging.


## Community directory and membership requests

The community directory is available at `/communities`. Signed-in members can search active communities and submit a membership request. Admins can review requests across active communities; a chairman can review requests only for communities assigned to them. Approvals create or reactivate a membership through a database function.

Before using the directory, run `migrations/20261028000000_community_membership_requests.sql` in Supabase SQL Editor after the earlier community migrations. This migration adds request status, row-level security, and a protected review function. Do not expose a Supabase service-role key in the browser.

Members with active membership can open their own community space at `/communities/[id]`. Each space has a community-scoped chat, published announcements, scheduled meetings, and a private complaint form. The new `community_chat_messages` table is protected by RLS so only active members, assigned chairmen, and admins can read or send messages in that community. Existing Community Pulse (`/community`) remains a separate shared feed/chat and is not the private chat for any one official community.

Before using community spaces, run `migrations/20261029000000_community_spaces.sql` in Supabase SQL Editor after `20261028000000_community_membership_requests.sql`. The site has not yet been built or tested against the live Supabase database, so verify the migration and role permissions in a test account before launch.
