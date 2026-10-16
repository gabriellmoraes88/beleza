import Link from "next/link";
import { Logo, NailMark } from "@/components/logo";

const features = [
  { title: "Link exclusivo", text: "Compartilhe no WhatsApp, Instagram e Google. Sua cliente agenda sozinha, sem criar conta." },
  { title: "Sem horário duplicado", text: "A agenda é conferida no momento da reserva. Duas clientes nunca pegam o mesmo horário." },
  { title: "Agenda organizada", text: "Veja o dia, a semana e os próximos atendimentos. Bloqueie folgas e almoço em segundos." },
  { title: "Clientes salvas", text: "Histórico de atendimentos de cada cliente, reconhecida pelo telefone." },
];

function FramedNote({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`border border-white/80 px-3 py-2 text-[10px] uppercase leading-relaxed tracking-[0.18em] text-white ${className}`}>
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex gap-2">
          <Link href="/entrar" className="btn-ghost">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn-primary">
            Testar grátis
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div>
          <p className="eyebrow">Agendamento online para studios de beleza</p>
          <h1 className="mt-4 text-5xl leading-[1.05] text-ink sm:text-6xl">
            Sua agenda
            <br />
            no <em className="text-brand-600">link da bio.</em>
          </h1>
          <p className="mt-5 max-w-md text-lg text-stone-600">
            Para manicures, nail designers, cabeleireiras e esteticistas. Sua cliente escolhe o serviço, o dia e o horário
            sozinha, e você para de agendar pelo WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/cadastro" className="btn-primary px-7 py-3 text-base">
              Começar 14 dias grátis
            </Link>
            <span className="text-sm text-stone-500">Sem cartão de crédito.</span>
          </div>
        </div>

        {/* Composição inspirada na estética "clean nails" */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_90%_at_30%_20%,#f8e9e5_0%,#e7c5bf_55%,#c99891_100%)] shadow-xl shadow-brand-200/50">
          <div className="absolute inset-x-0 top-[12%] flex justify-center gap-3 sm:gap-5">
            {[
              ["-rotate-[16deg] translate-y-10", "h-40 sm:h-48"],
              ["-rotate-[5deg]", "h-48 sm:h-60"],
              ["rotate-[5deg] translate-y-2", "h-48 sm:h-56"],
              ["rotate-[15deg] translate-y-14", "h-36 sm:h-44"],
            ].map(([pose, size]) => (
              <div key={pose} className={pose}>
                <NailMark className={`${size} w-auto drop-shadow-[0_10px_18px_rgba(127,71,77,0.25)]`} />
              </div>
            ))}
          </div>
          <FramedNote className="absolute right-5 top-[60%] max-w-[11rem]">
            Agendamento confirmado na hora, sem troca de mensagens.
          </FramedNote>
          <FramedNote className="absolute left-5 top-[73%] hidden max-w-[10rem] sm:block">Funciona no celular da sua cliente.</FramedNote>
          <p className="absolute bottom-5 right-6 font-display text-4xl text-white drop-shadow-sm sm:text-5xl">
            bellink
          </p>
        </div>
      </section>

      <section className="border-t border-brand-100 bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card">
              <h2 className="text-xl text-ink">{f.title}</h2>
              <p className="mt-2 text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-10 text-center text-sm text-stone-500">
        <Logo size="sm" />
        <p>Sua agenda no link da bio.</p>
      </footer>
    </main>
  );
}
