const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("CORS REJECTED ORIGIN:", origin);
return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function getVisitorId(req, res) {
  const cookieMatch = req.headers.cookie?.match(
    /(?:^|;\s*)invoice_visitor_id=([^;]+)/
  );

  if (cookieMatch) {
    return decodeURIComponent(cookieMatch[1]);
  }

  const visitorId = crypto.randomUUID();
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("invoice_visitor_id", visitorId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 370,
  });

  return visitorId;
}

function createSubscriberToken(email) {
  const encodedEmail = Buffer.from(email).toString("base64url");

  const signature = crypto
    .createHmac(
      "sha256",
      process.env.SUBSCRIPTION_COOKIE_SECRET
    )
    .update(encodedEmail)
    .digest("base64url");

  return `${encodedEmail}.${signature}`;
}

function getSubscriberEmail(req) {
  const cookieMatch = req.headers.cookie?.match(
    /(?:^|;\s*)invoice_subscriber=([^;]+)/
  );

  if (!cookieMatch) {
    return null;
  }

  const token = decodeURIComponent(cookieMatch[1]);
  const [encodedEmail, signature] = token.split(".");

  if (!encodedEmail || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac(
      "sha256",
      process.env.SUBSCRIPTION_COOKIE_SECRET
    )
    .update(encodedEmail)
    .digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    return null;
  }

  return Buffer.from(encodedEmail, "base64url").toString("utf8");
}

app.get("/", (req, res) => {
  res.json({
    message: "InvoiceAI backend is running 🚀",
  });
});

app.post("/api/payments/initialize", async (req, res) => {
  try {
    const { email, billingCycle } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    const planCode =
      billingCycle === "yearly"
        ? process.env.PAYSTACK_YEARLY_PLAN_CODE
        : process.env.PAYSTACK_MONTHLY_PLAN_CODE;

    if (!planCode) {
      return res.status(500).json({
        error: "Subscription plan is not configured.",
      });
    }

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
  email,
  plan: planCode,
  callback_url: process.env.APP_URL,
  metadata: {
    billingCycle,
  },
}),
      }
    );

    const payment = await paystackResponse.json();

    if (!paystackResponse.ok || !payment.status) {
      console.error("PAYSTACK INITIALIZATION ERROR:", payment);

      return res.status(502).json({
        error: payment.message || "Could not start payment.",
      });
    }

    return res.json({
      authorizationUrl: payment.data.authorization_url,
    });
  } catch (error) {
    console.error("PAYMENT INITIALIZATION ERROR:", error);

    return res.status(500).json({
      error: "Could not start payment.",
    });
  }
});

app.post("/api/payments/verify", async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        error: "Payment reference is required.",
      });
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const verification = await paystackResponse.json();

    if (
      !paystackResponse.ok ||
      !verification.status ||
      verification.data.status !== "success"
    ) {
      return res.status(402).json({
        error: "Payment was not successful.",
      });
    }

    const payment = verification.data;
const email = payment.customer?.email;
const billingCycle =
  payment.metadata?.billingCycle || "monthly";

    if (!email) {
      throw new Error("Paystack did not return a customer email.");
    }

    const now = new Date().toISOString();

    const subscriptionData = {
      email,
      paystack_customer_code:
        payment.customer?.customer_code || null,
      paystack_subscription_code:
        payment.subscription?.subscription_code || null,
      status: "active",
      subscription_start: payment.paid_at || now,
      subscription_end:
  billingCycle === "yearly"
    ? new Date(
        new Date(payment.paid_at || now).setFullYear(
          new Date(payment.paid_at || now).getFullYear() + 1
        )
      ).toISOString()
    : new Date(
        new Date(payment.paid_at || now).setMonth(
          new Date(payment.paid_at || now).getMonth() + 1
        )
      ).toISOString(),
      updated_at: now,
    };

    const { data: existingSubscriptions, error: findError } =
      await supabase
        .from("subscriptions")
        .select("id")
        .eq("email", email)
        .limit(1);

    if (findError) {
      throw findError;
    }

    if (existingSubscriptions.length > 0) {
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update(subscriptionData)
        .eq("id", existingSubscriptions[0].id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabase
        .from("subscriptions")
        .insert({
          ...subscriptionData,
          created_at: now,
        });

      if (insertError) {
        throw insertError;
      }
    }

    const isProduction = process.env.NODE_ENV === "production";

    res.cookie(
      "invoice_subscriber",
      createSubscriberToken(email),
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 370,
      }
    );

    return res.json({
      active: true,
      message: "Payment verified successfully.",
    });
  } catch (error) {
    console.error("PAYMENT VERIFICATION ERROR:", error);

    return res.status(500).json({
      error: "Could not verify payment.",
    });
  }
});

