export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Endereços reservados para evitar confusão com páginas do sistema.
export const RESERVED_SLUGS = new Set(["admin", "api", "painel", "entrar", "cadastro", "suporte", "ajuda", "beleza"]);

export function validateSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 40) return "O endereço precisa ter entre 3 e 40 caracteres.";
  if (!SLUG_REGEX.test(slug)) return "Use apenas letras minúsculas, números e hífens (ex.: espaco-da-ana).";
  if (RESERVED_SLUGS.has(slug)) return "Esse endereço é reservado. Escolha outro.";
  return null;
}
