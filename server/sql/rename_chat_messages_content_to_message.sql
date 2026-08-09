-- Renomeia chat_messages.content -> message
alter table public.chat_messages rename column content to message;
