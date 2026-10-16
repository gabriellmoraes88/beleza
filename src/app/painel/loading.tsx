// Aparece na hora em que um item do menu é tocado, enquanto a página carrega.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-lg bg-stone-200" />
      <div className="h-4 w-72 max-w-full rounded bg-stone-200/70" />
      <div className="space-y-3 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-stone-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
