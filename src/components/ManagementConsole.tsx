import React, { useState, useEffect } from "react";
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
  Clock
} from "lucide-react";
import EmployeeTimeCard from "./EmployeeTimeCard";

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
  const [activeSubTab, setActiveSubTab] = useState<"employees" | "devices" | "receipts" | "timecards">("employees");
  
  // Employees State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Manager" | "Cashier">("Cashier");
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
  }, []);

  // Periodic device poller
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDevices();
    }, 8000);
    return () => clearInterval(timer);
  }, []);

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

  // Add user account
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

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
    if (id === "user-owner-rumel") {
      setUserError("The System Owner profile cannot be removed.");
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
        <div className="flex bg-[#121217] border border-neutral-800/80 rounded-xl p-1.5 shrink-0 select-none gap-1">
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
            onClick={() => setActiveSubTab("timecards")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors duration-250 cursor-pointer flex items-center gap-1 ${
              activeSubTab === "timecards"
                ? "bg-[#dfb76c] text-black font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Clock className="w-3 h-3" />
            Time Cards
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("devices")}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-colors duration-250 cursor-pointer ${
              activeSubTab === "devices"
                ? "bg-[#dfb76c] text-black font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Live Hardware Tracker
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
            <div className={`flex items-center gap-2 border-b pb-3 ${
              isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
            }`}>
              <UserPlus className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
              }`}>
                Create Employee Profile
              </h4>
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

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-mono">
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
                  placeholder="e.g. richard_tailor"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
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
                  Passcode / Password
                </label>
                <input
                  type="password"
                  placeholder="e.g. 123456"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                  System Privilege Level (RBAC)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "Manager" | "Cashier")}
                  className={`w-full rounded-lg py-2 px-3 focus:outline-none focus:ring-0 text-xs ${
                    isIpsHighContrast 
                      ? "bg-neutral-50 border border-neutral-250 text-neutral-850 focus:border-[#b89047]" 
                      : "bg-[#0b0b0d] border border-neutral-800 focus:border-[#dfb76c] text-white"
                  }`}
                >
                  <option value="Manager">Manager Role</option>
                  <option value="Cashier">Cashier Role</option>
                </select>
              </div>

              <button
                type="submit"
                className={`w-full font-bold py-2.5 rounded-lg uppercase tracking-wider text-[10px] mt-2 transition-colors cursor-pointer text-center ${
                  isIpsHighContrast 
                    ? "bg-[#b89047] hover:bg-[#a67f3c] text-white" 
                    : "bg-[#dfb76c] hover:bg-[#edd19b] text-black"
                }`}
              >
                Onboard Employee
              </button>
            </form>
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
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(usr.id, usr.name)}
                            className="text-rose-500 hover:text-rose-400 p-1 cursor-pointer transition-colors inline-block"
                            title="Remove employee profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* SUBTAB CONTENT 2: REAL-TIME HARDWARE NETWORK SOCKET TRACKER */}
      {activeSubTab === "devices" && (
        <div className={`border rounded-2xl p-6 space-y-5 text-mono text-xs ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border border-neutral-800/60"
        }`}>
          <div className={`flex justify-between items-center border-b pb-3 ${
            isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/40"
          }`}>
            <div className="flex items-center gap-2">
              <Monitor className={`w-4 h-4 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              <h4 className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"
              }`}>
                Live Connected Hardware Registry
              </h4>
            </div>
            <button
              type="button"
              onClick={fetchDevices}
              className={`transition-all font-mono text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer ${
                isIpsHighContrast ? "text-neutral-500 hover:text-neutral-850" : "text-gray-400 hover:text-white"
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${loadingDevices ? "animate-spin" : ""}`} />
              Scan Port LAN Addresses
            </button>
          </div>

          <p className={`text-[11px] leading-relaxed uppercase tracking-wide ${
            isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
          }`}>
            The tracker service intercepts connection handshakes and maps counter PCs, smartphones, and tablet touchpads on the active boutique Wi-Fi network. Supports 58mm & 80mm remote thermal printers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
            {devices.map((dev) => (
              <div 
                key={dev.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all duration-300 ${
                  dev.status === "Active"
                    ? isIpsHighContrast
                      ? "bg-emerald-50/35 border-emerald-300 shadow-sm"
                      : "bg-slate-950/40 border-emerald-500/20 shadow-sm shadow-emerald-500/5"
                    : isIpsHighContrast
                      ? "bg-neutral-50/70 border-neutral-200 opacity-80"
                      : "bg-[#121217]/60 border-neutral-800/60 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${
                      dev.status === "Active" 
                        ? isIpsHighContrast
                          ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                          : "bg-emerald-950/20 border-emerald-500/35 text-emerald-400" 
                        : isIpsHighContrast
                          ? "bg-neutral-100 border-neutral-300 text-neutral-500"
                          : "bg-neutral-900 border-neutral-850 text-neutral-500"
                    }`}>
                      {dev.type === "Desktop POS" && <Monitor className="w-4 h-4" />}
                      {dev.type === "Tablet" && <Tablet className="w-4 h-4" />}
                      {dev.type === "Mobile POS" && <Smartphone className="w-4 h-4" />}
                      {dev.type === "Unknown" && <HelpCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className={`font-bold text-xs block truncate max-w-[130px] ${
                        isIpsHighContrast ? "text-neutral-900" : "text-white"
                      }`}>{dev.id}</span>
                      <span className={`text-[9px] block uppercase font-bold tracking-widest mt-0.5 ${
                        isIpsHighContrast ? "text-neutral-500" : "text-gray-400"
                      }`}>{dev.type}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                    dev.status === "Active" 
                      ? isIpsHighContrast
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : isIpsHighContrast
                        ? "bg-neutral-100 border-neutral-200 text-neutral-550"
                        : "bg-neutral-800 border-neutral-750 text-neutral-500 animate-pulse"
                  }`}>
                    {dev.status}
                  </span>
                </div>

                <div className={`space-y-1 p-2.5 rounded-lg text-[10px] ${
                  isIpsHighContrast ? "bg-neutral-100/60 text-neutral-600" : "bg-black/30 text-gray-400"
                }`}>
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span className={`font-bold ${isIpsHighContrast ? "text-neutral-850" : "text-white"}`}>{dev.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session OS:</span>
                    <span className={`font-bold truncate max-w-[120px] ${isIpsHighContrast ? "text-neutral-850" : "text-white"}`}>{dev.os}</span>
                  </div>
                  <div className={`flex justify-between pt-1 mt-1 border-t ${
                    isIpsHighContrast ? "border-neutral-200" : "border-neutral-800/50"
                  }`}>
                    <span>Last heartbeat:</span>
                    <span>{new Date(dev.lastActive).toLocaleTimeString("en-GB")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                    onChange={(e) => setConfig({ ...config, vatStandardRate: Number(e.target.value || 0) })}
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

      {/* SUBTAB CONTENT 4: EMPLOYEE TIME CARDS */}
      {activeSubTab === "timecards" && (
        <div className={`border rounded-2xl p-6 ${
          isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121217]/50 border border-neutral-800/60"
        }`}>
          <EmployeeTimeCard isIpsHighContrast={isIpsHighContrast} />
        </div>
      )}

    </div>
  );
}
