import fs from "fs";
import path from "path";

// Paths for persistent registries
const usersDbPath = path.join(process.cwd(), "suitpro_users_db.json");

export interface StoredUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: "Owner" | "Manager" | "Cashier";
  createdAt: string;
}

/**
 * Interface representing authenticated user credentials
 */
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    name: string;
    role: "Owner" | "Manager" | "Cashier";
  };
  token?: string;
  error?: string;
}

/**
 * Retrieve the current registered users roster from the filesystem JSON database
 */
export function getSavedUsers(): StoredUser[] {
  try {
    if (!fs.existsSync(usersDbPath)) {
      // Default fallback starter list matching seed credentials
      const defaultUsers: StoredUser[] = [
        {
          id: "user-owner-rumel",
          username: "Rumel",
          password: "login_not_needed_for_hardcoded",
          name: "Rumel Ahmed",
          role: "Owner",
          createdAt: "2026-06-10T13:45:00Z"
        },
        {
          id: "user-manager-sophie",
          username: "sophie_manager",
          password: "123",
          name: "Sophie Sinclair",
          role: "Manager",
          createdAt: "2026-06-10T13:46:00Z"
        },
        {
          id: "user-cashier-liam",
          username: "liam_cashier",
          password: "123",
          name: "Liam Vance",
          role: "Cashier",
          createdAt: "2026-06-10T13:47:00Z"
        }
      ];
      fs.writeFileSync(usersDbPath, JSON.stringify(defaultUsers, null, 2), "utf8");
      return defaultUsers;
    }
    return JSON.parse(fs.readFileSync(usersDbPath, "utf8"));
  } catch (err) {
    console.error("Failed to read user profiles database:", err);
    return [];
  }
}

/**
 * Validates login credentials against Master credentials or persistent user roster list
 */
export function authenticateUser(username: string, passwordSecret: string): AuthResult {
  if (!username || !passwordSecret) {
    return { success: false, error: "Missing login credentials parameters." };
  }

  // 1. Rigidly authenticate Master System Owner "Rumel"
  if (username === "Rumel" && passwordSecret === "123456") {
    return {
      success: true,
      user: {
        id: "user-owner-rumel",
        username: "Rumel",
        name: "Rumel Ahmed",
        role: "Owner"
      },
      token: "token-owner-rumel-london-jwt-like-signed"
    };
  }

  // 2. Validate employees (Managers & Cashiers) against dynamic database store
  const allUsers = getSavedUsers();
  const matchedUser = allUsers.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (matchedUser && matchedUser.password === passwordSecret) {
    return {
      success: true,
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        name: matchedUser.name,
        role: matchedUser.role
      },
      token: `token-emp-${matchedUser.id}-${Date.now()}`
    };
  }

  return {
    success: false,
    error: "Invalid username or secret password credentials supplied."
  };
}
