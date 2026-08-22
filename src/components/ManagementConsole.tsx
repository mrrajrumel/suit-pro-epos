import React, { useState, useEffect } from "react";
import { requestPrintPreview } from "../lib/print-preview.ts";
import { 
  Users, 
  Trash2, 
  Save, 
  Smartphone, 
  Monitor, 
  Tablet, 
  UserPlus, 
  Settings, 
  ShieldAlert, 
  RefreshCw,
  Sliders,
  CheckCircle,
  HelpCircle,
  Loader2,
  Edit3,
  Search,
  UserCheck,
  Download,
  Mail,
  MessageSquare,
  FileText,
  Share2,
  Check
} from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: "Owner" | "Manager" | "Cashier";
  createdAt: string;
}

interface ConnectedDevice {
  id: string;
  type: "Desktop POS" | "Mobile POS" | "Tablet" | "Unknown";
  os: string;
  ip: string;
  lastActive: string;
  status: "Active" | "Idle";
}

interface SystemConfig {
  headerGreetings: string;
  footerGreetings: string;
  showTaxBreakdown: boolean;
  showSalesperson: boolean;
  showSizeColor: boolean;
  vatStandardRate: number;
}

interface ManagementConsoleProps {
  isIpsHighContrast: boolean;
  currentUserRole: string;
}

