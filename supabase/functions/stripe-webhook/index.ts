import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Stripe calls this directly — no Supabase auth header, so verify_jwt is
// off for this function. Authenticity is instead verified via the Stripe
// webhook signature below, which only Stripe (holder of the signing
// secret) can produce.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Resend (https://resend.com) sends the order notification email below.
// Uses Resend's shared onboarding@resend.dev sender, which works without
// verifying a custom domain as long as the recipient is the Resend
// account's own verified email.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_NOTIFICATION_EMAIL = "altusgear2026@gmail.com";

// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase
// into every Edge Function — no need to set these as secrets ourselves.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendOrderNotification(items: Array<{ name: string | null; qty: number | null }>, shippingName: string | null, shippingAddress: Stripe.Address | null, customerEmail: string | null, totalCents: number, currency: string) {
  if (!RESEND_API_KEY) return;
  const total = "$" + (totalCents / 100).toFixed(2) + " " + currency.toUpperCase();
  let body = "New order from " + (customerEmail || "unknown customer") + "\n\n";
  body += "Items:\n";
  for (const item of items) {
    body += "- " + (item.qty || 1) + "x " + (item.name || "Item") + "\n";
    }
    body += "\nTotal: " + total + "\n\n";
    body += "Shipping to:\n" + (shippingName || "") + "\n" + (shippingAddress?.line1 || "") + "\n" + (shippingAddress?.line2 ? shippingAddress.line2 + "\n" : "") + (shippingAddress?.city || "") + ", " + (shippingAddress?.state || "") + " " + (shippingAddress?.postal_code || "") + "\n" + (shippingAddress?.country || "") + "\n";
    try {
      await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Altus Gear Orders <onboarding@resend.dev>", to: ADMIN_NOTIFICATION_EMAIL, subject: "New Altus Gear order", text: body }) });
      } catch (err) {
        console.error("Failed to send order notification email:", err);
        }
        }

        Deno.serve(async (req: Request) => {
           const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

    // Stripe has shipped the shipping-address field around between API
    // versions (`shipping`, then `shipping_details`, then
    // `collected_information.shipping_details`) — check all of them so
    // this keeps working regardless of which one this Stripe account is on.
    const shipping =
      (session as any).shipping_details ??
      (session as any).collected_information?.shipping_details ??
      (session as any).shipping ??
      null;

    const { error } = await supabase.from("orders").insert({
      stripe_session_id: session.id,
      stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
      customer_email: session.customer_details?.email ?? null,
      items: lineItems.data.map((li) => ({
        name: li.description,
        qty: li.quantity,
        amount_total: li.amount_total,
      })),
      subtotal_cents: session.amount_subtotal ?? session.amount_total ?? 0,
      shipping_cents: session.total_details?.amount_shipping ?? 0,
      shipping_name: shipping?.name ?? null,
      shipping_address: shipping?.address ?? null,
      currency: session.currency ?? "cad",
      status: "paid",
    });

    if (error) {
      // Log server-side for debugging; still 500 so Stripe retries delivery.
      console.error("Failed to insert order:", error);
      return new Response("Database insert failed", { status: 500 });
    }

    await sendOrderNotification(lineItems.data.map((li) => ({ name: li.description, qty: li.quantity })), shipping?.name ?? null, shipping?.address ?? null, session.customer_details?.email ?? null, session.amount_total ?? 0, session.currency ?? "cad");
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
