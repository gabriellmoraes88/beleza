import { ImageResponse } from "next/og";

// Prévia que aparece ao compartilhar o link no WhatsApp, Instagram etc.
export const alt = "Bellink · Sua agenda no link da bio.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Mesma grade da logo (src/components/logo.tsx): os pontos escuros desenham um "b".
const DOTS = [
  [true, false, false],
  [true, true, false],
  [true, false, true],
  [true, true, false],
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4efe8",
          padding: "72px 80px",
          color: "#1c1917",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {DOTS.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                {row.map((on, j) => (
                  <div
                    key={j}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      background: on ? "#1c1917" : "#d6cfc6",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 112, letterSpacing: -4, lineHeight: 1 }}>Bellink</div>
            <div style={{ fontSize: 40, color: "#57534e", marginTop: 14 }}>Sua agenda no link da bio.</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 40, lineHeight: 1.3, maxWidth: 980 }}>
            Agenda online para manicures, cabeleireiras e esteticistas. Sua cliente marca sozinha pelo seu link.
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 28, color: "#57534e" }}>
            <span>14 dias grátis</span>
            <span>·</span>
            <span>Sem cartão para testar</span>
            <span>·</span>
            <span>Pix e cartão</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