export default function ManagementConsole({ isIpsHighContrast, currentUserRole }: ManagementConsoleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"employees" | "receipts" | "customers">("employees");
  
  // Employees State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Manager" | "Cashier">("Cashier");
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Customer Leads State
  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadsSearch, setLeadsSearch] = useState("");
  
  // Sales Ledger State
  const [sales, setSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  
  // Selected customer and active invoice for digital receipts workspace
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [dispatchMessage, setDispatchMessage] = useState("");
  
  // States for adding manual Customer Lead
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custVip, setCustVip] = useState(false);
  const [custNotes, setCustNotes] = useState("");

  // States for editing Employee profile
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Devices State
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [devicePollTicker, setDevicePollTicker] = useState(0);

  // Configuration State
  const [config, setConfig] = useState<SystemConfig>({
    headerGreetings: "THANK YOU FOR SHOPPING WITH SUIT PRO LONDON",
    footerGreetings: "BESPOKE TAILORING & READY-TO-WEAR - SAVILE ROW",
    showTaxBreakdown: true,
    showSalesperson: true,
    showSizeColor: true,
    vatStandardRate: 20
  });
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Master System Reset States
  const [resetSecurityKey, setResetSecurityKey] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Load Initial Configurations
  useEffect(() => {
    fetchUsers();
    fetchDevices();
    fetchSystemConfig();
    fetchLeads();
    fetchSales();
  }, []);

  // Periodic device poller
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDevices();
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error("Failed to load customer profiles:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchSales = async () => {
    setLoadingSales(true);
    try {
      const res = await fetch("/api/sales");
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch (err) {
      console.error("Failed to load sales database ledger:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchSystemConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/system/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // Sync local storage as well for fast client retrieval
        localStorage.setItem("suitpro_vat_rate", String(data.vatStandardRate));
        localStorage.setItem("suitpro_header_greets", data.headerGreetings);
        localStorage.setItem("suitpro_footer_greets", data.footerGreetings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Persist system config to server and localStorage, and notify clients
  const saveSystemConfig = async (nextConfig: SystemConfig) => {
    try {
      localStorage.setItem("suitpro_vat_rate", String(nextConfig.vatStandardRate));
      localStorage.setItem("suitpro_header_greets", nextConfig.headerGreetings);
      localStorage.setItem("suitpro_footer_greets", nextConfig.footerGreetings);
      // Inform other windows/tabs via custom event
      try {
        window.dispatchEvent(new CustomEvent('suitpro_config_updated', { detail: nextConfig }));
      } catch (e) {
        // ignore
      }

      // Attempt to persist to backend API if available
      await fetch('/api/system/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig)
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to save system config locally', err);
    }
  };

  // Add user account
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    if (currentUserRole !== "Owner" && currentUserRole !== "Manager") {
      setUserError("SECURITY EXCEPTION: Only System Owners and Managers are authorized to onboard new employees.");
      return;
    }

    if (currentUserRole === "Manager" && newRole !== "Cashier") {
      setUserError("SECURITY EXCEPTION: Managers are only authorized to onboard Cashier profiles.");
      return;
    }

    if (!newUsername.trim() || !newPassword.trim() || !newName.trim()) {
      setUserError("Please complete all fields to establish a user profile.");
      return;
    }

    try {
      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          username: newUsername.trim(),
          password: newPassword.trim(),
          name: newName.trim(),
          role: newRole
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error || "Establishment of employee failed.");
      } else {
        setUserSuccess(`Account for ${newName} created successfully as ${newRole}!`);
        setNewName("");
        setNewUsername("");
        setNewPassword("");
        fetchUsers();
      }
    } catch (err) {
      setUserError("Failed to reach server authentication gateway.");
    }
  };

  // Assign user roles
  const handleAssignRole = async (userId: string, targetRole: "Owner" | "Manager" | "Cashier") => {
    setUserError(null);
    setUserSuccess(null);
    if (currentUserRole !== "Owner" && currentUserRole !== "Manager") {
      setUserError("SECURITY EXCEPTION: Only System Owners and Managers are authorized to alter employee privilege groups.");
      return;
    }
    
    const targetUser = users.find(u => u.id === userId);
    if (currentUserRole === "Manager") {
      if (targetRole !== "Cashier") {
        setUserError("SECURITY EXCEPTION: Managers can only manage Cashier privilege groups.");
        return;
      }
      if (targetUser && (targetUser.role === "Owner" || targetUser.role === "Manager")) {
        setUserError("SECURITY EXCEPTION: Managers are not authorized to alter Owner or Manager credentials.");
        return;
      }
    }

    try {
      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign-role", id: userId, role: targetRole })
      });
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error || "Dynamic role assignment failed.");
      } else {
        setUserSuccess("Employee role re-assigned and committed successfully.");
        fetchUsers();
      }
    } catch (err) {
      setUserError("Failed to update employee access state.");
    }
  };

  // Delete user
  const handleDeleteUser = async (id: string, name: string) => {
    if (currentUserRole !== "Owner" && currentUserRole !== "Manager") {
      setUserError("SECURITY EXCEPTION: Only System Owners and Managers are authorized to remove employee profiles.");
      return;
    }

    const targetUser = users.find(u => u.id === id);
    if (currentUserRole === "Manager" && targetUser && (targetUser.role === "Owner" || targetUser.role === "Manager")) {
      setUserError("SECURITY EXCEPTION: Managers are not authorized to remove Owner or Manager profiles.");
      return;
    }

    const ownerCount = users.filter(u => u.role === "Owner").length;
    if (targetUser && targetUser.role === "Owner" && ownerCount <= 1) {
      setUserError("The final System Owner profile cannot be removed.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${name} from showroom registers?`)) {
      return;
    }

    setUserError(null);
    setUserSuccess(null);
    try {
      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id })
      });
      const data = await res.json();
      if (res.ok) {
        setUserSuccess(`Account ${name} deleted successfully.`);
        fetchUsers();
      } else {
        setUserError(data.error || "Deletion protocol rejected.");
      }
    } catch (err) {
      setUserError("Server reachability interrupted.");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);
    if (!editingUserId) return;
    if (!editName.trim() || !editUsername.trim()) {
      setUserError("Name and username cannot be blank.");
      return;
    }
    try {
      const payload: any = {
        action: "update",
        id: editingUserId,
        name: editName.trim(),
        username: editUsername.trim()
      };
      if (editPassword) {
        payload.password = editPassword;
      }
      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error || "Failed to update employee details.");
      } else {
        setUserSuccess(`Successfully updated profile for ${editName}!`);
        setEditingUserId(null);
        setEditName("");
        setEditUsername("");
        setEditPassword("");
        fetchUsers();
      }
    } catch (err) {
      setUserError("Error communicating with server authentication gateway.");
    }
  };

  // Manual Customer Lead addition
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) {
      alert("Name and Phone number are required.");
      return;
    }
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: custName.trim(),
          phone: custPhone.trim(),
          email: custEmail.trim(),
          vip: custVip,
          notes: custNotes.trim()
        })
      });
      if (res.ok) {
        setCustName("");
        setCustPhone("");
        setCustEmail("");
        setCustVip(false);
        setCustNotes("");
        fetchLeads();
      } else {
        alert("Could not register customer profile.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete customer profile
  const handleDeleteCustomer = async (name: string, phone: string) => {
    if (!confirm(`Are you sure you want to remove customer "${name}" from the system?`)) {
      return;
    }
    try {
      const res = await fetch("/api/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone })
      });
      if (res.ok) {
        fetchLeads();
      } else {
        alert("Failed to remove customer.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRedispatchReceipt = (invoice: any, customer: any, method: "whatsapp" | "email") => {
    setDispatchStatus("sending");
    setDispatchMessage(`Initializing secure high-priority ${method.toUpperCase()} dispatcher...`);
    
    const brandName = "Suit Pro London";
    const subject = `Invoice Receipt from ${brandName} - ${invoice.id}`;
    
    const itemsListText = invoice.items && invoice.items.length > 0
      ? invoice.items.map((item: any) => `• ${item.name} (Qty:${item.qty}, Size:${item.size || "Standard"}, Col:${item.colour || "Default"})`).join("\n")
      : "No items listed.";

    const vatPercentLocal = Number(localStorage.getItem('suitpro_vat_rate') || 20);
    const receiptBody = `----------------------------------
  ★ ${brandName.toUpperCase()} SHOWROOM ★
  Premium Bespoke Tailoring & Apparel
  ----------------------------------
  Invoice ID: ${invoice.id || "INV-DRAFT"}
  Date: ${invoice.timestamp ? new Date(invoice.timestamp).toLocaleString() : new Date().toLocaleString()}
  Salesperson: ${invoice.salesperson || "Cashier"}
  ----------------------------------
  Items Purchased:
  ${itemsListText}
  ----------------------------------
  Subtotal: £${(invoice.subtotal || 0).toFixed(2)}
  VAT (${vatPercentLocal}%): £${(invoice.vat || 0).toFixed(2)}
  TOTAL PAID: £${(invoice.total || 0).toFixed(2)}
  ----------------------------------
  Thank you for choosing ${brandName}!
  Bespoke fits & tailored excellence.
  ==================================`;

    if (method === "whatsapp") {
      setTimeout(() => {
        setDispatchMessage("Opening browser tab to dispatch receipt via WhatsApp Web / Desktop...");
      }, 400);
      setTimeout(() => {
        const cleanedPhone = (customer.phone || "").replace(/[^0-9]/g, "");
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(receiptBody)}`;
        window.open(waUrl, "_blank");
        
        // Trigger backup TXT download
        const blob = new Blob([receiptBody], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${invoice.id}_whatsapp_receipt.txt`;
        link.click();
        
        setDispatchMessage(`Launched WhatsApp Web dispatcher successfully to ${customer.phone} and downloaded backup receipt.`);
        setDispatchStatus("success");
      }, 1200);
    } else if (method === "email") {
      setTimeout(() => {
        setDispatchMessage("Generating file download & launching Gmail Web composer...");
      }, 400);
      setTimeout(() => {
        // Trigger automatic receipt file download
        const blob = new Blob([receiptBody], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${invoice.id}_invoice_receipt.txt`;
        link.click();

        // Launch Gmail Web Composer in a new tab
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customer.email || "")}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(receiptBody)}`;
        window.open(gmailUrl, "_blank");

        // Offer native mail client fallback
        const mailtoUrl = `mailto:${customer.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(receiptBody)}`;
        window.open(mailtoUrl, "_blank");

        setDispatchMessage(`Successfully opened Gmail composer and initiated automatic receipt invoice download!`);
        setDispatchStatus("success");
      }, 1200);
    }
  };

  const printPremiumReceiptPDF = (invoice: any, customer: any = null) => {
    const printWindow = { document: {
      write: (html: string) => requestPrintPreview({ title: `Invoice ${invoice.id || "INV-DRAFT"}`, html, paperSize: "A4" }),
      close: () => undefined
    } };

    const brandName = "Suit Pro London";
    const custName = customer?.name || invoice.customer?.name || "Valued Client";
    const custPhone = customer?.phone || invoice.customer?.phone || "N/A";
    const custEmail = customer?.email || invoice.customer?.email || "N/A";
    const isVip = customer?.vip || invoice.customer?.vip || false;

    const itemsHtml = (invoice.items && invoice.items.length > 0)
      ? invoice.items.map((item: any) => {
          const sizeStr = item.size ? `Size: ${item.size}` : "Standard Size";
          const colourStr = item.colour ? `Colour: ${item.colour}` : "Default Colour";
          const qty = item.qty || 1;
          const unitPrice = item.sellingPrice || (invoice.total ? (invoice.total / (invoice.items.length || 1)) : 0);
          const lineTotal = unitPrice * qty;
          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 10px; text-align: left;">
                <div style="font-weight: 600; font-size: 13px; color: #000;">${item.name || "Bespoke Garment"}</div>
                <div style="font-size: 11px; color: #000; margin-top: 3px;">${sizeStr} | ${colourStr}</div>
              </td>
              <td style="padding: 12px 10px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #000;">${qty}</td>
              <td style="padding: 12px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #000;">£${unitPrice.toFixed(2)}</td>
              <td style="padding: 12px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #000;">£${lineTotal.toFixed(2)}</td>
            </tr>
          `;
        }).join("")
      : `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 10px; text-align: left;">
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">Bespoke Tailoring & Styling Services</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Custom Fit Commission Order</div>
          </td>
          <td style="padding: 12px 10px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #475569;">1</td>
          <td style="padding: 12px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #475569;">£${(invoice.subtotal || invoice.total || 0).toFixed(2)}</td>
          <td style="padding: 12px 10px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #1e293b;">£${(invoice.subtotal || invoice.total || 0).toFixed(2)}</td>
        </tr>
      `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Suit Pro London Receipt - \${invoice.id || "INV-DRAFT"}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono&display=swap');
            
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              margin: 0;
              padding: 40px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .invoice-card {
              max-width: 820px;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              border-radius: 20px;
              padding: 45px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
            }
            
            .header-layout {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            
            .header-left {
              vertical-align: top;
              text-align: left;
            }
            
            .header-right {
              vertical-align: top;
              text-align: right;
            }
            
            .brand-logo {
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 700;
              font-size: 26px;
              letter-spacing: -0.03em;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0;
            }
            
            .brand-tagline {
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 500;
              font-size: 10px;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              color: #b89047;
              margin: 4px 0 0 0;
            }
            
            .brand-address {
              font-size: 11px;
              color: #64748b;
              margin-top: 10px;
              line-height: 1.5;
            }
            
            .document-title {
              font-family: 'Space Grotesk', sans-serif;
              font-weight: 700;
              font-size: 20px;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              color: #b89047;
              margin: 0;
            }
            
            .document-id {
              font-family: 'JetBrains Mono', monospace;
              font-size: 13px;
              color: #475569;
              margin: 6px 0 0 0;
              font-weight: 600;
            }
            
            .meta-grid {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            
            .meta-box {
              width: 50%;
              vertical-align: top;
              padding: 20px;
              background-color: #f8fafc;
              border: 1px solid #f1f5f9;
              border-radius: 12px;
            }
            
            .meta-box-right {
              width: 50%;
              vertical-align: top;
              padding: 20px;
              background-color: #f8fafc;
              border: 1px solid #f1f5f9;
              border-radius: 12px;
            }
            
            .meta-title {
              font-family: 'Space Grotesk', sans-serif;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #b89047;
              margin: 0 0 10px 0;
            }
            
            .meta-text {
              font-size: 13px;
              line-height: 1.6;
              color: #334155;
              margin: 4px 0;
            }
            
            .vip-badge {
              display: inline-block;
              background-color: #b89047;
              color: #ffffff;
              font-family: 'Space Grotesk', sans-serif;
              font-size: 9px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 4px;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              margin-left: 5px;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 35px;
            }
            
            .items-table th {
              background-color: #0f172a;
              color: #ffffff;
              font-family: 'Space Grotesk', sans-serif;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              padding: 12px 10px;
              border: none;
            }
            
            .summary-container {
              width: 100%;
              margin-bottom: 40px;
            }
            
            .summary-table {
              width: 320px;
              margin-left: auto;
              border-collapse: collapse;
            }
            
            .summary-table td {
              padding: 8px 10px;
              font-size: 13px;
              color: #475569;
            }
            
            .summary-total-row {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
            }
            
            .summary-total-row td {
              font-weight: 700;
              color: #0f172a;
              font-size: 15px;
              padding: 12px 10px;
            }
            
            .footer {
              text-align: center;
              border-top: 1px solid #e2e8f0;
              padding-top: 30px;
              font-size: 11px;
              color: #64748b;
              line-height: 1.6;
              margin-top: 30px;
            }
            
            @media print {
              body {
                padding: 0;
              }
              .invoice-card {
                border: none;
                box-shadow: none;
                padding: 0;
                max-width: 100%;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-card">
            <!-- Header Section -->
            <table class="header-layout">
              <tr>
                <td class="header-left">
                  <h1 class="brand-logo">\${brandName}</h1>
                  <p class="brand-tagline">Bespoke Tailoring & Showroom</p>
                  <p class="brand-address">
                    12 Savile Row, Mayfair<br>
                    London, W1S 3PQ<br>
                    showroom@suitpro.co.uk | +44 20 7123 4567
                  </p>
                </td>
                <td class="header-right">
                  <h2 class="document-title">Transaction Receipt</h2>
                  <p class="document-id">ID: \${invoice.id || "INV-DRAFT"}</p>
                </td>
              </tr>
            </table>

            <!-- Metadata Section -->
            <table class="meta-grid">
              <tr>
                <td class="meta-box" style="padding-right: 15px;">
                  <h3 class="meta-title">Client Account</h3>
                  <p class="meta-text"><strong>Name:</strong> \${custName}\${isVip ? '<span class="vip-badge">★ VIP MEMBER</span>' : ''}</p>
                  <p class="meta-text"><strong>Phone:</strong> \${custPhone}</p>
                  <p class="meta-text"><strong>Email:</strong> \${custEmail}</p>
                </td>
                <td style="width: 20px;"></td>
                <td class="meta-box-right" style="padding-left: 15px;">
                  <h3 class="meta-title">Transaction Details</h3>
                  <p class="meta-text"><strong>Date:</strong> \${invoice.timestamp ? new Date(invoice.timestamp).toLocaleString("en-GB") : new Date().toLocaleString("en-GB")}</p>
                  <p class="meta-text"><strong>Salesperson:</strong> \${invoice.salesperson || "Showroom Executive"}</p>
                  <p class="meta-text"><strong>Payment Method:</strong> \${invoice.paymentMethod || "Direct Settlement"}</p>
                </td>
              </tr>
            </table>

            <!-- Itemized Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="text-align: left; border-top-left-radius: 8px;">Description & Specification</th>
                  <th style="width: 80px; text-align: center;">Qty</th>
                  <th style="width: 120px; text-align: right;">Unit Price</th>
                  <th style="width: 120px; text-align: right; border-top-right-radius: 8px;">Total</th>
                </tr>
              </thead>
              <tbody>
                \${itemsHtml}
              </tbody>
            </table>

            <!-- Summary Table -->
            <div class="summary-container">
              <table class="summary-table">
                <tr>
                  <td>Subtotal (Excl. VAT):</td>
                  <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">£\${(invoice.subtotal || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>VAT Component (20%):</td>
                  <td style="text-align: right; font-family: 'JetBrains Mono', monospace;">£\${(invoice.vat || 0).toFixed(2)}</td>
                </tr>
                <tr class="summary-total-row">
                  <td style="border-bottom-left-radius: 8px; border-top-left-radius: 8px;">Total Paid:</td>
                  <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 700; border-bottom-right-radius: 8px; border-top-right-radius: 8px;">£\${(invoice.total || 0).toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p><strong>Thank you for choosing Suit Pro London.</strong></p>
              <p style="font-style: italic; margin-top: 5px;">Bespoke garments & tailored garments represent the finest lineage of Savile Row style. For adjustments or styling consultations, please schedule with your dedicated advisor.</p>
              <p style="font-size: 9px; color: #94a3b8; margin-top: 20px;">SUIT PRO LONDON SHOWROOM • REGISTERED IN ENGLAND AND WALES • REG: 09124451</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export Customer leads to CSV
  const handleExportCustomers = () => {
    if (leads.length === 0) {
      alert("No customer data available to export.");
      return;
    }
    const headers = "Timestamp,Name,Phone,Email,VIP Status,Notes\n";
    const rows = leads.map(l => {
      const ts = l.timestamp || new Date().toISOString();
      const n = (l.name || "").replace(/"/g, '""');
      const p = (l.phone || "").replace(/"/g, '""');
      const e = (l.email || "").replace(/"/g, '""');
      const vip = l.vip ? "VIP" : "Standard";
      const notes = (l.notes || "").replace(/"/g, '""');
      return `"${ts}","${n}","${p}","${e}","${vip}","${notes}"`;
    }).join("\n");
    
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `suitpro_customers_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Save Config
  const handleSaveConfig = async () => {
    setConfigSuccess(null);
    setLoadingConfig(true);
    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setConfigSuccess("Dynamic showroom invoice rules and tax bases committed!");
        // Sync local storage
        localStorage.setItem("suitpro_vat_rate", String(data.vatStandardRate));
        localStorage.setItem("suitpro_header_greets", data.headerGreetings);
        localStorage.setItem("suitpro_footer_greets", data.footerGreetings);
        localStorage.setItem("suitpro_config_show_salesperson", String(data.showSalesperson));
        localStorage.setItem("suitpro_config_show_sizecolor", String(data.showSizeColor));
        localStorage.setItem("suitpro_config_show_taxbreakdown", String(data.showTaxBreakdown));
      } else {
        alert("Failed to save terminal configs.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSystemReset = async () => {
    setResetError(null);
    setResetSuccess(null);

    if (!resetSecurityKey) {
      setResetError("Please enter the authorization security key to proceed.");
      return;
    }

    if (!confirm("CRITICAL WARNING: This will erase all showroom records and product inventories. Are you sure you want to execute a total system reset?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch("/api/system/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: resetSecurityKey })
      });

      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "System reset rejected.");
      } else {
        // Erase local cache buffers entirely for secure reset compliance
        localStorage.removeItem("suitpro_products");
        localStorage.removeItem("suitpro_sales");
        localStorage.removeItem("suitpro_expenses");
        localStorage.removeItem("suitpro_receipts");
        localStorage.removeItem("suitpro_logs");
        localStorage.removeItem("suitpro_active_user");

        setResetSuccess("Total system reset completed successfully! Re-initializing showroom application...");
        setResetSecurityKey("");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err: any) {
      setResetError("Failed to reach administrative gateway: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in font-sans">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800/60 pb-5">
        <div>
          <h2 className={`text-2xl font-display font-medium uppercase tracking-wider ${
            isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
          }`}>
            Management & Security Console
          </h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-mono mt-1">
            System Control, Dynamic Employee RBAC Assignment, and Connected Devices
          </p>
        </div>
        
        {/* Toggle navigation */}
        <div className="flex bg-[#121217] border border-neutral-800/80 rounded-xl p-1.5 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveSubTab("employees")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
              activeSubTab === "employees"
                ? "bg-[#dfb76c] text-black font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Employee Control
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("customers")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
              activeSubTab === "customers"
                ? "bg-[#dfb76c] text-black font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Customer Database
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("receipts")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
              activeSubTab === "receipts"
                ? "bg-[#dfb76c] text-black font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Invoice Configuration
          </button>
        </div>
      </div>

      {/* SUBTAB CONTENT 1: EMPLOYEES & RBAC CONTROL */}
      {activeSubTab === "employees" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Card left: Create new profile */}
          <div className={`border rounded-2xl p-6 space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border-neutral-800/60"
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
            }`}>
              <div className="flex items-center gap-2">
                <UserPlus className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                  isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                }`}>
                  {editingUserId ? "Edit Employee Profile" : "Create Employee Profile"}
                </h4>
              </div>
              {editingUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUserId(null);
                    setEditName("");
                    setEditUsername("");
                    setEditPassword("");
                  }}
                  className="text-[9px] font-mono uppercase tracking-wider text-rose-400 hover:text-rose-300 font-bold"
                >
                  Cancel
                </button>
              )}
            </div>

            {userError && (
              <div className="bg-red-950/20 border border-red-500/30 text-red-400 p-3 rounded-lg text-[10px] font-mono">
                {userError}
              </div>
            )}
            {userSuccess && (
              <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-[10px] font-mono">
                {userSuccess}
              </div>
            )}

            {editingUserId ? (
              <form onSubmit={handleUpdateUser} className="space-y-4 text-xs font-mono">
                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    New Password (leave empty to keep current)
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full font-bold py-2.5 rounded-lg uppercase tracking-wider text-[10px] mt-2 transition-colors text-center cursor-pointer ${
                    isIpsHighContrast 
                      ? "bg-[#b89047] hover:bg-[#a67f3c] text-white" 
                      : "bg-[#dfb76c] hover:bg-[#edd19b] text-black"
                  }`}
                >
                  Save Profile Changes
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-mono">
                {currentUserRole !== "Owner" && currentUserRole !== "Manager" && (
                  <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-500 text-[9px] uppercase tracking-wider leading-relaxed">
                    ⚠️ SECURITY LOCK: Onboarding of new showroom employees is restricted to the System Owner or Managers only.
                  </div>
                )}

                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Richard Savile"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={currentUserRole !== "Owner" && currentUserRole !== "Manager"}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      currentUserRole !== "Owner" && currentUserRole !== "Manager"
                        ? "bg-neutral-800/10 text-neutral-500 cursor-not-allowed border-neutral-800"
                        : isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. richard_tailor"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={currentUserRole !== "Owner" && currentUserRole !== "Manager"}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      currentUserRole !== "Owner" && currentUserRole !== "Manager"
                        ? "bg-neutral-800/10 text-neutral-500 cursor-not-allowed border-neutral-800"
                        : isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    Passcode / Password
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 123456"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={currentUserRole !== "Owner" && currentUserRole !== "Manager"}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      currentUserRole !== "Owner" && currentUserRole !== "Manager"
                        ? "bg-neutral-800/10 text-neutral-500 cursor-not-allowed border-neutral-800"
                        : isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    System Privilege Level (RBAC)
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "Manager" | "Cashier")}
                    disabled={currentUserRole !== "Owner" && currentUserRole !== "Manager"}
                    className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                      currentUserRole !== "Owner" && currentUserRole !== "Manager"
                        ? "bg-neutral-800/10 text-neutral-500 cursor-not-allowed border-neutral-800"
                        : isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-850 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  >
                    {currentUserRole === "Owner" && <option value="Manager">Manager Role</option>}
                    <option value="Cashier">Cashier Role</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={currentUserRole !== "Owner" && currentUserRole !== "Manager"}
                  className={`w-full font-bold py-2.5 rounded-lg uppercase tracking-wider text-[10px] mt-2 transition-colors text-center ${
                    currentUserRole !== "Owner" && currentUserRole !== "Manager"
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : isIpsHighContrast 
                      ? "bg-[#b89047] hover:bg-[#a67f3c] text-white cursor-pointer" 
                      : "bg-[#dfb76c] hover:bg-[#edd19b] text-black cursor-pointer"
                  }`}
                >
                  Onboard Employee
                </button>
              </form>
            )}
          </div>

          {/* Cards right: Employees lists and roles assigner */}
          <div className={`border rounded-2xl p-6 lg:col-span-2 space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border-neutral-800/60"
          }`}>
            <div className={`flex justify-between items-center border-b pb-3 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
            }`}>
              <div className="flex items-center gap-2">
                <Users className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                  isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                }`}>
                  Active Showroom Roster Directory
                </h4>
              </div>
              <button
                type="button"
                onClick={fetchUsers}
                className={`transition-all font-mono text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer ${
                  isIpsHighContrast ? "text-neutral-500 hover:text-neutral-850" : "text-gray-400 hover:text-white"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${loadingUsers ? "animate-spin" : ""}`} />
                Refresh Directories
              </button>
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-12 text-gray-400 font-mono text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#dfb76c]" />
                Reading Employee Roster catalog...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse text-left">
                  <thead>
                    <tr className={`border-b text-[9px] uppercase tracking-wider ${
                      isIpsHighContrast ? "border-neutral-200 text-neutral-500" : "border-neutral-800/60 text-gray-500"
                    }`}>
                      <th className="py-2.5">Staff Name</th>
                      <th className="py-2.5">Username</th>
                      <th className="py-2.5">Active Role</th>
                      <th className="py-2.5 text-center">Assign Role</th>
                      <th className="py-2.5 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Explicit Master Row, protected and hardcoded */}
                    <tr className={`border-b font-medium ${
                      isIpsHighContrast ? "border-neutral-100" : "border-neutral-800/30"
                    }`}>
                      <td className={`py-3 font-semibold ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>Rumel Ahmed</td>
                      <td className={`py-3 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>Rumel</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest border ${
                          isIpsHighContrast 
                            ? "bg-amber-100/30 border-amber-500/20 text-amber-700" 
                            : "bg-amber-500/15 border border-amber-500/30 text-amber-500"
                        }`}>
                          System Owner
                        </span>
                      </td>
                      <td className={`py-3 text-center text-[10px] font-mono italic ${
                        isIpsHighContrast ? "text-neutral-400" : "text-gray-500"
                      }`}>
                        Unmodifiable Master Access
                      </td>
                      <td className="py-3 text-right">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${
                          isIpsHighContrast ? "text-neutral-400" : "text-gray-600"
                        }`}>Protected</span>
                      </td>
                    </tr>

                    {/* Dynamic DB Rows */}
                    {users.filter(u => u.username !== "Rumel").map((usr) => (
                      <tr key={usr.id} className={`border-b transition-colors ${
                        isIpsHighContrast 
                          ? "border-neutral-100 hover:bg-neutral-50/70" 
                          : "border-neutral-850 hover:bg-[#121217]/80"
                      }`}>
                        <td className={`py-3 font-medium ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>{usr.name}</td>
                        <td className={`py-3 ${isIpsHighContrast ? "text-neutral-600" : "text-gray-300"}`}>{usr.username}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest border ${
                            usr.role === "Manager" 
                              ? isIpsHighContrast 
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                              : isIpsHighContrast
                                ? "bg-neutral-100 border-neutral-300 text-neutral-600"
                                : "bg-neutral-500/10 border-neutral-500/20 text-neutral-400"
                          }`}>
                            {usr.role}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {currentUserRole === "Owner" ? (
                            <div className="flex justify-center gap-1.5 font-mono">
                              <button
                                type="button"
                                onClick={() => handleAssignRole(usr.id, "Manager")}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                                  usr.role === "Manager" 
                                    ? "bg-blue-500 text-black" 
                                    : isIpsHighContrast
                                      ? "bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
                                      : "bg-neutral-800 hover:bg-neutral-700 text-gray-300"
                                }`}
                              >
                                Manager
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAssignRole(usr.id, "Cashier")}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                                  usr.role === "Cashier" 
                                    ? "bg-neutral-500 text-black" 
                                    : isIpsHighContrast
                                      ? "bg-neutral-200 hover:bg-neutral-300 text-neutral-800"
                                      : "bg-neutral-800 hover:bg-neutral-700 text-gray-300"
                                }`}
                              >
                                Cashier
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-[10px] italic font-sans">Owner Clearance Required</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {(currentUserRole === "Owner" || (currentUserRole === "Manager" && usr.role === "Cashier")) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserId(usr.id);
                                  setEditName(usr.name);
                                  setEditUsername(usr.username);
                                  setEditPassword("");
                                }}
                                className="text-[#dfb76c] hover:text-[#edd19b] p-1 cursor-pointer transition-colors inline-block"
                                title="Edit employee profile"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(usr.id, usr.name)}
                              className="text-rose-500 hover:text-rose-400 p-1 cursor-pointer transition-colors inline-block"
                              title="Remove employee profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {users.filter(u => u.username !== "Rumel").length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-500 italic">
                          No other dynamically registered employees found. Complete left onboard form to add staff.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB CONTENT 2: CUSTOMER DATABASE */}
      {activeSubTab === "customers" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card left: Register customer profile */}
          <div className={`border rounded-2xl p-6 space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border-neutral-800/60"
          }`}>
            <div className={`flex items-center gap-2 border-b pb-3 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
            }`}>
              <UserPlus className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
              }`}>
                Register New Customer
              </h4>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. James Smith"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  required
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +447123456789"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  required
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. james@london.co.uk"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vipCheckbox"
                  checked={custVip}
                  onChange={(e) => setCustVip(e.target.checked)}
                  className="rounded border-neutral-800 text-[#dfb76c] focus:ring-0 cursor-pointer w-4 h-4"
                />
                <label htmlFor="vipCheckbox" className={`uppercase tracking-wider font-bold text-[9px] cursor-pointer select-none ${
                  isIpsHighContrast ? "text-neutral-600" : "text-gray-300"
                }`}>
                  Mark as VIP Clientele
                </label>
              </div>

              <div className="space-y-1">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>
                  Bespoke Notes / Measurement Notes
                </label>
                <textarea
                  placeholder="e.g. Chest: 40R, Waist: 34L. Prefers double-breasted."
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  rows={3}
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                />
              </div>

              <button
                type="submit"
                className={`w-full font-bold py-2.5 rounded-lg uppercase tracking-wider text-[10px] mt-2 transition-colors text-center cursor-pointer ${
                  isIpsHighContrast 
                    ? "bg-[#b89047] hover:bg-[#a67f3c] text-white" 
                    : "bg-[#dfb76c] hover:bg-[#edd19b] text-black"
                }`}
              >
                Register Customer
              </button>
            </form>
          </div>

          {/* Cards right: Customers Directory list */}
          <div className={`border rounded-2xl p-6 lg:col-span-2 space-y-4 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border border-neutral-800/60"
          }`}>
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
            }`}>
              <div className="flex items-center gap-2">
                <Users className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                  isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                }`}>
                  Customer Database Directory
                </h4>
              </div>
              <button
                type="button"
                onClick={handleExportCustomers}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] uppercase font-mono tracking-wider transition-colors cursor-pointer ${
                  isIpsHighContrast
                    ? "bg-neutral-50 border-neutral-250 text-neutral-800 hover:bg-neutral-100"
                    : "bg-[#1e1e24] border-neutral-800 text-gray-300 hover:text-white hover:bg-neutral-800"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV Ledger
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by Name, Phone, Email, or Notes..."
                value={leadsSearch}
                onChange={(e) => setLeadsSearch(e.target.value)}
                className={`w-full rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:ring-0 text-xs font-mono ${
                  isIpsHighContrast 
                    ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                    : "bg-[#0b0b0d] border border-neutral-850 focus:border-[#dfb76c] text-white"
                }`}
              />
            </div>

            {loadingLeads ? (
              <div className="py-12 text-center text-gray-400 font-mono text-xs flex justify-center items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Retrieving customer ledger indexes...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-800/40">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className={`border-b text-[10px] uppercase tracking-wider ${
                      isIpsHighContrast ? "bg-neutral-50 border-neutral-200 text-neutral-600" : "bg-[#0b0b0d] border-neutral-850 text-gray-400"
                    }`}>
                      <th className="py-3 px-4">Client Detail</th>
                      <th className="py-3 px-4">Phone / Contact</th>
                      <th className="py-3 px-4">Classification</th>
                      <th className="py-3 px-4">Tailoring Specifications / Notes</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads
                      .filter(l => {
                        if (!leadsSearch) return true;
                        const s = leadsSearch.toLowerCase();
                        return (
                          (l.name || "").toLowerCase().includes(s) ||
                          (l.phone || "").toLowerCase().includes(s) ||
                          (l.email || "").toLowerCase().includes(s) ||
                          (l.notes || "").toLowerCase().includes(s)
                        );
                      })
                      .map((lead, idx) => (
                        <tr key={idx} className={`border-b transition-colors ${
                          isIpsHighContrast 
                            ? "border-neutral-100 hover:bg-neutral-50/70" 
                            : "border-neutral-850 hover:bg-[#121217]/80"
                        }`}>
                          <td className="py-3.5 px-4 font-bold text-white">
                            <div>{lead.name}</div>
                            {lead.email && <div className="text-[10px] text-gray-400 font-normal">{lead.email}</div>}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-gray-300">
                            {lead.phone}
                          </td>
                          <td className="py-3.5 px-4">
                            {lead.vip ? (
                              <span className="px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                VIP CLIENT
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-widest bg-neutral-500/10 border border-neutral-500/20 text-neutral-400">
                                STANDARD
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[10px] text-gray-400 max-w-xs truncate" title={lead.notes || "No notes."}>
                            {lead.notes || "-"}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(lead);
                                  setSelectedInvoice(null);
                                  setDispatchStatus("idle");
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-mono font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                                  selectedCustomer && selectedCustomer.phone === lead.phone
                                    ? "bg-[#dfb76c]/10 border-[#dfb76c]/30 text-[#dfb76c]"
                                    : isIpsHighContrast
                                    ? "bg-neutral-100 border-neutral-300 text-neutral-800 hover:bg-neutral-200"
                                    : "bg-neutral-800/40 border-neutral-800 text-gray-300 hover:text-white hover:bg-neutral-800"
                                }`}
                                title="View Customer Digital Receipts Ledger"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Receipts</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(lead.name, lead.phone)}
                                className="text-rose-500 hover:text-rose-400 p-2 cursor-pointer transition-colors inline-block hover:bg-rose-500/10 rounded-lg"
                                title="Delete customer registration"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500 italic">
                          No registered customer contacts found. Customer contacts are automatically generated upon sales orders or manually created on the left form.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selectedCustomer && (
          <div className={`mt-6 border rounded-2xl p-6 space-y-6 transition-all duration-300 ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border border-neutral-800/60"
          }`}>
            {/* Header */}
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
            }`}>
              <div className="flex items-center gap-2.5">
                <FileText className={`w-5 h-5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
                <div>
                  <h4 className={`text-xs font-mono font-bold uppercase tracking-widest ${
                    isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
                  }`}>
                    Bespoke Receipts Dispatch & Archive Ledger
                  </h4>
                  <p className={`text-[10px] font-mono mt-0.5 ${isIpsHighContrast ? "text-neutral-500" : "text-gray-400"}`}>
                    Active Client: <span className="font-bold text-[#dfb76c]">{selectedCustomer.name}</span> ({selectedCustomer.phone || "No Phone"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSelectedInvoice(null);
                  setDispatchStatus("idle");
                }}
                className={`text-[9px] font-mono uppercase tracking-wider px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                  isIpsHighContrast
                    ? "bg-neutral-50 hover:bg-neutral-100 border-neutral-250 text-neutral-800"
                    : "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 text-rose-400 hover:text-rose-300"
                }`}
              >
                Close Receipts Panel
              </button>
            </div>

            {/* Status Indicator */}
            {dispatchStatus !== "idle" && (
              <div className={`p-4 rounded-xl border font-mono text-xs ${
                dispatchStatus === "sending"
                  ? "bg-amber-500/5 border-amber-500/20 text-amber-500 flex items-center gap-2"
                  : dispatchStatus === "success"
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/5 border-rose-500/20 text-rose-400"
              }`}>
                {dispatchStatus === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
                <div>
                  <span className="font-bold uppercase tracking-widest block text-[9px] mb-0.5">
                    {dispatchStatus === "sending" && "⚡ TRANSMITTING DIGITAL PAYLOAD..."}
                    {dispatchStatus === "success" && "✓ DISPATCH GATEWAY CONNECTED"}
                    {dispatchStatus === "error" && "⚠️ DISPATCHER TRANSMISSION ERROR"}
                  </span>
                  {dispatchMessage}
                </div>
              </div>
            )}

            {/* Grid: Invoice List vs. Receipt Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
              
              {/* Left Column: Purchase Invoice History list */}
              <div className="space-y-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${
                  isIpsHighContrast ? "text-neutral-600" : "text-gray-400"
                }`}>
                  Invoice Archives Matching Client
                </span>
                
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {(() => {
                    const matchedSales = sales.filter(s => {
                      const customerPhoneNorm = (selectedCustomer.phone || "").replace(/[^0-9]/g, "");
                      const salePhoneNorm = (s.customer?.phone || "").replace(/[^0-9]/g, "");
                      
                      const customerNameNorm = (selectedCustomer.name || "").toLowerCase().trim();
                      const saleNameNorm = (s.customer?.name || "").toLowerCase().trim();

                      const customerEmailNorm = (selectedCustomer.email || "").toLowerCase().trim();
                      const saleEmailNorm = (s.customer?.email || "").toLowerCase().trim();

                      return (
                        (customerPhoneNorm && customerPhoneNorm === salePhoneNorm) ||
                        (customerNameNorm && customerNameNorm === saleNameNorm) ||
                        (customerEmailNorm && saleEmailNorm && customerEmailNorm === saleEmailNorm)
                      );
                    });

                    if (matchedSales.length === 0) {
                      return (
                        <div className={`p-8 text-center italic border rounded-xl ${
                          isIpsHighContrast ? "bg-neutral-50 border-neutral-200 text-neutral-400" : "bg-[#0b0b0d] border-neutral-850 text-gray-500"
                        }`}>
                          No previous transaction receipts found for this contact. Receipts are logged automatically under client details upon POS Cart Checkout orders.
                        </div>
                      );
                    }

                    return matchedSales.map((invoice) => {
                      const isSelected = selectedInvoice && selectedInvoice.id === invoice.id;
                      return (
                        <div
                          key={invoice.id}
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setDispatchStatus("idle");
                          }}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#dfb76c]/10 border-[#dfb76c] text-[#dfb76c]"
                              : isIpsHighContrast
                              ? "bg-neutral-50 border-neutral-200 hover:bg-neutral-100 text-neutral-800"
                              : "bg-[#0b0b0d] border-neutral-850 hover:bg-neutral-900 text-gray-300"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold uppercase tracking-wider">
                              {invoice.id}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {invoice.timestamp ? new Date(invoice.timestamp).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <div className={`text-[10px] mt-1.5 truncate max-w-[320px] ${
                            isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                          }`}>
                            {invoice.items && invoice.items.length > 0
                              ? invoice.items.map((it: any) => `${it.name} (x${it.qty})`).join(", ")
                              : "Bespoke tailoring order."}
                          </div>
                          <div className={`flex justify-between items-center mt-2.5 pt-2.5 border-t ${
                            isIpsHighContrast ? "border-neutral-150" : "border-neutral-800/45"
                          }`}>
                            <span className="text-[10px] text-gray-500">Salesperson: {invoice.salesperson || "Cashier"}</span>
                            <span className="font-bold text-[#dfb76c]">£{(invoice.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Column: Receipt View & Dispatch Options */}
              <div className="space-y-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${
                  isIpsHighContrast ? "text-neutral-600" : "text-gray-400"
                }`}>
                  Bespoke Interactive Digital Receipt
                </span>

                {selectedInvoice ? (
                  <div className="space-y-4">
                    {/* Visual Receipt View Box */}
                    <div className="bg-[#030304] border border-neutral-850 rounded-xl p-4 font-mono text-[9.5px] leading-relaxed text-gray-300 overflow-x-auto select-all max-h-[300px]">
                      {(() => {
                        const itemsListText = selectedInvoice.items && selectedInvoice.items.length > 0
                          ? selectedInvoice.items.map((item: any) => `• ${item.name} (Qty:${item.qty}, Size:${item.size || "Standard"}, Col:${item.colour || "Default"})`).join("\n")
                          : "No items listed.";

                        return `----------------------------------
★ SUIT PRO LONDON SHOWROOM ★
Premium Bespoke Tailoring & Apparel
----------------------------------
Invoice ID: ${selectedInvoice.id || "INV-DRAFT"}
Date: ${selectedInvoice.timestamp ? new Date(selectedInvoice.timestamp).toLocaleString() : new Date().toLocaleString()}
Salesperson: ${selectedInvoice.salesperson || "Cashier"}
----------------------------------
Items Purchased:
${itemsListText}
----------------------------------
Subtotal: £${(selectedInvoice.subtotal || 0).toFixed(2)}
VAT (20%): £${(selectedInvoice.vat || 0).toFixed(2)}
TOTAL PAID: £${(selectedInvoice.total || 0).toFixed(2)}
----------------------------------
Thank you for choosing Suit Pro London!
Bespoke fits & tailored excellence.
==================================`;
                      })()}
                    </div>

                    {/* Dispatch Options Row */}
                    <div className="space-y-2">
                      <span className={`text-[9px] uppercase font-bold tracking-wider block ${
                        isIpsHighContrast ? "text-neutral-500" : "text-gray-500"
                      }`}>
                        Dispatch Digital Invoice Channel
                      </span>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <button
                          type="button"
                          onClick={() => handleRedispatchReceipt(selectedInvoice, selectedCustomer, "whatsapp")}
                          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-neutral-850 bg-[#060608] hover:bg-emerald-950/20 hover:border-emerald-500/50 text-emerald-400 cursor-pointer font-bold font-mono transition-all text-[10px] uppercase tracking-wider"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Send via WhatsApp
                        </button>

                        <button
                          type="button"
                          disabled={!selectedCustomer.email}
                          onClick={() => handleRedispatchReceipt(selectedInvoice, selectedCustomer, "email")}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold font-mono transition-all text-[10px] uppercase tracking-wider ${
                            !selectedCustomer.email
                              ? "opacity-35 cursor-not-allowed border-neutral-850 bg-neutral-900/10 text-gray-500"
                              : "border-neutral-850 bg-[#060608] hover:bg-sky-950/20 hover:border-sky-500/50 text-sky-400 cursor-pointer"
                          }`}
                        >
                          <Mail className="w-4 h-4" />
                          Send via Email
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => printPremiumReceiptPDF(selectedInvoice, selectedCustomer)}
                        className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border font-bold font-mono transition-all text-[10px] uppercase tracking-wider mt-2 ${
                          isIpsHighContrast
                            ? "bg-[#b89047] hover:bg-[#a57f3c] border-[#b89047] text-white cursor-pointer"
                            : "bg-[#dfb76c] hover:bg-[#cfab60] border-transparent text-black cursor-pointer"
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        Download PDF / Print Receipt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`border border-dashed rounded-xl py-24 text-center italic ${
                    isIpsHighContrast ? "bg-neutral-50 border-neutral-250 text-neutral-400" : "border-neutral-850 text-gray-500"
                  }`}>
                    Select an archived purchase invoice from the left panel to review layout, download a receipt file copy, or launch messaging dispatchers.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
        </>
      )}

      {/* SUBTAB CONTENT 3: INVOICE CUSTOMIZATION & VAT CONFIGS */}
      {activeSubTab === "receipts" && (
        <div className={`border rounded-2xl p-6 space-y-6 ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border border-neutral-800/60"
        }`}>
          <div className={`flex justify-between items-center border-b pb-3 ${
            isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
          }`}>
            <div className="flex items-center gap-2">
              <Sliders className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
              }`}>
                Invoice Branding & Thermal Print Rules
              </h4>
            </div>
            {configSuccess && (
              <div className="text-emerald-400 font-mono text-[10px] bg-emerald-950/20 px-3 py-1 border border-emerald-500/30 rounded-lg flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {configSuccess}
              </div>
            )}
          </div>

          <p className={`text-[11px] leading-relaxed font-mono uppercase tracking-wide ${
            isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
          }`}>
            Set default greetings, dynamic pricing rules, and thermal print dimensions to prevent line overlaps or wrapping awkwardness on 58mm/80mm receipt streams.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs text-left">
            
            {/* Fields Column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>Receipt Top Lettering / Header</label>
                <textarea
                  value={config.headerGreetings}
                  onChange={(e) => setConfig({ ...config, headerGreetings: e.target.value.toUpperCase() })}
                  rows={2}
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs text-left uppercase ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>Receipt Base Lettering / Footer</label>
                <textarea
                  value={config.footerGreetings}
                  onChange={(e) => setConfig({ ...config, footerGreetings: e.target.value.toUpperCase() })}
                  rows={2}
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs text-left uppercase ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className={`block uppercase tracking-wider font-bold text-[9px] ${
                  isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                }`}>UK standard VAT Rate Base (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config.vatStandardRate}
                    onChange={(e) => {
                      const next = { ...config, vatStandardRate: Number(e.target.value || 0) };
                      setConfig(next);
                      saveSystemConfig(next);
                    }}
                    className={`w-32 rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs text-left ${
                      isIpsHighContrast 
                        ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-[#b89047]" 
                        : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                    }`}
                  />
                  <div className={`flex items-center text-[10px] italic ${
                    isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                  }`}>
                    (Standard UK VAT is 20%. Change only for legal retail exemptions).
                  </div>
                </div>
              </div>
            </div>

            {/* Layout Toggles Column */}
            <div className={`p-4 border rounded-xl space-y-4 font-mono ${
              isIpsHighContrast ? "bg-neutral-50 border-neutral-250" : "bg-black/20 border-neutral-850"
            }`}>
              <span className={`text-[10px] block font-bold uppercase tracking-widest border-b pb-2 ${
                isIpsHighContrast ? "text-[#b89047] border-neutral-200" : "text-[#dfb76c] border-neutral-850"
              }`}>Active Field Layout Toggles</span>
              
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className={`block font-bold ${isIpsHighContrast ? "text-neutral-850" : "text-white"}`}>Tax/VAT Summary Area</span>
                  <span className={`text-[10px] ${isIpsHighContrast ? "text-neutral-500" : "text-gray-500"}`}>Provide VAT Category items division on receipt slips</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.showTaxBreakdown}
                  onChange={(e) => setConfig({ ...config, showTaxBreakdown: e.target.checked })}
                  className="w-4 h-4 accent-[#dfb76c] cursor-pointer"
                />
              </div>

              <div className={`flex items-center justify-between gap-4 border-t pt-3 ${
                isIpsHighContrast ? "border-neutral-200" : "border-neutral-850"
              }`}>
                <div>
                  <span className={`block font-bold ${isIpsHighContrast ? "text-neutral-850" : "text-white"}`}>Display Salesperson / Cashier Name</span>
                  <span className={`text-[10px] ${isIpsHighContrast ? "text-neutral-500" : "text-gray-500"}`}>Print the name of authorized counter salesperson</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.showSalesperson}
                  onChange={(e) => setConfig({ ...config, showSalesperson: e.target.checked })}
                  className="w-4 h-4 accent-[#dfb76c] cursor-pointer"
                />
              </div>

              <div className={`flex items-center justify-between gap-4 border-t pt-3 ${
                isIpsHighContrast ? "border-neutral-200" : "border-neutral-850"
              }`}>
                <div>
                  <span className={`block font-bold ${isIpsHighContrast ? "text-neutral-850" : "text-white"}`}>Print Garment Size & Colors</span>
                  <span className={`text-[10px] ${isIpsHighContrast ? "text-neutral-500" : "text-gray-500"}`}>Enable size, color, and textile specs on thermal streams</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.showSizeColor}
                  onChange={(e) => setConfig({ ...config, showSizeColor: e.target.checked })}
                  className="w-4 h-4 accent-[#dfb76c] cursor-pointer"
                />
              </div>
            </div>

          </div>

          <div className={`pt-4 border-t flex justify-end ${
            isIpsHighContrast ? "border-neutral-200" : "border-neutral-850"
          }`}>
            <button
              type="button"
              onClick={handleSaveConfig}
              className={`font-bold uppercase text-[10px] py-2.5 px-6 rounded-lg tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors ${
                isIpsHighContrast 
                  ? "bg-[#b89047] hover:bg-[#a67f3c] text-white" 
                  : "bg-[#dfb76c] hover:bg-[#ebd097] text-black"
              }`}
            >
              {loadingConfig && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Active Settings
            </button>
          </div>

          {/* MASTER SYSTEM RESET SECTION */}
          <div className="mt-8 bg-red-950/10 border border-red-500/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-red-500/20 pb-3">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-widest text-rose-500">
                Enterprise Disaster Recovery Master Reset
              </h4>
            </div>
            
            <p className="text-[11px] text-gray-400 leading-relaxed font-mono uppercase tracking-wide text-left">
              WARNING: Executing a master reset will permanently delete all sales ledgers, customer receipts, expense entries, custom employee accounts, and revert inventory products to initial factory settings. This operation is irreversible.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-lg">
              <div className="space-y-1.5 flex-1 font-mono text-xs text-left">
                <label className="text-gray-400 block uppercase tracking-wider font-bold text-[9px]">Administrative Verification Key</label>
                <input
                  type="password"
                  placeholder="Enter authorized administrative verification key"
                  value={resetSecurityKey}
                  onChange={(e) => setResetSecurityKey(e.target.value)}
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs text-left ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-800 focus:border-rose-500" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-rose-500 text-white"
                  }`}
                />
              </div>
              
              <button
                type="button"
                onClick={handleSystemReset}
                disabled={isResetting}
                className="bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-bold uppercase text-[10px] py-2.5 px-6 rounded-lg tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                {isResetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                All System Reset
              </button>
            </div>

            {resetError && (
              <div className="text-rose-400 font-mono text-[10px] bg-rose-950/20 px-3 py-2 border border-rose-500/30 rounded-lg max-w-md animate-fade-in text-left">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="text-emerald-400 font-mono text-[10px] bg-[#122c1e]/40 px-3 py-2 border border-emerald-500/30 rounded-lg max-w-md animate-fade-in text-left">
                {resetSuccess}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
