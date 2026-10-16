import Link from "next/link";

const features = [
  { title: "Link exclusivo", text: "Compartilhe no WhatsApp, Instagram e Google. Sua cliente agenda sozinha, sem criar conta." },
  { title: "Sem horário duplicado", text: "A agenda é verificada no momento da reserva. Dois clientes nunca pegam o mesmo horário." },
  { title: "Agenda organizada", text: "Veja o dia, a semana e os próximos atendimentos. Bloqueie folgas e almoço em segundos." },
  { title: "Clientes salvas", text: "Histórico de atendimentos de cada cliente, identificado pelo telefone." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-xl font-semibold text-brand-700">Beleza</span>
        <nav className="flex gap-2">
          <Link href="/entrar" className="btn-ghost">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn-primary">
            Testar grátis
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Pare de agendar pelo WhatsApp.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-stone-600">
          Agenda online para manicures, nail designers, cabeleireiras e esteticistas. Sua cliente escolhe o serviço, o dia e
          o horário pelo seu link.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/cadastro" className="btn-primary px-6 py-3 text-base">
            Começar 14 dias grátis
          </Link>
        </div>
        <p className="mt-3 text-sm text-stone-500">Sem cartão de crédito para testar.</p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="card">
            <h2 className="font-semibold text-stone-900">{f.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
