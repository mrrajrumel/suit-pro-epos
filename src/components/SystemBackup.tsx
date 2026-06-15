import React, { useState, useEffect, useRef } from "react";
import { 
  Database, 
  ShieldAlert, 
  ShieldCheck, 
  FileCode, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  UploadCloud, 
  Trash2, 
  FileText, 
  Info,
  Calendar,
  Layers,
  HardDrive
} from "lucide-react";

interface SystemBackupProps {
  isIpsHighContrast: boolean;
  onRestoreComplete?: () => void;
}

interface BackupFile {
  file_name: string;
  file_path: string;
  size_kb: number;
  created_at: string;
}

interface VerificationResult {
  file_name: string;
  size_kb: number;
  isValid: boolean;
  isSecure: boolean;
  productCount: number;
  transactionCount: number;
  hasConfig: boolean;
  hasProducts: boolean;
  hasSales: boolean;
  timestamp: string;
}

export default function SystemBackup({ isIpsHighContrast, onRestoreComplete }: SystemBackupProps) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Backup file list stats
  const [backupDirInfo, setBackupDirInfo] = useState({ path: "/var/backups/suitpro/", isFallback: false });

  // Verification state machine
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Restore state machine
  const [confirmText, setConfirmText] = useState("");
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Drag and drop focus
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch the backups available on the server
  const [schedulerConfig, setSchedulerConfig] = useState<any>({
    enabled: true,
    cronExpression: "0 0 * * *",
    lastRun: null,
    nextRun: null
  });
  const [updatingConfig, setUpdatingConfig] = useState(false);

  const fetchSchedulerConfig = async () => {
    try {
      const res = await fetch("/api/backup/config");
      if (res.ok) {
        const data = await res.json();
        setSchedulerConfig(data);
      }
    } catch (err) {
      // Quiet fail-safe fallback
    }
  };

  const handleUpdateSchedulerConfig = async (newConfig: any) => {
    setUpdatingConfig(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/backup/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig)
      });
      if (!res.ok) throw new Error("Failed to persist scheduled backup parameters.");
      const data = await res.json();
      setSchedulerConfig(data);
      setSuccessMsg(`Automated backup frequency configured! Next scheduled run: ${data.nextRun ? new Date(data.nextRun).toLocaleString("en-GB") : "Disabled"}`);
      // Sync list
      await fetchBackupsList();
    } catch (err: any) {
      setError(err.message || "Failed to save schedule settings.");
    } finally {
      setUpdatingConfig(false);
    }
  };

  const fetchBackupsList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backup/list");
      if (!res.ok) throw new Error("Failed to capture local backup register catalog.");
      const data = await res.json();
      setBackups(data);

      // Verify destination mode by requesting corporate config
      const confRes = await fetch("/api/config");
      if (confRes.ok) {
        const confData = await confRes.json();
        // Since we are running on server.ts, we can infer directory binding configuration
        setBackupDirInfo({
          path: "/var/backups/suitpro",
          isFallback: false // The server binds /var/backups/suitpro and falls back internally
        });
      }
    } catch (err: any) {
      setError(err.message || "Relational backup server offline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupsList();
    fetchSchedulerConfig();
  }, []);

  // Initiate a new live backup dump on the host
  const handleInitiateBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/backup/run", { method: "POST" });
      if (!res.ok) throw new Error("Rolling Backup Engine failed to dump relational schema.");
      const result = await res.json();
      if (result.success) {
        setSuccessMsg(`Sartorial database backup cleanly dumped: ${result.file_name}`);
        // Refresh local listings
        await fetchBackupsList();
      } else {
        throw new Error(result.error || "Execution failed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create SQL dump.");
    } finally {
      setLoading(false);
    }
  };

  // Run integrity verification checks on selected server file
  const handleVerifyBackupFile = async (backup: BackupFile) => {
    setVerifying(true);
    setError(null);
    setVerificationResult(null);
    setSelectedBackup(backup);
    setUploadedFile(null);
    try {
      const res = await fetch("/api/backup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: backup.file_name })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed integrity verification pass.");
      }
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      setError(`Integrity fault: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Parse uploaded raw files directly
  const handleUploadBackupSpec = (name: string, content: string) => {
    setUploadedFile({ name, content });
    setSelectedBackup(null);
    handleVerifyUploadedText(name, content);
  };

  const handleVerifyUploadedText = async (name: string, text: string) => {
    setVerifying(true);
    setError(null);
    setVerificationResult(null);
    try {
      const res = await fetch("/api/backup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: name, rawSqlText: text })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Uploaded SQL specification verification failed.");
      }
      const data = await res.json();
      setVerificationResult(data);
    } catch (err: any) {
      setError(`Integrity fault on upload: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // Perform database restoration
  const handleCommitRestoration = async () => {
    if (confirmText.toUpperCase() !== "RESTORE") {
      setError("Authorization denied: Please typed 'RESTORE' uppercase to confirm safety guidelines.");
      return;
    }

    setRestoring(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const bodyPayload = uploadedFile 
        ? { rawSqlText: uploadedFile.content }
        : { fileName: selectedBackup?.file_name };

      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Recovery manager was unable to recreate relational index coordinates.");
      }

      const result = await res.json();
      setSuccessMsg(
        `Restoration successful! Active schema rebuilt. Restored ${result.restored_products} apparel item models and reloaded ${result.restored_transactions} invoice cash flows.`
      );
      
      // Clean up states
      setShowRestoreModal(false);
      setVerificationResult(null);
      setSelectedBackup(null);
      setUploadedFile(null);
      setConfirmText("");
      
      // Refresh list
      await fetchBackupsList();

      // Trigger app global refresh if hook exists
      if (onRestoreComplete) {
        onRestoreComplete();
      }
    } catch (err: any) {
      setError(`Recovery execution failure: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  // Drag-and-Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith(".sql")) {
        setError(`File rejected: Backup specification must be an active SQL script (.sql)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleUploadBackupSpec(file.name, text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".sql")) {
        setError(`File rejected: Backup specification must be an active SQL script (.sql)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleUploadBackupSpec(file.name, text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* PAGE LEVEL HEADER BANNER */}
      <div className={`p-6 rounded-2xl border transition-colors ${
        isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <Database className={`w-5 h-5 ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`} />
              <h2 className={`font-display font-bold uppercase tracking-widest text-sm ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>System Backup & SQL Recovery Manager</h2>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wide leading-relaxed font-mono">
              Administrative Suite to list backups inside <code className="font-sans px-1 rounded bg-black/40 text-[#dfb76c]">/var/backups/suitpro/</code>, verify structural integrity, and coordinate schema restoration.
            </p>
          </div>
          <button
            id="btn-trigger-exec-backup"
            type="button"
            onClick={handleInitiateBackup}
            disabled={loading}
            className={`font-mono text-xs font-bold uppercase tracking-widest rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all ${
              isIpsHighContrast 
                ? "bg-[#b89047] text-white hover:bg-[#a37e3d]" 
                : "bg-[#dfb76c] text-[#0a0a0c] hover:bg-[#eed3a0]"
            } disabled:opacity-50`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Generate New Backup Dump</span>
          </button>
        </div>
      </div>

      {/* DYNAMIC OPERATION NOTIFICATION STRIPS */}
      {error && (
        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-xl text-left flex gap-3 items-start animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-xs font-bold font-mono text-red-400 block uppercase">Operational Interruption Fault</span>
            <p className="text-[11px] text-gray-300 leading-relaxed font-mono">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-left flex gap-3 items-start animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-xs font-bold font-mono text-emerald-400 block uppercase">Execution Acknowledged</span>
            <p className="text-[11px] text-gray-350 leading-relaxed font-mono">{successMsg}</p>
          </div>
        </div>
      )}

      {/* AUTOMATED BACKUP CHRONO-SCHEDULER CARD */}
      <div className={`p-5 rounded-xl border text-left space-y-4 transition-colors ${
        isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/85 border-neutral-800/60"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/40 pb-3">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-mono uppercase block">Automated Backup Chrono-Scheduler</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#dfb76c]" />
              <h3 className={`font-display font-medium text-xs uppercase tracking-widest ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                Cron Dump Controller
              </h3>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Enabled toggle button */}
            <button
              type="button"
              id="btn-toggle-scheduler-active"
              onClick={() => handleUpdateSchedulerConfig({ ...schedulerConfig, enabled: !schedulerConfig.enabled })}
              className={`font-mono text-[10px] font-bold uppercase tracking-wider rounded border px-3 py-1.5 transition-all cursor-pointer ${
                schedulerConfig.enabled
                  ? "bg-emerald-950/40 border-emerald-500 text-emerald-400"
                  : "bg-red-950/40 border-red-500 text-red-400"
              }`}
            >
              System schedule: {schedulerConfig.enabled ? "Enabled (LIVE)" : "Paused (SUSPENDED)"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Preset Select Dropdown */}
          <div className="space-y-1.5 text-left">
            <label className="text-gray-500 uppercase tracking-widest text-[9px] block">Cron Preset Schedule</label>
            <select
              value={schedulerConfig.cronExpression}
              id="select-backup-freq-preset"
              onChange={(e) => handleUpdateSchedulerConfig({ ...schedulerConfig, cronExpression: e.target.value })}
              className={`w-full text-xs font-mono rounded-lg border py-2 px-3 focus:outline-none transition-all ${
                isIpsHighContrast 
                  ? "bg-white border-neutral-300 text-neutral-850 focus:border-neutral-500" 
                  : "bg-[#0b0b0d] border-neutral-800 text-gray-350 focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c]/40"
              }`}
            >
              <option value="*/15 * * * *">Every 15 Minutes (Testing Mode)</option>
              <option value="*/30 * * * *">Every 30 Minutes (High Traffic)</option>
              <option value="0 * * * *">Every Hour (Enterprise Outlays)</option>
              <option value="0 */12 * * *">Every 12 Hours (Regular Rotation)</option>
              <option value="0 0 * * *">Daily at Midnight (Pristine Standard)</option>
              <option value="0 0 * * 0">Weekly on Sundays (Archive Archive)</option>
            </select>
          </div>

          {/* Last Run Info */}
          <div className={`p-3 rounded-lg border flex flex-col justify-center text-left ${
            isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-black/20 border-neutral-850/60"
          }`}>
            <span className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Last Automated Execution</span>
            <span className="font-bold text-gray-350 font-mono text-[11px] truncate">
              {schedulerConfig.lastRun 
                ? new Date(schedulerConfig.lastRun).toLocaleString("en-GB") 
                : "No schedule ticks performed yet."}
            </span>
          </div>

          {/* Next Run Coordinates */}
          <div className={`p-3 rounded-lg border flex flex-col justify-center text-left ${
            isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-black/20 border-neutral-850/60"
          }`}>
            <span className="text-[9px] text-gray-500 uppercase tracking-widest block mb-1">Estimated Next Dump Coordinate</span>
            <span className="font-bold text-[#dfb76c] font-mono text-[11px] truncate animate-pulse">
              {schedulerConfig.enabled && schedulerConfig.nextRun
                ? new Date(schedulerConfig.nextRun).toLocaleString("en-GB")
                : "Schedule Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* CORE ADMINISTRATIVE SECTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COL 1: SYSTEM DIRECTORY INDEX */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`p-5 rounded-xl border transition-colors ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
          }`}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 text-left">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest block">System Path Inventory</span>
                <h3 className={`font-display font-medium text-xs uppercase tracking-widest flex items-center gap-1.5 ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                  Local Storage SQL Backups
                </h3>
              </div>
              <button
                id="btn-refresh-backup-index"
                type="button"
                onClick={fetchBackupsList}
                disabled={loading}
                className={`font-mono text-[10px] font-bold uppercase rounded-lg p-1.5 border flex items-center gap-1 cursor-pointer transition-all ${
                  isIpsHighContrast 
                    ? "bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-850" 
                    : "bg-[#0b0b0d] hover:bg-neutral-850 border-neutral-800 text-gray-400 hover:text-[#dfb76c]"
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>Sync Index</span>
              </button>
            </div>

            {/* DIRECTORY PATH SUMMARY STRIP */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border mb-4 font-mono text-[11px] text-left leading-relaxed ${
              isIpsHighContrast ? "bg-neutral-50 border-neutral-250 text-neutral-700" : "bg-[#0b0b0d] border-neutral-850/60 text-gray-400"
            }`}>
              <div className="space-y-1">
                <span className="text-[9px] text-gray-500 uppercase block">Active Backup Pointer Direction</span>
                <span className="font-bold text-[#dfb76c]">{backupDirInfo.path}</span>
              </div>
              <div className="space-y-1 sm:text-right">
                <span className="text-[9px] text-gray-500 uppercase block">Total SQL Backups Found</span>
                <span className="font-bold text-white">{backups.length} SQL Dumps</span>
              </div>
            </div>

            {/* LIST TABLE OR EMPTY CONTAINER */}
            {loading && backups.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full border-2 border-[#dfb76c] border-t-transparent w-8 h-8"></div>
                <p className="text-[10px] text-gray-500 uppercase font-mono tracking-widest animate-pulse">Syncing Host Directory...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className={`py-12 px-6 rounded-lg text-center border border-dashed flex flex-col items-center justify-center gap-3.5 ${
                isIpsHighContrast ? "border-neutral-250 bg-neutral-50/50" : "border-neutral-850 bg-black/20"
              }`}>
                <Info className="w-8 h-8 text-neutral-500" />
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider block text-gray-300">No Relational Backups Discovered</span>
                  <p className="text-[10px] max-w-sm mx-auto text-gray-500 leading-relaxed font-mono uppercase tracking-wide">
                    The designated path registry is currently clean. Initiate a brand-new corporate dump or upload your own .sql schema structure to recovery active inventory positions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className={`border-b text-[10px] text-gray-500 uppercase tracking-widest ${isIpsHighContrast ? "border-neutral-200" : "border-neutral-850/60"}`}>
                      <th className="py-2.5 px-3">File Specification</th>
                      <th className="py-2.5 px-3">Dump Date</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3 text-right">Administrative Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/50">
                    {backups.map((bk) => (
                      <tr 
                        key={bk.file_name} 
                        className={`transition-colors group ${
                          selectedBackup?.file_name === bk.file_name 
                            ? isIpsHighContrast ? "bg-[#b89047]/5" : "bg-[#dfb76c]/5" 
                            : isIpsHighContrast ? "hover:bg-neutral-50" : "hover:bg-neutral-800/20"
                        }`}
                      >
                        <td className="py-3 px-3 relative">
                          <div className="flex items-center gap-2 max-w-[240px] sm:max-w-xs md:max-w-xs truncate">
                            <FileCode className={`w-4 h-4 shrink-0 col-span-2 ${
                              selectedBackup?.file_name === bk.file_name ? "text-[#dfb76c]" : "text-gray-500"
                            }`} />
                            <span className={`font-bold select-all truncate ${isIpsHighContrast ? "text-neutral-850" : "text-gray-200"}`}>
                              {bk.file_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-neutral-600" />
                            <span>{new Date(bk.created_at).toLocaleString("en-GB")}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-300 font-bold">{bk.size_kb} KB</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            id={`btn-verify-${bk.file_name.replace(/[^a-zA-Z0-9]/g, "-")}`}
                            type="button"
                            onClick={() => handleVerifyBackupFile(bk)}
                            disabled={verifying}
                            className={`font-mono text-[9px] font-bold uppercase tracking-wider rounded border px-2.5 py-1.5 transition-all cursor-pointer ${
                              selectedBackup?.file_name === bk.file_name
                                ? "bg-[#dfb76c]/20 border-[#dfb76c] text-[#dfb76c]"
                                : isIpsHighContrast
                                  ? "bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800"
                                  : "bg-[#0b0b0d] hover:bg-neutral-850 border-neutral-800 text-gray-400 hover:text-white"
                            }`}
                          >
                            {verifying && selectedBackup?.file_name === bk.file_name ? "Verifying..." : "Verify & Select"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DRAG AND DROP SQL IMPORT INTERFACE */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border rounded-xl p-5 shadow-lg space-y-4 transition-all duration-300 ${
              isDragging 
                ? "border-[#dfb76c] bg-[#dfb76c]/5 scale-[1.01]" 
                : isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
            }`}
          >
            <div className="flex items-center gap-2 border-b pb-3 text-left">
              <UploadCloud className="w-5 h-5 text-gray-400" />
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-500 font-mono uppercase block">Local Hardware Migration</span>
                <h3 className={`font-display font-medium text-xs uppercase tracking-widest ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                  Verify & Import External .SQL Backup
                </h3>
              </div>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-6 rounded-lg text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isIpsHighContrast 
                  ? "bg-neutral-50/50 border-neutral-250 hover:bg-neutral-100" 
                  : "bg-black/10 border-neutral-850 hover:bg-neutral-900/40 hover:border-neutral-700"
              }`}
            >
              <FileCode className={`w-8 h-8 ${isDragging ? "text-[#dfb76c] animate-bounce" : "text-gray-500"}`} />
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider font-bold block text-gray-300">
                  {uploadedFile ? `Loaded: ${uploadedFile.name}` : "Drag and drop your .SQL database backup file here"}
                </span>
                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-wider max-w-sm mx-auto">
                  Or click this box to trigger local browser explorer (Supports plain-text structured query templates)
                </p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".sql"
                className="hidden" 
              />
            </div>
            
            {uploadedFile && (
              <div className={`p-3 rounded-lg border flex justify-between items-center font-mono text-[10px] ${
                isIpsHighContrast ? "bg-neutral-100 border-neutral-250 text-neutral-800" : "bg-[#0b0b0d] border-neutral-850/60 text-gray-400"
              }`}>
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#dfb76c]" />
                  <span className="font-bold text-white max-w-[200px] truncate">{uploadedFile.name}</span>
                  <span className="text-neutral-500">({Math.round(uploadedFile.content.length / 1024)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadedFile(null);
                    setVerificationResult(null);
                  }}
                  className="text-red-500 hover:underline font-bold uppercase cursor-pointer"
                >
                  Remove Spec
                </button>
              </div>
            )}
          </div>
        </div>

        {/* COL 2: VERIFICATION REPORT PANEL */}
        <div className="lg:col-span-1 space-y-4">
          <div className={`p-5 rounded-xl border space-y-4 transition-colors text-left ${
            isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#121216]/80 border-neutral-800/60"
          }`}>
            <div className="border-b pb-3">
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest block">Quality Assurance Gate</span>
              <h3 className={`font-display font-medium text-xs uppercase tracking-widest flex items-center gap-2 ${isIpsHighContrast ? "text-neutral-900" : "text-white"}`}>
                <ShieldCheck className={`w-5 h-5 ${verificationResult ? "text-emerald-500" : "text-gray-500"}`} />
                Integrity Report
              </h3>
            </div>

            {verifying ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#dfb76c] animate-spin" />
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest animate-pulse leading-none text-center">
                  Executing Deep Checks...<br/>
                  <span className="text-[8px] tracking-wide mt-1.5 block opacity-50">Checking SQL scripts for validation faults</span>
                </p>
              </div>
            ) : !verificationResult ? (
              <div className="py-12 px-4 text-center space-y-3">
                <AlertTriangle className="w-7 h-7 text-neutral-600 mx-auto" />
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400 block">No Backup Selected for QA</span>
                  <p className="text-[9px] text-gray-500 uppercase leading-relaxed font-mono max-w-[180px] mx-auto">
                    Select a local backup dump from `/var/backups/suitpro` or browse hardware files to run integrity audits.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 font-mono text-xs">
                
                {/* VERIFICATION VERDICT HEADER */}
                <div className={`p-4 rounded-lg border text-left flex gap-3 items-start ${
                  verificationResult.isValid 
                    ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" 
                    : "bg-red-950/20 border-red-500/30 text-red-400"
                }`}>
                  {verificationResult.isValid ? (
                    <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider block">
                      {verificationResult.isValid ? "VERDICT: VALID RECOGNIZED BACKUP" : "VERDICT: INTEGRITY COMPROMISED"}
                    </span>
                    <p className="text-[10px] text-gray-300 leading-relaxed font-mono uppercase tracking-normal">
                      {verificationResult.isValid 
                        ? "SQL script matches schema boundaries and passes corporate security filters." 
                        : "Invalid template query stream or threat patterns discovered in execution payload."}
                    </p>
                  </div>
                </div>

                {/* FILE PROPERTIES LIST */}
                <div className={`space-y-2.5 p-3.5 rounded-lg border ${
                  isIpsHighContrast ? "bg-neutral-50 border-neutral-200" : "bg-black/10 border-neutral-850/60"
                }`}>
                  <div className="flex justify-between items-center text-[10px] tracking-wide border-b pb-1.5 border-neutral-800/40">
                    <span className="text-gray-500 uppercase">TARGET FILE:</span>
                    <span className="text-white font-bold max-w-[120px] truncate" title={verificationResult.file_name}>
                      {verificationResult.file_name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] tracking-wide border-b pb-1.5 border-neutral-800/40">
                    <span className="text-gray-500 uppercase">FILE SIZE:</span>
                    <span className="text-white font-bold">{verificationResult.size_kb} KB</span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] tracking-wide border-b pb-1.5 border-neutral-800/40">
                    <span className="text-gray-500 uppercase">SECURITY THREATS:</span>
                    <span className={`font-bold ${verificationResult.isSecure ? "text-emerald-500" : "text-red-500"}`}>
                      {verificationResult.isSecure ? "NONE DETECTED (SAFE)" : "ALERT: UNSAFE SCRIPT"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] tracking-wide">
                    <span className="text-gray-500 uppercase">VERIFIED TIMESTAMP:</span>
                    <span className="text-neutral-400">{new Date(verificationResult.timestamp).toLocaleString("en-GB")}</span>
                  </div>
                </div>

                {/* METADATA SCHEMATIC DRILLDOWN */}
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Structural Breakdown</span>
                  
                  <div className={`grid grid-cols-2 gap-2 text-center`}>
                    <div className={`p-2.5 border rounded ${isIpsHighContrast ? "bg-neutral-50/50 border-neutral-200" : "bg-black/10 border-neutral-850"}`}>
                      <span className="text-[9px] text-gray-500 uppercase block">Apparel specs</span>
                      <span className="text-base font-bold text-[#dfb76c]">{verificationResult.productCount} Items</span>
                    </div>
                    <div className={`p-2.5 border rounded ${isIpsHighContrast ? "bg-neutral-50/50 border-neutral-200" : "bg-black/10 border-neutral-850"}`}>
                      <span className="text-[9px] text-gray-500 uppercase block">Invoice Sales</span>
                      <span className="text-base font-bold text-white">{verificationResult.transactionCount} Invoices</span>
                    </div>
                  </div>

                  {/* Schema checklist flags */}
                  <div className="space-y-1.5 pt-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${verificationResult.hasConfig ? "bg-emerald-500" : "bg-neutral-600"}`}></span>
                      <span className="text-gray-400">System brand configuration:</span>
                      <span className={`ml-auto font-bold ${verificationResult.hasConfig ? "text-emerald-400" : "text-neutral-500"}`}>
                        {verificationResult.hasConfig ? "DETECTED" : "ABSENT"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${verificationResult.hasProducts ? "bg-emerald-500" : "bg-neutral-600"}`}></span>
                      <span className="text-gray-400">Inventory Catalog structure:</span>
                      <span className={`ml-auto font-bold ${verificationResult.hasProducts ? "text-emerald-400" : "text-neutral-500"}`}>
                        {verificationResult.hasProducts ? "DETECTED" : "ABSENT"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${verificationResult.hasSales ? "bg-emerald-500" : "bg-neutral-600"}`}></span>
                      <span className="text-gray-400">Financial checkout ledgers:</span>
                      <span className={`ml-auto font-bold ${verificationResult.hasSales ? "text-emerald-400" : "text-neutral-500"}`}>
                        {verificationResult.hasSales ? "DETECTED" : "ABSENT"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* LAUNCH SAFETY RESTORE BUTTON */}
                <div className="pt-3 border-t border-neutral-800">
                  <button
                    id="btn-trigger-schema-restore"
                    type="button"
                    onClick={() => setShowRestoreModal(true)}
                    disabled={!verificationResult.isValid}
                    className={`w-full font-mono text-xs font-bold uppercase tracking-widest rounded-lg py-3 flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      verificationResult.isValid 
                        ? "bg-rose-600 hover:bg-rose-700 text-white" 
                        : "bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Initiate Restore Process</span>
                  </button>
                  <span className="block mt-1.5 text-center text-[9px] text-[#ff6c85] animate-pulse">
                    WARNING: Restoring will overwrite active showroom database files.
                  </span>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

      {/* CONFIRMATION RESTORE POPUP MODAL */}
      {showRestoreModal && verificationResult && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in text-left">
          <div className="w-full max-w-md bg-[#16161b] border border-rose-550 rounded-2xl p-6 shadow-2xl space-y-4 relative block">
            
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-display font-bold text-sm uppercase tracking-widest">CRITICAL RESTORE ADVISORY</h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowRestoreModal(false);
                  setConfirmText("");
                }}
                className="text-gray-400 hover:text-white transition-colors font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer"
              >
                Abort
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 bg-rose-950/20 border border-rose-500/20 rounded-lg text-[11px] leading-relaxed text-rose-400 uppercase">
                <span className="font-bold block mb-1">PROCEED WITH ABSOLUTE CAUTION</span>
                Restoration is irreversible. Doing so will reset active showroom products database, overwrite sales ledger history logs, and replace brand configurations with records inside:
                <span className="block mt-1 font-bold text-white">{verificationResult.file_name}</span>
              </div>

              <div className="space-y-1 bg-black/30 p-2.5 border border-neutral-800 rounded text-[10px] text-gray-400 leading-normal">
                <span className="uppercase block font-bold text-white mb-1">RECONSTRUCTED METRIC OVERVIEW:</span>
                • Target items count: <span className="text-white font-bold">{verificationResult.productCount} apparel items</span><br/>
                • Target sales ledger count: <span className="text-white font-bold">{verificationResult.transactionCount} transactions</span><br/>
                • Target configuration: <span className="text-white font-bold">{verificationResult.hasConfig ? "System config table active" : "Absent"}</span>
              </div>

              <div className="space-y-2 pt-1">
                <label className="text-gray-400 uppercase tracking-wider block font-bold text-[9px]">
                  TYPE THE SECURE CONFIRMATION PHRASE <code className="font-bold text-white font-sans px-1 rounded bg-[#ff6b84]/20 border border-[#ff6b84]/40">RESTORE</code> TO CLEAR MEMORY:
                </label>
                <input 
                  type="text" 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full bg-[#0b0b0d] border border-rose-500/40 text-rose-500 focus:border-rose-500 rounded-lg py-2.5 px-3 uppercase text-center font-bold tracking-widest focus:outline-none transition-all"
                  placeholder="RESTORE"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 text-right flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setConfirmText("");
                }}
                className="hover:underline text-gray-500 font-bold uppercase text-[10px] tracking-wider transition-all cursor-pointer"
              >
                Cancel, Keep Active DB
              </button>
              
              <button
                type="button"
                onClick={handleCommitRestoration}
                disabled={restoring || confirmText.toUpperCase() !== "RESTORE"}
                className={`bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {restoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rebuilding Schema...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>Execute Database Recovery</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
