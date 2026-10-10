-- SCHEMA PARA O GSI PRO
-- Execute este script no SQL Editor do seu Dashboard do Supabase (https://supabase.com/dashboard)

-- 1. Tabela de Perfis (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Ajudante', 'Oficial', 'Motorista', 'Encarregado', 'Mestre de Obra')),
  avatar_url TEXT,
  hourly_rate NUMERIC DEFAULT 0,
  current_obra TEXT,
  phone TEXT,
  notification_hour INTEGER DEFAULT 17,
  notification_days INTEGER[] DEFAULT '{1,2,3,4,5,6}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Configuração de Storage para Avatares
-- IMPORTANTE: Crie um bucket chamado 'avatars' no Dashboard do Supabase -> Storage e marque como PUBLIC

-- Políticas para o Bucket 'avatars' (Cole isso no SQL Editor após criar o bucket)
-- Permitir acesso público às imagens
CREATE POLICY "Avatares Públicos" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Permitir upload de usuários autenticados
CREATE POLICY "Upload de Avatares" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Permitir atualização/deleção do próprio avatar
CREATE POLICY "Gerenciar próprios avatares" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Deletar próprios avatares" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- 3. Tabela de Registros de Ponto (Time Entries)
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  day INTEGER NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  hours TEXT NOT NULL,
  obra TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- 4. Tabela de Grupos de Chat
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT DEFAULT '1. Respeite os colegas.\n2. Use apenas para fins profissionais.\n3. Evite SPAM.',
  cover_url TEXT DEFAULT 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800',
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Membros do Grupo
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- member, admin
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(group_id, user_id)
);

-- 6. Mensagens de Grupo
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  content TEXT,
  type TEXT DEFAULT 'text', -- text, image, audio
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6.5. Mensagens Privadas (Direct/Private Messages)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text', -- text, image, audio
  media_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Reações em Mensagens
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(message_id, user_id, emoji)
);

-- 7.5. Bloqueios de Usuários (Blocked Users)
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(blocker_id, blocked_id)
);

-- 8. Habilitar RLS para novas tabelas
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- 9. Políticas de Segurança (RLS Policies)

-- Perfis: Usuários podem ver todos os perfis (para a aba Equipa), mas apenas editar o seu próprio
CREATE POLICY "Perfis visíveis para todos" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem editar seu próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seu próprio perfil" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Registros de Ponto: Usuários podem ver registros de toda a equipe, mas editar apenas os seus
CREATE POLICY "Registros de ponto visíveis para todos" ON public.time_entries
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem inserir seus próprios pontos" ON public.time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem editar seus próprios pontos" ON public.time_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios pontos" ON public.time_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Grupos: Todos podem ver os grupos (públicos e privados), mas apenas membros entram nos privados
CREATE POLICY "Grupos visíveis para todos" ON public.chat_groups
  FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode criar grupos" ON public.chat_groups
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Apenas criador pode deletar grupo" ON public.chat_groups
  FOR DELETE USING (auth.uid() = created_by);

-- Membros: Membros podem ver outros membros
CREATE POLICY "Membros visíveis para participantes" ON public.group_members
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem entrar em grupos" ON public.group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Mensagens: Membros do grupo podem ver e enviar mensagens
CREATE POLICY "Mensagens visíveis para membros" ON public.group_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Membros podem enviar mensagens" ON public.group_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid()
  ));

-- Reações
CREATE POLICY "Reações visíveis para membros" ON public.message_reactions
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem reagir" ON public.message_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Mensagens Privadas (Direct Messages): Usuários podem ver mensagens em que estão envolvidos e enviar as suas próprias
CREATE POLICY "Mensagens privadas visíveis para participantes" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Usuários podem enviar mensagens privadas" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Usuários podem atualizar mensagens privadas" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Bloqueios (Blocks)
CREATE POLICY "Visualizar bloqueios" ON public.blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "Criar bloqueio" ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Remover bloqueio" ON public.blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- 10. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 11. Tabela de Tokens de Notificação Push (FCM / PWA)
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'pwa',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, token)
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seus tokens" ON public.user_push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Leitura de tokens para notificações" ON public.user_push_tokens
  FOR SELECT USING (auth.role() = 'authenticated');

-- 12. Tabela de Chamadas de Vídeo e Áudio Daily.co (Calls)
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  room_url TEXT NOT NULL,
  call_type TEXT DEFAULT 'video', -- video, audio
  status TEXT DEFAULT 'initiated', -- initiated, connected, missed, declined, completed
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes podem visualizar chamadas" ON public.calls
  FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Usuários podem registrar chamadas" ON public.calls
  FOR INSERT WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participantes podem atualizar status das chamadas" ON public.calls
  FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

