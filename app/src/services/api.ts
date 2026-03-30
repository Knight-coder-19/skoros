import axios from 'axios';

// Change this to your server IP when running on a real device
// For Android emulator: http://10.0.2.2:8000
// For iOS simulator: http://localhost:8000
// For real device on same WiFi: http://YOUR_COMPUTER_IP:8000
const BASE_URL = 'https://skoros.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface MediaInfo {
  title: string;
  platform: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats: Array<{
    format_id: string;
    height: number;
    ext: string;
    label: string;
  }>;
  is_image: boolean;
}

export interface DownloadRequest {
  url: string;
  quality?: 'best' | 'medium' | 'low';
  media_type?: 'video' | 'image';
}

export const getMediaInfo = async (url: string): Promise<MediaInfo> => {
  const response = await api.post('/info', { url });
  return response.data.data;
};

export const getDownloadUrl = (req: DownloadRequest): string => {
  const params = new URLSearchParams({
    url: req.url,
    quality: req.quality || 'best',
    media_type: req.media_type || 'video',
  });
  return `${BASE_URL}/download`;
};

export const downloadMedia = async (req: DownloadRequest): Promise<string> => {
  const response = await api.post('/download', req, {
    responseType: 'blob',
    timeout: 120000,
    onDownloadProgress: (progressEvent) => {
      // progress handled in component
    },
  });
  return response.data;
};

export const checkHealth = async (): Promise<boolean> => {
  try {
    const res = await api.get('/health', { timeout: 5000 });
    return res.data.status === 'ok';
  } catch {
    return false;
  }
};

export const setBaseUrl = (url: string) => {
  api.defaults.baseURL = url;
};

export default api;
