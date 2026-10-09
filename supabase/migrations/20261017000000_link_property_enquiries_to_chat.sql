-- Connect property enquiries to the main SPATDEL Messages inbox.
-- The same conversation is used by the tenant and the listing owner.
ALTER TABLE public.property_enquiries
  ADD COLUMN IF NOT EXISTS conversation_id uuid
  REFERENCES public.spatdel_chat_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS property_enquiries_conversation_id_idx
  ON public.property_enquiries(conversation_id);

-- Mirror enquiry messages into the main chat inbox.
CREATE OR REPLACE FUNCTION public.sp_atdel_sync_enquiry_message_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_conversation_id uuid;
BEGIN
  -- Prevent the reciprocal sync trigger from creating a loop.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT e.conversation_id
    INTO linked_conversation_id
  FROM public.property_enquiries e
  WHERE e.id = NEW.enquiry_id;

  IF linked_conversation_id IS NOT NULL THEN
    INSERT INTO public.spatdel_chat_messages (conversation_id, sender_id, body, created_at)
    VALUES (linked_conversation_id, NEW.sender_id, NEW.message, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_atdel_sync_chat_message_to_enquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_enquiry_id uuid;
BEGIN
  -- Prevent the reciprocal sync trigger from creating a loop.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT e.id
    INTO linked_enquiry_id
  FROM public.property_enquiries e
  WHERE e.conversation_id = NEW.conversation_id
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF linked_enquiry_id IS NOT NULL THEN
    INSERT INTO public.property_messages (enquiry_id, sender_id, message, created_at)
    VALUES (linked_enquiry_id, NEW.sender_id, NEW.body, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spatdel_sync_enquiry_message_to_chat ON public.property_messages;
CREATE TRIGGER spatdel_sync_enquiry_message_to_chat
AFTER INSERT ON public.property_messages
FOR EACH ROW EXECUTE FUNCTION public.sp_atdel_sync_enquiry_message_to_chat();

DROP TRIGGER IF EXISTS spatdel_sync_chat_message_to_enquiry ON public.spatdel_chat_messages;
CREATE TRIGGER spatdel_sync_chat_message_to_enquiry
AFTER INSERT ON public.spatdel_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.sp_atdel_sync_chat_message_to_enquiry();
