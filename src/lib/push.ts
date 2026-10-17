import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateLong, formatTime, toLocalDate } from "@/lib/time";

type Admin = ReturnType<typeof createAdminClient>;
type VapidKeys = { publicKey: string; privateKey: string };

export type PushMessage = { title: string; body: string; url: string };

/** Par de chaves VAPID: criado na primeira vez e guardado em app_secrets. */
async function vapidKeys(admin: Admin): Promise<VapidKeys> {
  const { data } = await admin.from("app_secrets").select("value").eq("name", "vapid").maybeSingle();
  if (data) return data.value as VapidKeys;
  const keys = webpush.generateVAPIDKeys();
  // Se duas requisições criarem ao mesmo tempo, vale a que gravou primeiro.
  await admin.from("app_secrets").upsert({ name: "vapid", value: keys }, { onConflict: "name", ignoreDuplicates: true });
  const { data: saved } = await admin.from("app_secrets").select("value").eq("name", "vapid").single();
  return saved!.value as VapidKeys;
}

export async function pushPublicKey(): Promise<string> {
  return (await vapidKeys(createAdminClient())).publicKey;
}

function subject() {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  return site ?? "mailto:avisos@bellink.com.br";
}

/** Envia o aviso para todos os aparelhos cadastrados do studio. Nunca lança erro. */
export async function notifyStudio(studioId: string, message: PushMessage, admin: Admin = createAdminClient()) {
  try {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("studio_id", studioId);
    if (!subs?.length) return;

    const keys = await vapidKeys(admin);
    const options = { vapidDetails: { subject: subject(), ...keys }, TTL: 60 * 60 * 24 };
    const payload = JSON.stringify(message);

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // Aparelho desativou ou o cadastro expirou: remove para não tentar de novo.
          if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
          else console.error("push: falha ao enviar", status ?? e);
        }
      }),
    );
  } catch (e) {
    console.error("push: falha ao avisar studio", e);
  }
}

const TITLES = {
  novo: "Novo agendamento",
  alterado: "Horário alterado",
  cancelado: "Agendamento cancelado",
} as const;

/** Avisa o studio sobre um agendamento feito, alterado ou cancelado pela cliente. */
export async function notifyAppointment(token: string, kind: keyof typeof TITLES) {
  try {
    const admin = createAdminClient();
    const { data: appt } = await admin
      .from("appointments")
      .select("studio_id, professional_id, customer_id, starts_at, service_name")
      .eq("public_token", token)
      .maybeSingle();
    if (!appt) return;
    const [{ data: customer }, { data: prof }, { data: studio }] = await Promise.all([
      admin.from("customers").select("name").eq("id", appt.customer_id).maybeSingle(),
      admin.from("professionals").select("name").eq("id", appt.professional_id).maybeSingle(),
      admin.from("studios").select("timezone").eq("id", appt.studio_id).maybeSingle(),
    ]);
    const tz = studio?.timezone ?? "America/Sao_Paulo";
    const when = `${formatDateLong(appt.starts_at, tz)} às ${formatTime(appt.starts_at, tz)}`;
    const who = customer?.name?.split(" ")[0] ?? "Cliente";
    const withProf = prof?.name ? ` · com ${prof.name}` : "";
    const date = toLocalDate(new Date(appt.starts_at), tz);
    await notifyStudio(
      appt.studio_id,
      {
        title: TITLES[kind],
        body: `${who} · ${appt.service_name}${withProf}\n${when.charAt(0).toUpperCase()}${when.slice(1)}`,
        url: `/painel/agenda?data=${date}`,
      },
      admin,
    );
  } catch (e) {
    console.error("push: falha ao montar aviso", e);
  }
}
