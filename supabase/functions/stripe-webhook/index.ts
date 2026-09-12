import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Stripe calls this directly — no Supabase auth header, so verify_jwt is
// off for this function. Authenticity is instead verified via the Stripe
// webhook signature below, which only Stripe (holder of the signing
// secret) can produce.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Resend (https://resend.com) sends the order emails below.
// IMPORTANT: onboarding@resend.dev is Resend's shared sandbox sender —
// in sandbox mode Resend only actually delivers mail addressed to the
// Resend account's own verified email. sendOrderNotification (to you)
// works today because of that. sendCustomerConfirmation (to whatever
// email the customer typed at checkout) will silently fail to deliver
// until a real sending domain is verified in the Resend dashboard and
// "from" below is changed to an address on that domain.
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

async function sendCustomerConfirmation(customerEmail: string | null, items: Array<{ name: string | null; qty: number | null }>, shippingName: string | null, shippingAddress: Stripe.Address | null, totalCents: number, currency: string) {
  if (!RESEND_API_KEY || !customerEmail) return;
  const total = "$" + (totalCents / 100).toFixed(2) + " " + currency.toUpperCase();
  let body = "Hi" + (shippingName ? " " + shippingName : "") + ",\n\n";
  body += "Thanks for your order from Altus Gear! Here's what you ordered:\n\n";
  for (const item of items) {
    body += "- " + (item.qty || 1) + "x " + (item.name || "Item") + "\n";
  }
  body += "\nTotal: " + total + "\n\n";
  body += "Shipping to:\n" + (shippingName || "") + "\n" + (shippingAddress?.line1 || "") + "\n" + (shippingAddress?.line2 ? shippingAddress.line2 + "\n" : "") + (shippingAddress?.city || "") + ", " + (shippingAddress?.state || "") + " " + (shippingAddress?.postal_code || "") + "\n" + (shippingAddress?.country || "") + "\n";
  body += "\nWe'll email you a tracking number once your order ships.\n\n— Altus Gear";
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Altus Gear <onboarding@resend.dev>", to: customerEmail, subject: "Your Altus Gear order is confirmed", text: body }) });
    if (!res.ok) {
      console.error("Failed to send customer confirmation email:", await res.text());
    }
  } catch (err) {
    console.error("Failed to send customer confirmation email:", err);
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

    // The shipping address is collected on our own cart page (not by
    // Stripe's Checkout UI), so create-checkout-session passes it through
    // as session metadata instead of Stripe's shipping_details field.
    const metadata = session.metadata ?? {};
    const shipping = metadata.shipping_line1
      ? {
          name: metadata.shipping_name ?? null,
          address: {
            line1: metadata.shipping_line1 ?? null,
            city: metadata.shipping_city ?? null,
            state: metadata.shipping_province ?? null,
            postal_code: metadata.shipping_postal_code ?? null,
            country: metadata.shipping_country ?? null,
          },
        }
      : null;

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

    // Decrement stock for whatever was actually paid for. order_items is
    // set by create-checkout-session; requires the decrement_stock
    // Postgres function (supabase/decrement-stock-function.sql) to exist.
    if (metadata.order_items) {
      try {
        const orderItems = JSON.parse(metadata.order_items) as Array<{ id: string; qty: number }>;
        for (const oi of orderItems) {
          const productId = Number(oi.id);
          const qty = Number(oi.qty) || 0;
          if (!Number.isFinite(productId) || qty <= 0) continue;
          const { error: stockError } = await supabase.rpc("decrement_stock", {
            p_product_id: productId,
            p_qty: qty,
          });
          if (stockError) {
            console.error("Failed to decrement stock for product " + productId + ":", stockError);
          }
        }
      } catch (err) {
        console.error("Failed to parse order_items metadata:", err);
      }
    }

    const itemsForEmail = lineItems.data.map((li) => ({ name: li.description, qty: li.quantity }));
    await sendOrderNotification(itemsForEmail, shipping?.name ?? null, shipping?.address ?? null, session.customer_details?.email ?? null, session.amount_total ?? 0, session.currency ?? "cad");
    await sendCustomerConfirmation(session.customer_details?.email ?? null, itemsForEmail, shipping?.name ?? null, shipping?.address ?? null, session.amount_total ?? 0, session.currency ?? "cad");
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
