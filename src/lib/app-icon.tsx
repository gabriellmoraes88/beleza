import { ImageResponse } from "next/og";

// Ícone do app (tela inicial e avisos): a grade da logo num quadrado grafite.
const DOTS = [
  [true, false, false],
  [true, true, false],
  [true, false, true],
  [true, true, false],
];

export function appIcon(size: number, headers?: Record<string, string>) {
  const dot = Math.round(size * 0.1);
  const gap = Math.round(size * 0.045);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#292524",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {DOTS.map((row, i) => (
            <div key={i} style={{ display: "flex", gap }}>
              {row.map((on, j) => (
                <div
                  key={j}
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: dot / 2,
                    background: on ? "#fafaf9" : "rgba(250,250,249,0.3)",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: size, height: size, headers },
  );
}
