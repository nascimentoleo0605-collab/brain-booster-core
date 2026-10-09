CREATE TABLE public.subject_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.subject_materials TO authenticated;
GRANT ALL ON public.subject_materials TO service_role;
ALTER TABLE public.subject_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read materials" ON public.subject_materials FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert materials" ON public.subject_materials FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete materials" ON public.subject_materials FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));