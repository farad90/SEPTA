import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiClient } from "./api-client";
import { setAccessToken } from "./token-store";

interface EffectivePermission {
  permissionKey: string;
  limitValue: number | null;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  mobile: string | null;
  profilePhotoUrl: string | null;
  permissionGroup: string | null;
  permissions: EffectivePermission[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const { data } = await apiClient.get<AuthUser>("/auth/me");
    setUser(data);
  }, []);

  useEffect(() => {
    // در لود اولیه صفحه، با کوکی refresh (اگه معتبر باشه) یک access token تازه می‌گیریم
    async function bootstrap() {
      try {
        const { data } = await apiClient.post<{ accessToken: string }>("/auth/refresh");
        setAccessToken(data.accessToken);
        await fetchMe();
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    bootstrap();
  }, [fetchMe]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const { data } = await apiClient.post<{ accessToken: string }>("/auth/login", {
        identifier,
        password,
      });
      setAccessToken(data.accessToken);
      await fetchMe();
    },
    [fetchMe],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth باید داخل AuthProvider استفاده بشه");
  }
  return ctx;
}
