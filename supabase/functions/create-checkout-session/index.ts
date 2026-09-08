import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

// Canonical product catalog — prices are looked up server-side only.
// The browser sends product id + quantity + chosen variant; it never
// gets to say what the price is, so checkout amounts can't be tampered with.
const SITE_ORIGIN = "https://atlly-milionare-business.github.io/Atly-s-Millionare-Business";

const PRODUCTS: Record<string, { name: string; price: number; image: string }> = {
  "1": { name: "Cross-Body Bag — Black", price: 3000, image: `${SITE_ORIGIN}/assets/bag-black.jpg` },
  "2": { name: "Cross-Body Bag — Grey", price: 3000, image: `${SITE_ORIGIN}/assets/bag-grey.jpg` },
  "3": { name: "Cross-Body Bag — Navy", price: 3000, image: `${SITE_ORIGIN}/assets/bag-navy.jpg` },
};

// Flat-rate shipping zones approximated from Canada Post's published
// Regular Parcel rates ex Lynn Valley (V7J 3H2), 0.16kg/32x13x3cm box,
// plus a 10% margin, then a 5% storewide discount applied 2026-09-07.
// Not a live carrier-calculated rate — see project notes for upgrading
// to the Canada Post Rating API later.
function getShippingForPostalCode(postalCode: string): { amountCents: number; label: string } {
  const fsa = String(postalCode || "").toUpperCase().replace(/\s/g, "").slice(0, 3);
  const fsa2 = fsa.slice(0, 2);
  if (fsa2 === "V5" || fsa2 === "V6" || fsa2 === "V7") {
    return { amountCents: 1737, label: "Standard Shipping — Metro Vancouver (Canada Post)" };
    }
    if (fsa.startsWith("V")) {
      return { amountCents: 2339, label: "Standard Shipping — BC (Canada Post)" };
      }
      return { amountCents: 2977, label: "Standard Shipping — Canada (Canada Post)" };
      }
      const FREE_SHIPPING_THRESHOLD_CENTS = 10000; // $100.00 CAD
      const SHIPPING_CURRENCY = "cad";
// Domestic only for now — no international fulfillment yet.
const ALLOWED_SHIPPING_COUNTRIES = ["CA"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!STRIPE_SECRET_KEY) {
    return json({ error: "not_configured", message: "Stripe isn't connected yet." }, 503);
  }

  try {
    const { items, successUrl, cancelUrl, destination } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "empty_cart", message: "Cart is empty." }, 400);
    }

    const postalCode = String(destination?.postalCode || "").trim();
    if (!postalCode || !destination?.line1 || !destination?.city || !destination?.province) {
    return json({ error: "missing_address", message: "A shipping address is required." }, 400);
    }
    if (!ALLOWED_SHIPPING_COUNTRIES.includes(String(destination?.country || "").toUpperCase())) {
      return json({ error: "unsupported_country", message: "We currently only ship within Canada." }, 400);
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", successUrl || `${SITE_ORIGIN}/cart.html?checkout=success`);
    params.set("cancel_url", cancelUrl || `${SITE_ORIGIN}/cart.html?checkout=cancelled`);

    // Restrict to card only — this also removes the express-wallet
    // buttons (Link, Apple Pay/Google Pay) and BNPL options (Klarna,
    // Afterpay, etc.) that Stripe otherwise shows automatically.
    params.set("payment_method_types[0]", "card");

    // The shipping address is already collected and validated on our own
    // cart page, so we don't ask Stripe to collect it again — instead we
    // pass it through as metadata for stripe-webhook to record.
    params.set("metadata[shipping_name]", String(destination.name || ""));
    params.set("metadata[shipping_line1]", String(destination.line1 || ""));
    params.set("metadata[shipping_city]", String(destination.city || ""));
    params.set("metadata[shipping_province]", String(destination.province || ""));
    params.set("metadata[shipping_postal_code]", postalCode);
    params.set("metadata[shipping_country]", String(destination.country || "CA"));

    let lineCount = 0;
    let subtotalCents = 0;
    for (const item of items as Array<{ id: string; qty: number; color?: string; size?: string }>) {
      const product = PRODUCTS[String(item.id)];
      if (!product) continue;
      const qty = Math.max(1, Math.min(20, Math.floor(Number(item.qty) || 1)));
      const variant = [item.color, item.size].filter(Boolean).join(" / ");
      const i = lineCount++;
      subtotalCents += product.price * qty;

      params.set(`line_items[${i}][price_data][currency]`, "cad");
      params.set(`line_items[${i}][price_data][unit_amount]`, String(product.price));
      params.set(`line_items[${i}][price_data][product_data][name]`, product.name + (variant ? ` (${variant})` : ""));
      params.set(`line_items[${i}][price_data][product_data][images][0]`, product.image);
      params.set(`line_items[${i}][quantity]`, String(qty));
    }

    if (lineCount === 0) {
      return json({ error: "empty_cart", message: "No valid items in cart." }, 400);
    }

const qualifiesForFreeShipping = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
const shippingRate = getShippingForPostalCode(postalCode);
const shippingAmount = qualifiesForFreeShipping ? 0 : shippingRate.amountCents;
const shippingLabel = qualifiesForFreeShipping ? "Free Shipping (Canada Post)" : shippingRate.label;

    params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shippingAmount));
    params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", SHIPPING_CURRENCY);
    params.set("shipping_options[0][shipping_rate_data][display_name]", shippingLabel);
    params.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    params.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "3");
    params.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    params.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "7");

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return json({ error: "stripe_error", message: session.error?.message || "Stripe rejected the request." }, 400);
    }

    return json({ url: session.url });
  } catch (err) {
    return json({ error: "server_error", message: String(err) }, 500);
  }
});
