import { appIcon } from "@/lib/app-icon";

// Ícone usado pelo iPhone ao adicionar o Bellink à tela inicial.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
