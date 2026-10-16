import { CopyButton } from "./copy-button";

export function ShareLink({ url, studioName }: { url: string; studioName: string }) {
  const text = `Agende seu horário com ${studioName} pelo link: ${url}`;
  return (
    <div className="space-y-3">
      <p className="break-all rounded-xl bg-stone-50 px-3 py-2 font-mono text-sm text-stone-800">{url}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={url} />
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-secondary">
          Enviar no WhatsApp
        </a>
        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost">
          Ver página
        </a>
      </div>
    </div>
  );
}

