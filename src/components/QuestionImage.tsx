import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function QuestionImage({ path }: { path: string | null | undefined }) {
  const { data } = useQuery({
    queryKey: ["question-image", path],
    enabled: !!path,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("question-images").createSignedUrl(path ?? "", 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 45 * 60 * 1000,
  });
  return data ? <img src={data} alt="Imagem da questão" className="my-4 max-h-96 max-w-full rounded-md object-contain" /> : null;
}