import Link from "next/link";

const features = [
  {
    title: "Link exclusivo",
    text: "Compartilhe no WhatsApp, Instagram e Google. Sua cliente agenda sozinha, sem criar conta.",
    icon: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  },
  {
    title: "Sem horário duplicado",
    text: "A agenda é verificada no momento da reserva. Dois clientes nunca pegam o mesmo horário.",
    icon: "M9 12l2 2 4-4M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z",
  },
  {
    title: "Agenda organizada",
    text: "Veja o dia, a semana e os próximos atendimentos. Bloqueie folgas e almoço em segundos.",
    icon: "M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  },
  {
    title: "Clientes salvas",
    text: "Histórico de atendimentos de cada cliente, identificado pelo telefone.",
    icon: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8",
  },
];

const steps = [
  { title: "Crie sua conta", text: "Cadastre seus serviços, preços e horários de atendimento. Leva poucos minutos." },
  { title: "Compartilhe seu link", text: "Coloque na bio do Instagram, no status e nas mensagens do WhatsApp." },
  { title: "Receba agendamentos", text: "Cada reserva cai direto na sua agenda, sem conversa de ida e volta." },
];

const faq = [
  {
    q: "Minha cliente precisa baixar aplicativo ou criar conta?",
    a: "Não. Ela abre o seu link, escolhe o serviço, o dia e o horário e informa só nome e telefone.",
  },
  {
    q: "Preciso de cartão de crédito para testar?",
    a: "Não. Você usa tudo por 14 dias sem cadastrar cartão. Se gostar, assina depois.",
  },
  {
    q: "Consigo bloquear folgas, almoço e feriados?",
    a: "Sim. Você define seus horários por dia da semana e bloqueia qualquer período na agenda.",
  },
  {
    q: "A cliente paga pelo site?",
    a: "Não. O pagamento do serviço continua sendo feito no studio, do jeito que você já faz hoje.",
  },
];

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const CHECK = "M5 12.5l4.5 4.5L19 7.5";

/** Ilustração do link de agendamento num celular (feita só com HTML). */
function PhoneMockup() {
  const services = [
    ["Manicure", "45 min", "R$ 45,90"],
    ["Pé + Mão", "1h15", "R$ 89,90"],
    ["Alongamento em gel", "2h", "R$ 150,00"],
  ];
  return (
    <div className="relative mx-auto w-[280px] sm:w-[320px]" aria-hidden>
      <div className="rounded-[2.6rem] bg-stone-900 p-2.5 shadow-2xl shadow-stone-900/25">
        <div className="overflow-hidden rounded-[2.1rem] bg-white">
          <div className="flex justify-center pt-2">
            <span className="h-1.5 w-16 rounded-full bg-stone-200" />
          </div>
          <div className="px-4 pb-5 pt-3">
            <div className="h-24 rounded-2xl bg-gradient-to-br from-stone-200 via-stone-300 to-stone-400" />
            <p className="mt-3 text-base font-bold tracking-tight text-stone-900">Studio da Ana</p>
            <p className="text-[11px] text-stone-500">Av. Paulista, 1000 · São Paulo</p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-semibold text-white">
                Compartilhar
              </span>
              <span className="rounded-full border border-stone-300 px-2.5 py-1 text-[10px] font-semibold text-stone-800">
                WhatsApp
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold text-stone-900">Serviços</p>
            <ul className="mt-1 divide-y divide-stone-100">
              {services.map(([name, time, price], i) => (
                <li key={name} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-[12px] font-medium text-stone-900">{name}</p>
                    <p className="text-[10px] text-stone-500">
                      {time} · <span className="font-semibold text-stone-800">{price}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${
                      i === 0 ? "bg-stone-900 text-white" : "border border-stone-300 text-stone-800"
                    }`}
                  >
                    {i === 0 ? "Adicionado" : "Adicionar"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl bg-stone-900 py-2.5 text-center text-[11px] font-semibold text-white">
              Escolher horário
            </div>
          </div>
        </div>
      </div>

      {/* Notificação flutuante */}
      <div className="absolute -left-12 top-12 hidden w-52 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:block lg:-left-36">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon d={CHECK} className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-stone-900">Novo agendamento</p>
            <p className="text-[10px] text-stone-500">Maria · Manicure · Hoje, 14:00</p>
          </div>
        </div>
      </div>
      <div className="absolute -right-6 -bottom-5 hidden rounded-2xl border border-stone-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur sm:block lg:-right-16">
        <p className="text-[10px] text-stone-500">Agendamentos esta semana</p>
        <p className="text-lg font-bold tracking-tight text-stone-900">+ 32</p>
      </div>
    </div>
  );
}

/** Ilustração de um dia da agenda. */
function AgendaMockup() {
  const items = [
    ["09:00", "Juliana", "Manicure", "Confirmado"],
    ["10:00", "Carla", "Pé + Mão", "Confirmado"],
    ["12:00", "Almoço", "Bloqueado", ""],
    ["14:00", "Maria", "Alongamento em gel", "Novo"],
  ];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur" aria-hidden>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Hoje</p>
        <p className="text-xs text-stone-400">4 atendimentos</p>
      </div>
      <ul className="space-y-2">
        {items.map(([time, name, service, status]) => (
          <li
            key={time}
            className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${
              status ? "bg-white text-stone-900" : "border border-dashed border-white/20 text-stone-400"
            }`}
          >
            <span className={`w-12 text-sm font-semibold ${status ? "text-stone-900" : ""}`}>{time}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className={`truncate text-xs ${status ? "text-stone-500" : ""}`}>{service}</p>
            </div>
            {status && (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  status === "Novo" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"
                }`}
              >
                {status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1 bg-white">
      {/* Topo */}
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight text-stone-900">
            Bellink
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#como-funciona" className="btn-ghost hidden sm:inline-flex">
              Como funciona
            </a>
            <a href="#preco" className="btn-ghost hidden sm:inline-flex">
              Preço
            </a>
            <Link href="/entrar" className="btn-ghost">
              Entrar
            </Link>
            <Link href="/cadastro" className="btn-primary rounded-full px-5">
              Testar grátis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_20%,#f5f5f4_0%,transparent_70%),radial-gradient(50%_50%_at_10%_90%,#fafaf9_0%,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Agenda online para studios de beleza
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-stone-900 sm:text-6xl lg:text-7xl">
              Pare de agendar pelo WhatsApp.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-stone-600 lg:mx-0">
              Agenda online para manicures, nail designers, cabeleireiras e esteticistas. Sua cliente escolhe o serviço, o
              dia e o horário pelo seu link.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/cadastro" className="btn-primary rounded-full px-7 py-3.5 text-base">
                Começar 14 dias grátis
              </Link>
              <a href="#como-funciona" className="btn-secondary rounded-full px-7 py-3.5 text-base">
                Ver como funciona
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-stone-500 lg:justify-start">
              {["Sem cartão de crédito para testar", "Pronto em minutos", "Cancele quando quiser"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Icon d={CHECK} className="h-4 w-4 text-stone-900" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* Recursos */}
      <section className="border-t border-stone-100 bg-stone-50/60 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Por que Bellink</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Menos mensagens. Mais atendimentos.
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              Tudo o que você precisa para organizar seus horários, sem complicação.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-3xl border border-stone-200 bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-stone-200/60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                  <Icon d={f.icon} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-stone-900">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Como funciona</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Sua agenda no link da bio em 3 passos
            </h2>
          </div>
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative text-center md:text-left">
                <span className="text-6xl font-bold tracking-tight text-stone-200">0{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold text-stone-900">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Destaque escuro */}
      <section className="bg-stone-950 py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">Sem horário duplicado</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Dois clientes nunca pegam o mesmo horário.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-300">
              A agenda é verificada no momento da reserva. Folgas, almoço e feriados ficam bloqueados, e você vê o dia
              inteiro num só lugar.
            </p>
            <Link
              href="/cadastro"
              className="btn mt-8 rounded-full bg-white px-7 py-3.5 text-base text-stone-900 hover:bg-stone-200"
            >
              Começar 14 dias grátis
            </Link>
          </div>
          <AgendaMockup />
        </div>
      </section>

      {/* Preço */}
      <section id="preco" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Preço</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Um plano. Tudo incluso.</h2>
          </div>
          <div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-xl shadow-stone-200/50 sm:p-10">
            <p className="text-sm font-semibold text-stone-500">Plano Studio</p>
            <p className="mt-3 flex items-end gap-1">
              <span className="text-5xl font-bold tracking-tight text-stone-900">R$ 49,90</span>
              <span className="pb-1.5 text-stone-500">/mês</span>
            </p>
            <p className="mt-2 text-sm text-stone-600">14 dias grátis. Sem cartão de crédito para testar.</p>
            <ul className="mt-7 space-y-3 text-stone-700">
              {[
                "Link de agendamento exclusivo",
                "Agendamentos ilimitados",
                "Agenda por dia, semana e lista",
                "Bloqueio de folgas, almoço e feriados",
                "Histórico de clientes",
                "Fotos do seu studio na página",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white">
                    <Icon d={CHECK} className="h-3 w-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/cadastro" className="btn-primary mt-8 w-full rounded-full py-3.5 text-base">
              Começar 14 dias grátis
            </Link>
          </div>
        </div>
      </section>

      {/* Perguntas */}
      <section className="border-t border-stone-100 bg-stone-50/60 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Perguntas frequentes</h2>
          <div className="mt-10 divide-y divide-stone-200 rounded-3xl border border-stone-200 bg-white">
            {faq.map((item) => (
              <details key={item.q} className="group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-stone-900">
                  {item.q}
                  <span className="text-xl text-stone-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-stone-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Chamada final */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-[2.5rem] bg-stone-900 px-6 py-16 text-center text-white sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
              Sua agenda no link da bio.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-stone-300">
              Comece hoje e deixe suas clientes agendarem sozinhas.
            </p>
            <Link
              href="/cadastro"
              className="btn mt-8 rounded-full bg-white px-8 py-3.5 text-base text-stone-900 hover:bg-stone-200"
            >
              Começar 14 dias grátis
            </Link>
            <p className="mt-3 text-sm text-stone-400">Sem cartão de crédito para testar.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-stone-500 sm:flex-row">
          <p>
            <span className="font-bold text-stone-900">Bellink</span> · Sua agenda no link da bio.
          </p>
          <div className="flex gap-5">
            <Link href="/entrar" className="hover:text-stone-900">
              Entrar
            </Link>
            <Link href="/cadastro" className="hover:text-stone-900">
              Criar conta
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
