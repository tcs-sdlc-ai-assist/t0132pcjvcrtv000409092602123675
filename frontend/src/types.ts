export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  access_token: string;
  token_type: string;
  role: string;
  name: string;
}

export interface AuthContextValue {
  session: AuthSession | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}
