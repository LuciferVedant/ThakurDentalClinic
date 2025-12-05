import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "model";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

export interface ChatResponse {
  userMessage: ChatMessage;
  modelMessage: ChatMessage;
  sessionId: string;
}

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const sendMessage = async (
  message: string,
  sessionId?: string
): Promise<ChatResponse> => {
  const response = await axios.post<ChatResponse>(
    `${API_URL}/chat`,
    { message, sessionId },
    { headers: getAuthHeader() }
  );
  return response.data;
};

export const getHistory = async (): Promise<ChatSession[]> => {
  const response = await axios.get<ChatSession[]>(`${API_URL}/chat/history`, {
    headers: getAuthHeader(),
  });
  return response.data;
};

export const getSessionMessages = async (
  sessionId: string
): Promise<ChatMessage[]> => {
  const response = await axios.get<ChatMessage[]>(
    `${API_URL}/chat/session/${sessionId}`,
    {
      headers: getAuthHeader(),
    }
  );
  return response.data;
};
