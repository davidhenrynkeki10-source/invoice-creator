const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.json({
    message: "InvoiceAI backend is running 🚀",
  });
});

app.post("/api/generate-invoice", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Please provide an invoice description.",
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

res.json(invoice);
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