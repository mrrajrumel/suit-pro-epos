import React, { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, Coffee, AlertTriangle, CheckCircle, Trash2, Download } from "lucide-react";

interface TimeCardEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string;
  breakStart?: string;
  breakEnd?: string;
  status: "clocked-in" | "on-break" | "clocked-out";
  totalHours?: number;
  breakHours?: number;
  date: string;
}

interface EmployeeTimeCardProps {
  isIpsHighContrast?: boolean;
}

export default function EmployeeTimeCard({ isIpsHighContrast = false }: EmployeeTimeCardProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [timeCards, setTimeCards] = useState<TimeCardEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeCardEntry[]>([]);
  const [currentClockedIn, setCurrentClockedIn] = useState<TimeCardEntry | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<"clock" | "history" | "report">("clock");

  // Load employees and time card data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load employees from users endpoint
        const usersRes = await fetch("/api/users");
        const usersData = await usersRes.json();
        if (Array.isArray(usersData)) {
          setEmployees(usersData.filter((u: any) => u.role === "Cashier" || u.role === "Salesperson"));
        }

        // Load time cards from localStorage
        const savedCards = localStorage.getItem("suitpro_time_cards");
        if (savedCards) {
          const cards = JSON.parse(savedCards);
          setTimeCards(cards);

          // Check for currently clocked-in employee
          const today = new Date().toISOString().split("T")[0];
          const todayCards = cards.filter((c: TimeCardEntry) => c.date === today && c.status !== "clocked-out");
          setTodayEntries(todayCards);
          
          if (todayCards.length > 0) {
            setCurrentClockedIn(todayCards[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load time card data:", err);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Save time cards to localStorage
  const saveTimeCards = (cards: TimeCardEntry[]) => {
    localStorage.setItem("suitpro_time_cards", JSON.stringify(cards));
    setTimeCards(cards);
  };

  // Clock In
  const handleClockIn = () => {
    if (!selectedEmployee) {
      setErrorMsg("Please select an employee first");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (currentClockedIn) {
      setErrorMsg(`${currentClockedIn.employeeName} is already clocked in`);
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const employee = employees.find((e: any) => e.id === selectedEmployee);
    const newEntry: TimeCardEntry = {
      id: `TC-${Date.now()}`,
      employeeId: selectedEmployee,
      employeeName: employee?.name || employee?.username || "Unknown",
      clockInTime: new Date().toISOString(),
      status: "clocked-in",
      date: new Date().toISOString().split("T")[0],
    };

    const updatedCards = [...timeCards, newEntry];
    saveTimeCards(updatedCards);
    setCurrentClockedIn(newEntry);
    
    setSuccessMsg(`✓ ${newEntry.employeeName} clocked in at ${new Date().toLocaleTimeString()}`);
    setTimeout(() => setSuccessMsg(null), 3000);

    // Log to server
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "info",
        message: `Employee ${newEntry.employeeName} clocked in at ${new Date().toLocaleTimeString()}`,
      }),
    });
  };

  // Clock Out
  const handleClockOut = () => {
    if (!currentClockedIn) {
      setErrorMsg("No employee currently clocked in");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const updatedCards = timeCards.map((card) => {
      if (card.id === currentClockedIn.id) {
        const clockOutTime = new Date();
        const clockInTime = new Date(card.clockInTime);
        const breakHours = card.breakEnd && card.breakStart 
          ? (new Date(card.breakEnd).getTime() - new Date(card.breakStart).getTime()) / (1000 * 60 * 60)
          : 0;
        const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) - breakHours;

        return {
          ...card,
          clockOutTime: clockOutTime.toISOString(),
          status: "clocked-out" as const,
          totalHours: parseFloat(totalHours.toFixed(2)),
          breakHours: parseFloat(breakHours.toFixed(2)),
        };
      }
      return card;
    });

    saveTimeCards(updatedCards);
    
    const clockedOutCard = updatedCards.find((c) => c.id === currentClockedIn.id);
    setCurrentClockedIn(null);

    setSuccessMsg(
      `✓ ${clockedOutCard?.employeeName} clocked out. Total hours: ${clockedOutCard?.totalHours?.toFixed(2) || 0}`
    );
    setTimeout(() => setSuccessMsg(null), 3000);

    // Log to server
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "info",
        message: `Employee ${clockedOutCard?.employeeName} clocked out. Hours: ${clockedOutCard?.totalHours?.toFixed(2)}`,
      }),
    });
  };

  // Start Break
  const handleStartBreak = () => {
    if (!currentClockedIn) {
      setErrorMsg("No employee clocked in");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const updatedCards = timeCards.map((card) => {
      if (card.id === currentClockedIn.id && !card.breakStart) {
        return {
          ...card,
          breakStart: new Date().toISOString(),
          status: "on-break" as const,
        };
      }
      return card;
    });

    saveTimeCards(updatedCards);
    const breakCard = updatedCards.find((c) => c.id === currentClockedIn.id);
    setCurrentClockedIn(breakCard || null);

    setSuccessMsg(`☕ ${currentClockedIn.employeeName} started break`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // End Break
  const handleEndBreak = () => {
    if (!currentClockedIn || !currentClockedIn.breakStart || currentClockedIn.breakEnd) {
      setErrorMsg("No active break");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const updatedCards = timeCards.map((card) => {
      if (card.id === currentClockedIn.id) {
        return {
          ...card,
          breakEnd: new Date().toISOString(),
          status: "clocked-in" as const,
        };
      }
      return card;
    });

    saveTimeCards(updatedCards);
    const resumedCard = updatedCards.find((c) => c.id === currentClockedIn.id);
    setCurrentClockedIn(resumedCard || null);

    setSuccessMsg(`✓ ${currentClockedIn.employeeName} returned from break`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Delete Entry
  const handleDeleteEntry = (id: string) => {
    const updatedCards = timeCards.filter((c) => c.id !== id);
    saveTimeCards(updatedCards);
    if (currentClockedIn?.id === id) {
      setCurrentClockedIn(null);
    }
    setSuccessMsg("Time card entry deleted");
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Employee", "Date", "Clock In", "Clock Out", "Break Hours", "Total Hours"];
    const rows = timeCards
      .filter((c) => c.status === "clocked-out")
      .map((c) => [
        c.employeeName,
        c.date,
        new Date(c.clockInTime).toLocaleTimeString(),
        new Date(c.clockOutTime || "").toLocaleTimeString(),
        c.breakHours?.toFixed(2) || "0",
        c.totalHours?.toFixed(2) || "0",
      ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timecard-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate daily totals
  const getDailyTotals = () => {
    const today = new Date().toISOString().split("T")[0];
    const todayCards = timeCards.filter((c) => c.date === today && c.status === "clocked-out");
    
    const totalHours = todayCards.reduce((sum, c) => sum + (c.totalHours || 0), 0);
    const totalBreak = todayCards.reduce((sum, c) => sum + (c.breakHours || 0), 0);

    return { totalHours: totalHours.toFixed(2), totalBreak: totalBreak.toFixed(2), count: todayCards.length };
  };

  const dailyTotals = getDailyTotals();

  return (
    <div className={`space-y-6 animate-fade-in ${isIpsHighContrast ? "bg-white" : "bg-[#0b0b0d]"}`}>
      {/* HEADER */}
      <div className={`border rounded-2xl p-6 ${isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#18181f]/40 border-[#262633]/60"}`}>
        <div className="flex items-center gap-3 mb-4">
          <Clock className={isIpsHighContrast ? "text-[#b89047] w-6 h-6" : "text-[#dfb76c] w-6 h-6"} />
          <h2 className={`text-2xl font-display font-bold ${isIpsHighContrast ? "text-[#111116]" : "text-white"}`}>Employee Time Card System</h2>
        </div>

        {/* Status Alert */}
        {currentClockedIn && (
          <div className={`p-3 rounded-lg border ${isIpsHighContrast ? "bg-green-50 border-green-200 text-green-800" : "bg-emerald-900/20 border-emerald-500/30 text-emerald-300"}`}>
            <span className="font-semibold">✓ Currently Clocked In: </span>
            {currentClockedIn.employeeName} 
            {currentClockedIn.status === "on-break" && " (On Break)"}
            {currentClockedIn.breakStart && !currentClockedIn.breakEnd && " ☕ Break in progress"}
          </div>
        )}
      </div>

      {/* MESSAGES */}
      {successMsg && (
        <div className={`p-4 rounded-lg border flex items-center gap-2 ${isIpsHighContrast ? "bg-green-50 border-green-300 text-green-800" : "bg-emerald-900/30 border-emerald-500/50 text-emerald-300"}`}>
          <CheckCircle className="w-5 h-5" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className={`p-4 rounded-lg border flex items-center gap-2 ${isIpsHighContrast ? "bg-red-50 border-red-300 text-red-800" : "bg-red-900/30 border-red-500/50 text-red-300"}`}>
          <AlertTriangle className="w-5 h-5" />
          {errorMsg}
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 border-b">
        {(["clock", "history", "report"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`px-4 py-2 font-semibold capitalize transition-all ${
              view === tab
                ? isIpsHighContrast
                  ? "border-b-2 border-[#b89047] text-[#b89047]"
                  : "border-b-2 border-[#dfb76c] text-[#dfb76c]"
                : isIpsHighContrast
                ? "text-neutral-600 hover:text-neutral-800"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "clock" && "🕐 Clock In/Out"}
            {tab === "history" && "📋 History"}
            {tab === "report" && "📊 Report"}
          </button>
        ))}
      </div>

      {/* CLOCK IN/OUT VIEW */}
      {view === "clock" && (
        <div className={`border rounded-2xl p-6 space-y-4 ${isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#18181f]/40 border-[#262633]/60"}`}>
          <div className="space-y-3">
            <label className={`text-sm font-semibold ${isIpsHighContrast ? "text-[#111116]" : "text-gray-300"}`}>Select Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`w-full p-3 rounded-lg border font-semibold ${
                isIpsHighContrast
                  ? "bg-white border-neutral-300 text-[#111116] focus:border-[#b89047]"
                  : "bg-[#0b0b0d] border-[#262633]/60 text-[#dfb76c] focus:border-[#dfb76c]"
              } focus:outline-none`}
            >
              <option value="">-- Select Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name || emp.username}
                </option>
              ))}
            </select>
          </div>

          {/* Current Status */}
          {currentClockedIn && (
            <div className={`p-4 rounded-lg border ${isIpsHighContrast ? "bg-gray-50 border-neutral-200" : "bg-[#1a1a24] border-[#262633]"}`}>
              <p className={`text-sm font-semibold mb-2 ${isIpsHighContrast ? "text-[#111116]" : "text-gray-400"}`}>Current Session</p>
              <div className={`space-y-1 text-sm ${isIpsHighContrast ? "text-neutral-700" : "text-gray-300"} font-mono`}>
                <p>Clock In: {new Date(currentClockedIn.clockInTime).toLocaleTimeString()}</p>
                {currentClockedIn.breakStart && (
                  <p>Break: {new Date(currentClockedIn.breakStart).toLocaleTimeString()} - {currentClockedIn.breakEnd ? new Date(currentClockedIn.breakEnd).toLocaleTimeString() : "ongoing"}</p>
                )}
                <p>Elapsed: {((Date.now() - new Date(currentClockedIn.clockInTime).getTime()) / (1000 * 60 * 60)).toFixed(2)} hours</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleClockIn}
              disabled={!selectedEmployee || currentClockedIn !== null}
              className={`py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                !selectedEmployee || currentClockedIn !== null
                  ? isIpsHighContrast
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : isIpsHighContrast
                  ? "bg-green-500 text-white hover:bg-green-600 active:scale-95"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Clock In
            </button>

            <button
              onClick={handleClockOut}
              disabled={!currentClockedIn}
              className={`py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                !currentClockedIn
                  ? isIpsHighContrast
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : isIpsHighContrast
                  ? "bg-red-500 text-white hover:bg-red-600 active:scale-95"
                  : "bg-red-600 text-white hover:bg-red-700 active:scale-95"
              }`}
            >
              <LogOut className="w-4 h-4" />
              Clock Out
            </button>

            <button
              onClick={handleStartBreak}
              disabled={!currentClockedIn || currentClockedIn.status === "on-break"}
              className={`py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                !currentClockedIn || currentClockedIn.status === "on-break"
                  ? isIpsHighContrast
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : isIpsHighContrast
                  ? "bg-amber-500 text-white hover:bg-amber-600 active:scale-95"
                  : "bg-amber-600 text-white hover:bg-amber-700 active:scale-95"
              }`}
            >
              <Coffee className="w-4 h-4" />
              Start Break
            </button>

            <button
              onClick={handleEndBreak}
              disabled={!currentClockedIn || currentClockedIn.status !== "on-break"}
              className={`py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                !currentClockedIn || currentClockedIn.status !== "on-break"
                  ? isIpsHighContrast
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : isIpsHighContrast
                  ? "bg-blue-500 text-white hover:bg-blue-600 active:scale-95"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
              }`}
            >
              <Coffee className="w-4 h-4" />
              End Break
            </button>
          </div>
        </div>
      )}

      {/* HISTORY VIEW */}
      {view === "history" && (
        <div className={`border rounded-2xl p-6 space-y-4 ${isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#18181f]/40 border-[#262633]/60"}`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${isIpsHighContrast ? "text-[#111116]" : "text-white"}`}>Time Card History</h3>
            <button
              onClick={handleExportCSV}
              className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                isIpsHighContrast
                  ? "bg-[#b89047] text-white hover:bg-[#a37e3d]"
                  : "bg-[#dfb76c] text-black hover:bg-[#ebd097]"
              }`}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full text-sm border-collapse ${isIpsHighContrast ? "text-[#111116]" : "text-gray-300"}`}>
              <thead>
                <tr className={`border-b ${isIpsHighContrast ? "border-neutral-200 bg-neutral-50" : "border-[#262633] bg-[#0b0b0d]"}`}>
                  <th className="text-left p-2">Employee</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Clock In</th>
                  <th className="text-left p-2">Clock Out</th>
                  <th className="text-right p-2">Hours</th>
                  <th className="text-center p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeCards
                  .filter((c) => c.status === "clocked-out")
                  .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())
                  .slice(0, 20)
                  .map((card) => (
                    <tr key={card.id} className={`border-b ${isIpsHighContrast ? "border-neutral-100" : "border-[#262633]/40"}`}>
                      <td className="p-2 font-semibold">{card.employeeName}</td>
                      <td className="p-2">{card.date}</td>
                      <td className="p-2 font-mono text-xs">{new Date(card.clockInTime).toLocaleTimeString()}</td>
                      <td className="p-2 font-mono text-xs">{card.clockOutTime && new Date(card.clockOutTime).toLocaleTimeString()}</td>
                      <td className="p-2 text-right font-semibold">{card.totalHours?.toFixed(2) || "0"}h</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteEntry(card.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT VIEW */}
      {view === "report" && (
        <div className={`border rounded-2xl p-6 space-y-6 ${isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#18181f]/40 border-[#262633]/60"}`}>
          <h3 className={`text-lg font-semibold ${isIpsHighContrast ? "text-[#111116]" : "text-white"}`}>Daily Summary - {new Date().toDateString()}</h3>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg border ${isIpsHighContrast ? "bg-gray-50 border-neutral-200" : "bg-[#1a1a24] border-[#262633]"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${isIpsHighContrast ? "text-neutral-600" : "text-gray-500"}`}>Employees Clocked In</p>
              <p className={`text-3xl font-bold ${isIpsHighContrast ? "text-[#b89047]" : "text-[#dfb76c]"}`}>{todayEntries.length}</p>
            </div>

            <div className={`p-4 rounded-lg border ${isIpsHighContrast ? "bg-gray-50 border-neutral-200" : "bg-[#1a1a24] border-[#262633]"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${isIpsHighContrast ? "text-neutral-600" : "text-gray-500"}`}>Total Hours (Completed)</p>
              <p className={`text-3xl font-bold ${isIpsHighContrast ? "text-emerald-600" : "text-emerald-400"}`}>{dailyTotals.totalHours}h</p>
            </div>

            <div className={`p-4 rounded-lg border ${isIpsHighContrast ? "bg-gray-50 border-neutral-200" : "bg-[#1a1a24] border-[#262633]"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${isIpsHighContrast ? "text-neutral-600" : "text-gray-500"}`}>Total Break Time</p>
              <p className={`text-3xl font-bold ${isIpsHighContrast ? "text-amber-600" : "text-amber-400"}`}>{dailyTotals.totalBreak}h</p>
            </div>
          </div>

          {/* Employee Details */}
          <div className={`border rounded-lg p-4 ${isIpsHighContrast ? "border-neutral-200 bg-gray-50" : "border-[#262633] bg-[#0b0b0d]"}`}>
            <h4 className={`font-semibold mb-3 ${isIpsHighContrast ? "text-[#111116]" : "text-white"}`}>Today's Activity</h4>
            <div className="space-y-2">
              {todayEntries.length === 0 ? (
                <p className={`text-sm ${isIpsHighContrast ? "text-neutral-600" : "text-gray-500"}`}>No employees clocked in today</p>
              ) : (
                todayEntries.map((entry) => (
                  <div key={entry.id} className={`p-3 rounded border ${isIpsHighContrast ? "bg-white border-neutral-200" : "bg-[#18181f] border-[#262633]/60"}`}>
                    <div className="flex justify-between">
                      <span className="font-semibold">{entry.employeeName}</span>
                      <span className={`text-xs px-2 py-1 rounded ${entry.status === "on-break" ? (isIpsHighContrast ? "bg-amber-100 text-amber-800" : "bg-amber-900/30 text-amber-300") : (isIpsHighContrast ? "bg-green-100 text-green-800" : "bg-emerald-900/30 text-emerald-300")}`}>
                        {entry.status === "on-break" ? "On Break" : "Working"}
                      </span>
                    </div>
                    <p className={`text-xs font-mono mt-1 ${isIpsHighContrast ? "text-neutral-600" : "text-gray-500"}`}>
                      In: {new Date(entry.clockInTime).toLocaleTimeString()}
                      {entry.breakStart && ` | Break: ${new Date(entry.breakStart).toLocaleTimeString()}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
