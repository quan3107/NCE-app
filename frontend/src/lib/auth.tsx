/**
 * Location: src/lib/auth.tsx
 * Purpose: Provide a simple in-memory auth context for prototype routing flows.
 * Why: Supplies role-aware state until real backend integration is available.
 */

import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from './constants';
import { Role, User, mockUsers } from './mock-data';

type AuthContextType = {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  switchRole: (role: Role) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize user from localStorage using lazy initialization
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.currentUser);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Sync currentUser to localStorage whenever it changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentUser);
    }
  }, [currentUser]);

  const login = async (email: string, _password: string): Promise<boolean> => {
    // Mock login - find user by email
    const user = mockUsers.find(u => u.email === email);
    if (user) {
      setCurrentUser(user);
      return true;
    }
    return false;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    // Mock Google login - default to student
    setCurrentUser(mockUsers[0]);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchRole = (role: Role) => {
    // For demo purposes - switch to a user with that role
    const user = mockUsers.find(u => u.role === role);
    if (user) {
      setCurrentUser(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        loginWithGoogle,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}



