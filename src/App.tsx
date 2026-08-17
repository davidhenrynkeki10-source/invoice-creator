import { useEffect, useState } from "react";
import "./App.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";


const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
};

type InvoiceItem = {
  description: string;
  quantity: number;
  price: number;
};

type SavedInvoice = {
  invoiceNumber: string;
  clientName: string;
  invoiceDate: string;
  items: InvoiceItem[];
  total: number;
};

type Template = 
  | "aurora"
  | "minimal"
  | "executive"
  | "glass"
  | "classic";

function App() {
  const [page, setPage] = useState<
    "dashboard" | "creator" | "editor" | "business-profile" | "invoice-history" | "settings"
  >("dashboard");

  const [settingsModal, setSettingsModal] = useState<
  "terms" | "privacy" | null
>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState(() => {
  const saved = localStorage.getItem("businessName");
  return saved || "";
});

const [businessPhone, setBusinessPhone] = useState(() => {
  const saved = localStorage.getItem("businessPhone");
  return saved || "";
});

const [businessEmail, setBusinessEmail] = useState(() => {
  const saved = localStorage.getItem("businessEmail");
  return saved || "";
});

const [businessAddress, setBusinessAddress] = useState(() => {
  const saved = localStorage.getItem("businessAddress");
  return saved || "";
});

const [businessLogo, setBusinessLogo] = useState(() => {
  const saved = localStorage.getItem("businessLogo");
  return saved || "";
});

const [signature, setSignature] = useState(() => {
  const saved = localStorage.getItem("signature");
  return saved || "";
});

const [invoiceHistory, setInvoiceHistory] = useState<SavedInvoice[]>(() => {
  const saved = localStorage.getItem("invoiceHistory");
  return saved ? JSON.parse(saved) : [];
});
 
  useEffect(() => {
  localStorage.setItem("businessName", businessName);
  localStorage.setItem("businessPhone", businessPhone);
  localStorage.setItem("businessEmail", businessEmail);
  localStorage.setItem("businessAddress", businessAddress);
  localStorage.setItem("businessLogo", businessLogo);
  localStorage.setItem("signature", signature);
}, [
  businessName,
  businessPhone,
  businessEmail,
  businessAddress,
  businessLogo,
  signature,
]);
  const [template, setTemplate] =
    useState<Template>("aurora");

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      description: "Website Development",
      quantity: 1,
      price: 400000,
    },
    {
      description: "Hosting",
      quantity: 1,
      price: 50000,
    },
  ]);

  const [clientName, setClientName] = useState("John Doe");

  const [paymentDetails, setPaymentDetails] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");

  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  };



  
  const generateInvoice = async () => {
  if (!prompt.trim()) {
    setError("Please describe the invoice you want to create.");
    return;
  }

  try {
    setIsGenerating(true);
    setError("");

    const response = await fetch(
      "http://localhost:5000/api/generate-invoice",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Could not generate invoice."
      );
    }

    setClientName(data.clientName || "");

    setInvoiceItems(
      (data.items || []).map((item: InvoiceItem) => ({
        description: item.description || "",
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
      }))
    );

    setPrompt("");

    setPage("editor");

  } catch (error) {
    console.error("AI ERROR:", error);

    setError(
      error instanceof Error
        ? error.message
        : "Could not generate invoice."
    );

  } finally {
    setIsGenerating(false);
  }
};

  const startVoiceInput = () => {
  type SpeechRecognitionResultEvent = Event & {
    results: {
      [index: number]: {
        [index: number]: {
          transcript: string;
        };
      };
    };
  };

  type SpeechRecognition = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start: () => void;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  };

  type SpeechRecognitionConstructor = new () => SpeechRecognition;

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  const SpeechRecognition =
    speechWindow.SpeechRecognition ||
    speechWindow.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setError(
      "Voice input is not supported in this browser."
    );
    return;
  }

  const recognition = new SpeechRecognition();

  recognition.lang = "en-NG";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    setIsListening(true);
    setError("");
  };

  recognition.onresult = (event) => {
    const transcript =
      event.results[0][0].transcript;

    setPrompt(transcript);
  };

  recognition.onerror = () => {
    setError("Could not hear you. Please try again.");
    setIsListening(false);
  };

  recognition.onend = () => {
    setIsListening(false);
  };

  recognition.start();
};
  const downloadPDF = async () => {
  const invoice = document.getElementById("invoice-preview");

  if (!invoice) {
    return;
  }

  try {
    const rect = invoice.getBoundingClientRect();

const canvas = await html2canvas(invoice, {
  scale: 2,
  useCORS: true,
  backgroundColor: "#ffffff",
  logging: false,

  x: 0,
  y: 0,
  width: rect.width,
  height: rect.height,

  scrollX: -window.scrollX,
  scrollY: -window.scrollY,

  onclone: (clonedDocument) => {
    const clonedInvoice =
      clonedDocument.getElementById("invoice-preview");

    if (clonedInvoice) {
      clonedInvoice.style.margin = "0";
      clonedInvoice.style.transform = "none";
      clonedInvoice.style.left = "0";
      clonedInvoice.style.right = "auto";
    }
  },
}); 

    const imageData = canvas.toDataURL("image/png");

    // Use the invoice's actual proportions
    const pdfWidth = 210;
    const pdfHeight =
      (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
      unit: "mm",
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(
      imageData,
      "PNG",
      0,
      0,
      pdfWidth,
      pdfHeight
    );

    pdf.save(`${invoiceNumber || "invoice"}.pdf`);

  } catch (error) {
    console.error("PDF generation failed:", error);
  }
};
  
  const saveInvoice = () => {
  const savedInvoice = {
    invoiceNumber: invoiceNumber || "INV-001",
    clientName,
    invoiceDate,
    items: invoiceItems,
    total: invoiceItems.reduce(
      (sum, item) =>
        sum + item.quantity * item.price,
      0
    ),
  };

  

  const updatedHistory = [
    ...invoiceHistory,
    savedInvoice,
  ];

  setInvoiceHistory(updatedHistory);

  localStorage.setItem(
    "invoiceHistory",
    JSON.stringify(updatedHistory)
  );
};

const deleteInvoice = (index: number) => {
  const updatedHistory = invoiceHistory.filter(
    (_, i) => i !== index
  );

  setInvoiceHistory(updatedHistory);

  localStorage.setItem(
    "invoiceHistory",
    JSON.stringify(updatedHistory)
  );
};
  const subtotal = invoiceItems.reduce(
    (total, item) =>
      total + item.quantity * item.price,
    0
  );

  const updateItem = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    setInvoiceItems((items) =>
      items.map((item, i) =>
        i === index
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const addItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      {
        description: "New item",
        quantity: 1,
        price: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(
      invoiceItems.filter((_, i) => i !== index)
    );
  };

  if (page === "editor") {
    return (
      <div className="editor-page">
        <header className="editor-topbar">
          <button
            className="back-button"
            onClick={() => setPage("creator")}
          >
            ← Back
          </button>

          <div className="editor-actions">
            <button className="secondary-button">
              Preview
            </button>

            <button
              className="generate-button"
              onClick={downloadPDF} 
            >   
              Download PDF
            </button>

            <button
              type="button"
              className="save-invoice-button"
              onClick={saveInvoice}
            >
              <span>+</span>
               Save Invoice
            </button>
          </div>
        </header>

        <div className="editor-layout">
          <section className="editor-panel">
            <div className="editor-heading">
              <div>
                <span className="ai-badge">
                  ✦ INVOICE EDITOR
                </span>

                <h1>Your Invoice</h1>

                <p>
                  Review and edit your invoice before
                  exporting it.
                </p>
              </div>

              <div className="invoice-number">
                <span>INVOICE</span>
                <strong>#INV-001</strong>
              </div>
            </div>

            <div className="form-card">
              <h3>Client information</h3>

              <label>Client name</label>

              <input
                value={clientName}
                onChange={(e) =>
                  setClientName(e.target.value)
                }
              />
            </div>

            <div className="form-card">
              <div className="items-heading">
                <h3>Invoice items</h3>

                <button
                  className="add-item"
                  onClick={addItem}
                >
                  + Add item
                </button>
              </div>

              <div className="items-table">
                <div className="items-header">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Total</span>
                  <span></span>
                </div>

              <div className="invoice-extra-fields">
                <div className="invoice-meta-fields">

  <div className="extra-field">
    <label>Invoice Number</label>

    <input
      type="text"
      value={invoiceNumber}
      onChange={(e) =>
        setInvoiceNumber(e.target.value)
      }
      placeholder="INV-001"
    />
  </div>

  <div className="extra-field">
    <label>Invoice Date</label>

    <input
      type="date"
      value={invoiceDate}
      onChange={(e) =>
        setInvoiceDate(e.target.value)
      }
    />
  </div>

</div>

  <div className="extra-field">
    <label>Payment Details</label>

    <textarea
      value={paymentDetails}
      onChange={(e) =>
        setPaymentDetails(e.target.value)
      }
      placeholder="Example: GTBank • 0123456789"
      rows={3}
    />
  </div>

  <div className="extra-field">
    <label>Additional Information</label>

    <textarea
      value={additionalInfo}
      onChange={(e) =>
        setAdditionalInfo(e.target.value)
      }
      placeholder="Example: Thank you for your business."
      rows={3}
    />
  </div>

</div>

                {invoiceItems.map((item, index) => (
                  <div
                    className="invoice-row"
                    key={index}
                  >
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "description",
                          e.target.value
                        )
                      }
                    />

                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          Number(e.target.value)
                        )
                      }
                    />

                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "price",
                          Number(e.target.value)
                        )
                      }
                    />

                    <span>
                      {formatCurrency(
                        item.quantity * item.price
                      )}
                    </span>

                    <button
                      className="remove-item"
                      onClick={() =>
                        removeItem(index)
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

           
          </section>

          <aside className="invoice-preview-large">

  <div className="template-selector">

    <div className="template-selector-header">
      <div>
        <h3>Invoice template</h3>
        <p>Choose your style</p>
      </div>
    </div>

    <div className="template-grid">

      {[
        ["aurora", "Aurora"],
        ["minimal", "Minimal"],
        ["executive", "Executive"],
        ["glass", "Glass"],
        ["classic", "Classic"],
      ].map(([value, name]) => (
        <button
          key={value}
          className={`template-option ${
            template === value ? "selected" : ""
          }`}
          onClick={() =>
            setTemplate(value as Template)
          }
        >
          <div
            className={`template-thumbnail ${value}`}
          >
            <span>INVOICE</span>
            <div />
            <small>₦450,000</small>
          </div>

          <span>{name}</span>
        </button>
      ))}

    </div>
  </div>

    <div
      id="invoice-preview"
      className={`invoice-paper template-${template}`}
    >
    <div className="paper-header">

  <div>

    <div className="paper-logo">
      {businessLogo ? (
        <img
          src={businessLogo}
          alt="Business logo"
        />
      ) : (
        "YOUR LOGO"
      )}
    </div>

    <h3>
      {businessName || "Your Business"}
    </h3>

    <p>
      {businessAddress || "Lagos, Nigeria"}
      <br />

      {businessPhone && (
        <>
          {businessPhone}
          <br />
        </>
      )}

      {businessEmail || "hello@yourbusiness.com"}
    </p>

  </div>

  <div className="paper-invoice">

    <h2>INVOICE</h2>

    <span>
      #{invoiceNumber}
    </span>

    <small>
      {invoiceDate}
    </small>

  </div>

</div>

    <div className="paper-divider" />

    <div className="paper-client">
      <span>BILL TO</span>

      <strong>{clientName}</strong>
    </div>

    <div className="paper-items">

      <div className="paper-item paper-item-header">
        <span>Description</span>
        <span>Amount</span>
      </div>

      {invoiceItems.map((item, index) => (

        <div
          className="paper-item"
          key={index}
        >

          <span>
            {item.description}

            <small>
              {item.quantity} ×{" "}
              {formatCurrency(item.price)}
            </small>
          </span>

          <strong>
            {formatCurrency(
              item.quantity * item.price
            )}
          </strong>

        </div>

      ))}

    </div>

    <div className="paper-total">

      <span>Total</span>

      <strong>
        {formatCurrency(subtotal)}
      </strong>

    </div>

    <div className="paper-payment">

  <span>PAYMENT DETAILS</span>

  <strong>
    {paymentDetails || "Add your payment details"}
  </strong>

</div>

    <div className="paper-additional">
  <span>ADDITIONAL INFORMATION</span>

  <p>
    {additionalInfo ||
    "Thank you for your business. We appreciate the opportunity to work with you."}
  </p>
</div>
  <div className="paper-signature">
   {signature && (
    <img
      src={signature}
      alt="Authorized signature"
      className="signature-image"
    />
   )}
    <div className="signature-line"></div>

    <span>AUTHORIZED SIGNATURE</span>
  </div>


    <div className="paper-footer">
      Thank you for your business.
    </div>

  </div>

</aside>
        </div>
      </div>
    );
  }
  if (page === "invoice-history") {
  return (
    <div className="invoice-history-page">
      <button
  className="back-button"
  onClick={() => setPage("dashboard")}
>
  ← Back to Dashboard
</button>
      <div className="invoice-history-container">
  <div className="invoice-history-header">
    <div>
      <span className="section-label">INVOICES</span>
      <h1>Invoice History</h1>
      <p>View and manage your saved invoices.</p>
    </div>
  </div>

  {invoiceHistory.length === 0 ? (
    <div className="empty-history">
      <div className="empty-history-icon">▣</div>
      <h3>No invoices yet</h3>
      <p>
        Your saved invoices will appear here.
      </p>
    </div>
  ) : (
    <div className="invoice-history-list">
      {invoiceHistory.map((invoice, index) => (
        <div
          className="invoice-history-card"
          key={index}
          onClick={() => {
            setInvoiceNumber(invoice.invoiceNumber);
            setClientName(invoice.clientName);
            setInvoiceDate(invoice.invoiceDate);
            setInvoiceItems(invoice.items);
            setPage("editor");
          }}
        >
          <div className="invoice-history-main">
            <div className="invoice-history-icon">
              ▤
            </div>

            <div>
              <h3>{invoice.invoiceNumber}</h3>
            
              <p>
                {invoice.clientName || "No client name"}
              </p>
            </div>
          </div>

          <div className="invoice-history-details">
            <div>
              <span>Amount</span>
              <strong>
                ₦{invoice.total.toLocaleString()}
              </strong>
            </div>

            <div>
              <span>Date</span>
              <p>{invoice.invoiceDate}</p>
            </div>

            <div className="invoice-history-actions">
  <span className="invoice-history-arrow">
    →
  </span>

  <button
    type="button"
    className="delete-invoice-button"
    onClick={(e) => {
      e.stopPropagation();
      deleteInvoice(index);
    }}
  >
    Delete
  </button>
</div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
    </div>
  );
}
  if (page === "business-profile") {
  return (
    <div className="page">

      <div className="page-header">
  <div>
    <button
      className="back-button"
      onClick={() => setPage("dashboard")}
    >
      ← Back
    </button>

  </div>
</div>

      <div className="business-profile-card">

        <div className="logo-section">

  <div className="logo-preview">
    {businessLogo ? (
      <img
        src={businessLogo}
        alt="Business logo"
      />
    ) : (
      <span>LOGO</span>
    )}
  </div>

  <div className="logo-content">
    <h2>Business Logo</h2>

    <p>
      Add your business logo. It will appear
      automatically on your invoices.
    </p>

    <label className="upload-logo-button">
      {businessLogo ? "Change Logo" : "Upload Logo"}

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (!file) return;

          const reader = new FileReader();

          reader.onloadend = () => {
            setBusinessLogo(reader.result as string);
          };

          reader.readAsDataURL(file);
        }}
      />
    </label>

    {businessLogo && (
      <button
        type="button"
        className="remove-logo-button"
        onClick={() => setBusinessLogo("")}
      >
        Remove
      </button>
    )}
  </div>

</div>

        <div className="profile-section">
          <h2>Business Information</h2>

          <p className="section-description">
            This information will be used automatically
            whenever you create an invoice.
          </p>
        </div>

        <div className="profile-form">

          <div className="form-field">
            <label>Business Name</label>

            <input
              type="text"
              value={businessName}
              onChange={(e) =>
                setBusinessName(e.target.value)
              }
              placeholder="Enter your business name"
            />
          </div>

          <div className="form-row">

            <div className="form-field">
              <label>Phone Number</label>

              <input
                type="text"
                value={businessPhone}
                onChange={(e) =>
                  setBusinessPhone(e.target.value)
                }
                placeholder="+234 801 234 5678"
              />
            </div>

            <div className="form-field">
              <label>Email</label>

              <input
                type="email"
                value={businessEmail}
                onChange={(e) =>
                  setBusinessEmail(e.target.value)
                }
                placeholder="business@email.com"
              />
            </div>

          </div>

          <div className="form-field">
            <label>Business Address</label>

            <textarea
              value={businessAddress}
              onChange={(e) =>
                setBusinessAddress(e.target.value)
              }
              placeholder="Enter your business address"
              rows={3}
            />
          </div>

          <div className="signature-section">

  <div className="signature-preview">
    {signature ? (
      <img
        src={signature}
        alt="Business signature"
      />
    ) : (
      <span>Signature Preview</span>
    )}
  </div>

  <div className="signature-content">
    <h2>Signature</h2>

    <p>
      Upload your authorized signature. It will
      appear automatically on your invoices.
    </p>

    <label className="upload-signature-button">
      {signature ? "Change Signature" : "Upload Signature"}

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (!file) return;

          const reader = new FileReader();

          reader.onloadend = () => {
            setSignature(reader.result as string);
          };

          reader.readAsDataURL(file);
        }}
      />
    </label>

    {signature && (
      <button
        type="button"
        className="remove-signature-button"
        onClick={() => setSignature("")}
      >
        Remove
      </button>
    )}
  </div>

</div>

        </div>

      </div>

    </div>
  );
}

  if (page === "creator") {
    return (
      <div className="creator-page">
        <button
          className="back-button"
          onClick={() => setPage("dashboard")}
        >
          ← Back to Dashboard
        </button>

        <div className="creator-container">
          <div className="creator-header">
            <span className="ai-badge">
              ✦ AI POWERED
            </span>

            <h1>
              Create your
              <br />
              <span>invoice.</span>
            </h1>

            <p>
              Tell us what you're charging and we'll
              create the invoice for you.
            </p>
          </div>

          <div className="ai-input-card">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Create an invoice for John for a website worth ₦400,000 and hosting for ₦50,000..."
            />

            {error && (
              <p className="creator-error">
                {error}
              </p>
            )}

            <div className="input-actions">
              <button
  type="button"
  className={`voice-button ${
    isListening ? "listening" : ""
  }`}
  onClick={startVoiceInput}
>
  {isListening ? "🔴" : "🎙️"}
</button>

              <button
               className="generate-button"
               onClick={generateInvoice}
               disabled={isGenerating}
              >
               {isGenerating
                ? "Creating invoice..."
                : "Generate Invoice →"}
              </button>
            </div>
          </div>

          <div className="suggestion">
            <span>Try saying:</span>

            <button>
              "Create an invoice for a logo design worth
              ₦150,000."
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (page === "settings") {
  return (
    <div className="settings-page">

      <button
        className="back-button"
        onClick={() => setPage("dashboard")}
      >
        ← Back to Dashboard
      </button>

      <div className="settings-container">

        <div className="settings-header">
          <span className="section-label">
            SETTINGS
          </span>

          <h1>Settings</h1>

          <p>
            Manage your app information.
          </p>
        </div>

        <div className="settings-list">

          <button
  type="button"
  className="settings-item"
  onClick={() => setSettingsModal("terms")}
>
  <div>
    <h3>Terms of Use</h3>
    <p>
      Review the terms for using Invoice Creator.
    </p>
  </div>

  <span>→</span>
</button>

       <button
  type="button"
  className="settings-item"
  onClick={() => setSettingsModal("privacy")}
>
  <div>
    <h3>Privacy Policy</h3>
    <p>
      Learn how your information is handled.
    </p>
  </div>

  <span>→</span>
</button>

       </div>

      </div>

      {settingsModal && (
        <div
          className="settings-modal-overlay"
          onClick={() => setSettingsModal(null)}
        >
          <div
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="settings-modal-close"
              onClick={() => setSettingsModal(null)}
            >
              ×
            </button>

            {settingsModal === "terms" ? (
              <>
                <h2>Terms of Use</h2>

                <p>
                  By using Invoice Creator, you agree to use the
                  application responsibly and in accordance
                  with applicable laws.
                </p>

                <p>
                  Invoice Creator is provided as a business tool
                  for creating and managing invoices. You
                  are responsible for reviewing all invoice
                  information before using it.
                </p>
              </>
            ) : (
              <>
                <h2>Privacy Policy</h2>

                <p>
                  Invoice Creator may store information you
                  provide while using the application,
                  such as invoice details and business
                  information.
                </p>

                <p>
                  Your information is used to provide and
                  improve the invoice creation experience.
                </p>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

  return (
    <div className="app">
      <button
  className="mobile-menu-button"
  onClick={() => setMobileMenuOpen(true)}
>
  ☰
</button>
       <aside
  className={`sidebar ${
    mobileMenuOpen ? "mobile-open" : ""
  }`}
>
        <div className="logo">
          <span className="logo-mark">✦</span>
          <span>Invoice Creator</span>
        </div>
        {mobileMenuOpen && (
  <button
    className="mobile-menu-close"
    onClick={() => setMobileMenuOpen(false)}
  >
    ×
  </button>
)}

        <nav>
          <button className="nav-item active">
            <span>⌂</span>
            Dashboard
          </button>

          <button
           className="nav-item"
           onClick={() => setPage("business-profile")}
          >
          <span>🏢</span>
          Business Profile
          </button>

          <button
  className="nav-item"
  onClick={() => setPage("invoice-history")}
>
            <span>▣</span>
            Invoices
          </button>

          <button
  className="nav-item"
  onClick={() => setPage("settings")}
>
  <span>⚙</span>
  Settings
</button>
        </nav>

        <div className="sidebar-bottom">
          <p>AI Invoice Creator</p>
          <span>
            Create professional invoices in seconds.
          </span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="greeting">
              {getGreeting()} 👋
            </p>

            <h1>Dashboard</h1>
          </div>

          <button
            className="create-button"
            onClick={() => setPage("creator")}
          >
            + Create Invoice
          </button>
        </header>

        <section className="hero">
          <div className="hero-content">
            <span className="ai-badge">
              ✦ AI POWERED
            </span>

            <h2>
              Create invoices
              <br />
              <span>in seconds.</span>
            </h2>

            <p>
              Tell us what you're charging and we'll
              turn it into a professional invoice.
            </p>

            <button
              className="hero-button"
              onClick={() => setPage("creator")}
            >
              + Create Invoice
            </button>
          </div>

          <div className="invoice-preview">
            <div className="preview-top">
              <div>
                <div className="mini-logo">
                  YOUR LOGO
                </div>

                <strong>Your Business</strong>
              </div>

              <div className="invoice-label">
                <span>INVOICE</span>
                <small>#INV-001</small>
              </div>
            </div>

            <div className="preview-line" />

            <div className="bill-section">
              <div>
                <small>BILL TO</small>
                <strong>John Doe</strong>
              </div>

              <div>
                <small>DATE</small>
                <strong>Aug 17, 2026</strong>
              </div>
            </div>

            <div className="invoice-items">
              <div className="item header">
                <span>Description</span>
                <span>Amount</span>
              </div>

              <div className="item">
                <span>Website Development</span>
                <span>₦400,000</span>
              </div>

              <div className="item">
                <span>Hosting</span>
                <span>₦50,000</span>
              </div>
            </div>

            <div className="total">
              <span>Total</span>
              <strong>₦450,000</strong>
            </div>
          </div>
        </section>

        <section className="recent-section">
          <div className="section-heading">
            <div>
              <h3>Recent invoices</h3>
              <p>Your latest created invoices</p>
            </div>

            <button className="view-all">
              View all →
            </button>
          </div>

          <div className="empty-state">
            <div className="empty-icon">▤</div>

            <h3>No invoices yet</h3>

            <p>
              Your created invoices will appear here.
            </p>

            <button
              className="empty-button"
              onClick={() => setPage("creator")}
            >
              Create your first invoice
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;