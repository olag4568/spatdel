-- SPATDEL: allow the actual listing owner and tenant to use property enquiries.
-- This migration preserves the existing enquiry/message tables and adds participant-based RLS.
-- A listing is considered owned by its owner_id OR submitted_by account.

DROP POLICY IF EXISTS "Property owners can view enquiries for their listings" ON public.property_enquiries;
CREATE POLICY "Property owners can view enquiries for their listings"
ON public.property_enquiries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_enquiries.property_id
      AND (p.owner_id = auth.uid() OR p.submitted_by = auth.uid())
  )
  OR is_admin()
);

DROP POLICY IF EXISTS "Property owners can update enquiries for their listings" ON public.property_enquiries;
CREATE POLICY "Property owners can update enquiries for their listings"
ON public.property_enquiries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_enquiries.property_id
      AND (p.owner_id = auth.uid() OR p.submitted_by = auth.uid())
  )
  OR is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_enquiries.property_id
      AND (p.owner_id = auth.uid() OR p.submitted_by = auth.uid())
  )
  OR is_admin()
);

DROP POLICY IF EXISTS "Enquiry participants can view messages" ON public.property_messages;
CREATE POLICY "Enquiry participants can view messages"
ON public.property_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.property_enquiries e
    JOIN public.properties p ON p.id = e.property_id
    WHERE e.id = property_messages.enquiry_id
      AND (
        e.tenant_id = auth.uid()
        OR p.owner_id = auth.uid()
        OR p.submitted_by = auth.uid()
        OR is_admin()
      )
  )
);

DROP POLICY IF EXISTS "Enquiry participants can send messages" ON public.property_messages;
CREATE POLICY "Enquiry participants can send messages"
ON public.property_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.property_enquiries e
    JOIN public.properties p ON p.id = e.property_id
    WHERE e.id = property_messages.enquiry_id
      AND (
        e.tenant_id = auth.uid()
        OR p.owner_id = auth.uid()
        OR p.submitted_by = auth.uid()
        OR is_admin()
      )
  )
);

DROP POLICY IF EXISTS "Enquiry participants can update messages" ON public.property_messages;
CREATE POLICY "Enquiry participants can update messages"
ON public.property_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.property_enquiries e
    JOIN public.properties p ON p.id = e.property_id
    WHERE e.id = property_messages.enquiry_id
      AND (
        e.tenant_id = auth.uid()
        OR p.owner_id = auth.uid()
        OR p.submitted_by = auth.uid()
        OR is_admin()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.property_enquiries e
    JOIN public.properties p ON p.id = e.property_id
    WHERE e.id = property_messages.enquiry_id
      AND (
        e.tenant_id = auth.uid()
        OR p.owner_id = auth.uid()
        OR p.submitted_by = auth.uid()
        OR is_admin()
      )
  )
);
