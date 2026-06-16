interface ReceiptData {
  headerGreetings: string;
  items: Array<{ name: string; qty: number; price: number; size?: string; colour?: string }>;
  subtotal: number;
  vat: number;
  total: number;
  profit?: number;
  timestamp: string;
  invoiceId: string;
  salesperson: string;
  paymentMethod: string;
}

export class ThermalPrinterService {
  private printerType: "usb" | "network" | "bluetooth" | "browser" = "browser";
  private serialPort: any = null; // Web Serial API port

  async initialize(): Promise<boolean> {
    try {
      // Check with backend server for printer availability
      const response = await fetch("/api/printer/check", { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        const qucomPrinter = data.printers?.find((p: any) => p.id === "qucom-btd-1");
        
        if (qucomPrinter) {
          this.printerType = "bluetooth";
          console.log("[SUIT PRO Printer] Qucom BTD thermal printer detected");
          
          // Try to connect via Web Serial API if available
          if ("serial" in navigator) {
            try {
              const ports = await (navigator as any).serial.getPorts();
              if (ports.length > 0) {
                const port = ports[0];
                if (!port.readable || !port.writable) {
                  await port.open({ baudRate: 9600 }); // Qucom BTD default baud rate
                }
                this.serialPort = port;
                console.log("[SUIT PRO Printer] Web Serial connection established to Qucom BTD");
              }
            } catch (serialErr) {
              console.warn("[SUIT PRO Printer] Web Serial connection failed, using backend:", serialErr);
            }
          }
        }
        
        return data.available ?? false;
      }
      return false;
    } catch (error) {
      console.error("[SUIT PRO Printer] Initialization error:", error);
      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check printer health with backend server
      const response = await fetch("/api/printer/health", { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        return data.healthy ?? false;
      }
      return false;
    } catch (error) {
      console.log("[SUIT PRO Printer] Health check failed");
      return false;
    }
  }

  async printReceipt(receipt: ReceiptData): Promise<boolean> {
    try {
      // Format receipt for thermal printer
      const receiptText = this.formatReceipt(receipt);

      // Try Web Serial API first (direct Bluetooth connection)
      if (this.serialPort && "serial" in navigator) {
        try {
          const success = await this.printViaSerialPort(receiptText);
          if (success) {
            console.log("[SUIT PRO Printer] Thermal print successful via Web Serial");
            return true;
          }
        } catch (serialErr) {
          console.warn("[SUIT PRO Printer] Web Serial print failed, falling back to backend:", serialErr);
        }
      }

      // Try backend thermal printer next
      const response = await fetch("/api/printer/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt, receiptText }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log("[SUIT PRO Printer] Thermal print successful via backend");
          return true;
        } else if (result.fallback === "browser") {
          console.log("[SUIT PRO Printer] Backend indicated fallback to browser print");
        }
      }

      // Fallback to browser print
      return this.printViaBrowser(receiptText);
    } catch (error) {
      console.error("[SUIT PRO Printer] Print error:", error);
      this.saveOfflineReceipt(receipt);
      return false;
    }
  }

  private async printViaSerialPort(receiptText: string): Promise<boolean> {
    if (!this.serialPort || !this.serialPort.writable) {
      return false;
    }

    try {
      const writer = this.serialPort.writable.getWriter();
      try {
        // Format for Qucom BTD (ESC/POS protocol)
        const escposData = this.formatEscposReceipt(receiptText);
        await writer.write(escposData);
        
        // Give printer time to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("[SUIT PRO Printer] Successfully sent receipt to Qucom BTD via Web Serial");
        return true;
      } finally {
        writer.releaseLock();
      }
    } catch (err) {
      console.error("[SUIT PRO Printer] Web Serial write error:", err);
      return false;
    }
  }

  private printViaBrowser(receiptText: string): boolean {
    try {
      const printWindow = window.open("", "", "width=400,height=600");
      if (printWindow) {
        printWindow.document.write(
          `<pre style="font-family: monospace; font-size: 12px; padding: 20px;">${receiptText}</pre>`
        );
        printWindow.document.close();
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
        console.log("[SUIT PRO Printer] Receipt printed via browser");
        return true;
      }
      return false;
    } catch (err) {
      console.error("[SUIT PRO Printer] Browser print error:", err);
      return false;
    }
  }

  private formatEscposReceipt(receiptText: string): Uint8Array {
    // ESC/POS control codes for thermal printer
    const ESC = 0x1B;
    const GS = 0x1D;
    
    const commands: number[] = [];
    
    // Initialize printer
    commands.push(ESC, 64); // '@' - Reset
    
    // Text encoding to UTF-8
    const textBytes = new TextEncoder().encode(receiptText);
    commands.push(...textBytes);
    
    // Line feed and cut
    commands.push(10); // Line feed
    commands.push(10);
    commands.push(GS, 86, 66, 0); // Partial cut
    
    return new Uint8Array(commands);
  }

  private formatReceipt(receipt: ReceiptData): string {
    let text = "================================\n";
    text += receipt.headerGreetings + "\n";
    text += "================================\n\n";

    text += "Items:\n";
    receipt.items.forEach((item) => {
      text += `${item.name} x${item.qty} @ £${item.price.toFixed(2)}\n`;
      if (item.size) text += `  Size: ${item.size}\n`;
      if (item.colour) text += `  Colour: ${item.colour}\n`;
    });

    text += "\n--------------------------------\n";
    text += `Subtotal: £${receipt.subtotal.toFixed(2)}\n`;
    text += `VAT (20%): £${receipt.vat.toFixed(2)}\n`;
    text += `TOTAL: £${receipt.total.toFixed(2)}\n`;
    if (receipt.profit) text += `Profit: £${receipt.profit.toFixed(2)}\n`;
    text += `\nSalesperson: ${receipt.salesperson}\n`;
    text += `Payment: ${receipt.paymentMethod}\n`;
    text += `Time: ${receipt.timestamp}\n`;
    text += `Invoice: ${receipt.invoiceId}\n`;
    text += "================================\n";

    return text;
  }

  private saveOfflineReceipt(receipt: ReceiptData): void {
    try {
      // Save to localStorage for browser-based offline support
      const key = `offline_receipt_${receipt.invoiceId}_${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(receipt));
      console.log(`[SUIT PRO Printer] Offline receipt saved to localStorage: ${key}`);
    } catch (error) {
      console.error("[SUIT PRO Printer] Failed to save offline receipt:", error);
    }
  }
}

// Singleton instance
let printerServiceInstance: ThermalPrinterService | null = null;

export function getPrinterService(): ThermalPrinterService {
  if (!printerServiceInstance) {
    printerServiceInstance = new ThermalPrinterService();
  }
  return printerServiceInstance;
}
