import axios from 'axios';

const BASE_URL = 'https://aay3man-elephante-api.hf.space';

export interface GarmentData {
  id: string;
  user_id: string;
  image_url: string;
  category: string;
  sub_type: string;
  fabric: string;
  pattern: string;
  dominant_colors: string[];
  season: string;
}

export interface SearchResult extends GarmentData {
  similarity: number;
}

export const elephanteAiApi = {
  uploadAndIngestGarment: async (userId: string, imageUri: string): Promise<{ status: string; data: GarmentData }> => {
    const formData = new FormData();
    formData.append('user_id', userId);
    const filename = imageUri.split('/').pop() || 'upload.png';
    const match = /\.(\w+)$/.exec(filename);
    const fileType = match ? `image/${match[1]}` : `image/png`;

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: fileType,
    } as any);

    const response = await axios.post(`${BASE_URL}/wardrobe/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  semanticBilingualSearch: async (userId: string, prompt: string): Promise<{ status: string; results: SearchResult[] }> => {
    const response = await axios.post(`${BASE_URL}/wardrobe/search`, {
      user_id: userId,
      text_prompt: prompt,
    });
    return response.data;
  },
  generateVirtualTryOn: async (userId: string, garmentId: string): Promise<{ status: string; message: string }> => {
    const response = await axios.post(`${BASE_URL}/wardrobe/tryon`, null, {
      params: { user_id: userId, garment_id: garmentId },
    });
    return response.data;
  },
};