app.get("/api/subscription/status", async (req, res) => {
  try {
    const email = getSubscriberEmail(req);

    if (!email) {
      return res.json({ active: false });
    }

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("status, subscription_end")
      .eq("email", email)
      .limit(1);

    if (error) {
      throw error;
    }

    const subscription = subscriptions?.[0];

    const isActive =
      subscription?.status === "active" &&
      (
        !subscription.subscription_end ||
        new Date(subscription.subscription_end) > new Date()
      );

    return res.json({
      active: Boolean(isActive),
    });
  } catch (error) {
    console.error("SUBSCRIPTION STATUS ERROR:", error);

    return res.status(500).json({
      error: "Could not check subscription status.",
    });
  }
});

app.post("/api/paystack/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];

  const expectedSignature = crypto
    .createHmac(
      "sha512",
      process.env.PAYSTACK_SECRET_KEY
    )
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (
    !signature ||
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    return res.status(401).send("Invalid webhook signature.");
  }

  try {
    const event = req.body;
    const email = event.data?.customer?.email;

    if (!email) {
      return res.sendStatus(200);
    }

    if (
  event.event === "subscription.create" ||
  event.event === "charge.success"
) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          paystack_customer_code:
            event.data.customer?.customer_code || null,
          paystack_subscription_code:
            event.data.subscription_code || null,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        throw error;
      }
    }
    if (event.event === "invoice.payment_failed") {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  if (error) {
    throw error;
  }
}

    if (event.event === "subscription.disable") {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "inactive",
          subscription_end: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        throw error;
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("PAYSTACK WEBHOOK ERROR:", error);

    return res.sendStatus(500);
  }
});

app.post("/api/generate-invoice", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Please provide an invoice description.",
      });
    }

    const visitorId = getVisitorId(req, res);

const { data: usageRows, error: usageError } =
  await supabase.rpc("consume_invoice_generation", {
    p_visitor_id: visitorId,
  });

if (usageError) {
  throw usageError;
}

const usage = usageRows?.[0];

if (!usage?.allowed) {
  return res.status(429).json({
    error: "You have reached your 100 invoice generations for this month.",
    usage,
  });
}

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `
You are an AI invoice assistant.

Convert the user's description into structured invoice information.

Important rules:
- CLIENT NAME: If the request says "for [person/company]", treat the name immediately after "for" as the client name.
- Examples:
  - "Create an invoice for David Henry for website development" → client_name = "David Henry"
  - "Create an invoice for Sarah for 3 logo designs" → client_name = "Sarah"
  - "Create an invoice for ABC Ltd for consulting" → client_name = "ABC Ltd"
  - "Create an invoice for website development" → client_name = ""
- Do not confuse the service/product description with the client name.
- The name immediately following "for" when referring to the customer/client should be treated as the client name.
- Never include service names, prices, or business names as the client name.
- If no client/customer name is clearly provided, return an empty string.
- Extract every service/product mentioned.
- Extract quantities when provided.
- Extract prices accurately.
- Do not invent prices.
- If quantity is not provided, use 1.
- If the client name is not provided, use an empty string.
- Calculate the item totals.
- Calculate the subtotal.
- Do not add tax, discounts, payment status, due dates, or overdue information.
- Return ONLY valid JSON.

User request:
${prompt}
`,
    });

const aiInvoice = JSON.parse(response.output_text);
const clientName = 
  aiInvoice.client_name ||
  "";

const invoice = {
  clientName: aiInvoice.client_name || "",
  items: (aiInvoice.items || []).map((item) => ({
    description: item.description || "",
    quantity: Number(item.quantity) || 1,
    price: Number(item.unit_price) || 0,
  })),
};

invoice.subtotal = invoice.items.reduce(
  (total, item) =>
    total + item.quantity * item.price,
  0
);

res.json({
  ...invoice,
  usage,
});
  } catch (error) {
    console.error("AI ERROR:", error);

    res.status(500).json({
      error: "Could not generate invoice.",
    });
  }
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});