"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/types";
import { Alert } from "./ui";

const MAX_SIDE = 1600;

/** Reduz a foto no próprio aparelho (fotos de celular costumam ter vários MB). */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Botão que abre a galeria/câmera do celular ou os arquivos do computador e envia as imagens. */
export function ImageUpload({
  action,
  label,
  multiple = false,
  max = 1,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  multiple?: boolean;
  max?: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>(undefined);
  const [progress, setProgress] = useState("");

  function onPick(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, max);
    if (list.length === 0) return;
    setResult(undefined);
    start(async () => {
      let last: ActionState = undefined;
      for (const [i, file] of list.entries()) {
        setProgress(list.length > 1 ? `Enviando ${i + 1} de ${list.length}…` : "Enviando…");
        const data = new FormData();
        data.set("photo", await shrink(file));
        last = await action(undefined, data);
        if (last?.error) break;
      }
      setProgress("");
      setResult(last);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <button type="button" className="btn-secondary" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? progress || "Enviando…" : label}
      </button>
      {result?.error && (
        <div className="mt-3">
          <Alert tone="error">{result.error}</Alert>
        </div>
      )}
      {result?.message && (
        <div className="mt-3">
          <Alert tone="success">{result.message}</Alert>
        </div>
      )}
    </div>
  );
}
