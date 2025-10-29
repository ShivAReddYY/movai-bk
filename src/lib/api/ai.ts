import { apiClient } from './client';

// ==================== INTERFACES ====================

export interface AIGeneration {
  id: string;
  scriptId: string;
  sceneId?: string;
  characterId?: string;
  createdById: string;
  type: AIGenerationType;
  model: AIModel;
  status: GenerationStatus;
  prompt: string;
  negativePrompt?: string;
  sourceAssetId?: string;
  referenceImages?: string[];
  config?: Record<string, any>;
  aspectRatio?: AspectRatio;
  resolution?: VideoResolution;
  duration?: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  filePath?: string;
  metadata?: Record<string, any>;
  costCredits?: number;
  operationId?: string;
  operationName?: string;
  errorMessage?: string;
  retryCount?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  scene?: {
    id: string;
    sceneNumber: number;
    heading: string;
    location?: string;
    summary?: string;
  };
  character?: {
    id: string;
    name: string;
    description?: string;
  };
  createdBy?: {
    id: string;
    name?: string;
    email: string;
  };
}

export interface AIAsset {
  id: string;
  scriptId: string;
  generationId?: string;
  type: AIGenerationType;
  name: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  aspectRatio?: AspectRatio;
  usedInScenes?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  generation?: {
    id: string;
    type: string;
    prompt: string;
    status: string;
    createdAt: string;
  };
}

export type AIGenerationType =
  | 'VIDEO'
  | 'IMAGE'
  | 'AUDIO'
  | 'VOICE_CLONE'
  | 'COSTUME'
  | 'CHARACTER'
  | 'STORYBOARD'
  | 'LOCATION'
  | 'PROPS'
  | 'SOUNDTRACK'
  | 'SOUND_EFFECTS'
  | 'VIDEO_EXTENSION'
  | 'IMAGE_TO_VIDEO'
  | 'VIDEO_COMPOSITE';

export type GenerationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type AIModel =
  | 'VEO_3_1'
  | 'VEO_3_1_FAST'
  | 'VEO_3'
  | 'VEO_3_FAST'
  | 'VEO_2'
  | 'IMAGEN_3'
  | 'NANO_BANANA'
  | 'GEMINI_PRO'
  | 'ELEVEN_LABS'
  | 'CUSTOM';

export type AspectRatio = 'RATIO_16_9' | 'RATIO_9_16' | 'RATIO_1_1' | 'RATIO_4_3';

export type VideoResolution = 'RES_720P' | 'RES_1080P' | 'RES_4K';

// ==================== REQUEST INTERFACES ====================

export interface GenerateVideoRequest {
  scriptId: string;
  sceneId?: string;
  characterId?: string;
  prompt: string;
  config?: {
    model?: AIModel;
    aspectRatio?: AspectRatio;
    resolution?: VideoResolution;
    duration?: number;
    negativePrompt?: string;
    personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
  };
}

export interface GenerateImageRequest {
  scriptId: string;
  sceneId?: string;
  characterId?: string;
  prompt: string;
  config?: {
    model?: AIModel;
    aspectRatio?: AspectRatio;
    negativePrompt?: string;
  };
}

export interface GenerateAudioRequest {
  scriptId: string;
  sceneId?: string;
  text: string;
  config?: {
    model?: AIModel;
    voice?: string;
    language?: string;
  };
}

export interface GenerateVideoFromImageRequest {
  scriptId: string;
  imageUrl: string;
  prompt: string;
  config?: {
    model?: AIModel;
    aspectRatio?: AspectRatio;
    resolution?: VideoResolution;
    imageMimeType?: string;
  };
}

export interface ExtendVideoRequest {
  scriptId: string;
  videoUrl: string;
  prompt: string;
  config?: {
    resolution?: VideoResolution;
  };
}

// ==================== SCRIPT ANALYSIS INTERFACES ====================

export interface ScriptSummaryStatus {
  hasSummary: boolean;
  needsRegeneration: boolean;
  generatedAt?: string;
  scriptVersion?: number;
  summaryVersion?: number;
  scriptLength?: number;
  sceneCount?: number;
  characterCount?: number;
  cacheAge?: number;
}

export interface ScriptSummary {
  summary: string;
  genre: string;
  tone: string;
  themes: string[];
  characters: Array<{
    name: string;
    description: string;
    importance: string;
  }>;
  locations: string[];
  keyEvents: string[];
  visualStyle: string;
  targetAudience: string;
  marketAppeal: string;
  uniqueSellingPoints: string[];
  processingInfo?: {
    chunked: boolean;
    totalChunks?: number;
    processedChunks?: number;
    errors?: number;
  };
}

// ==================== API CLIENT ====================

export const aiApi = {
  // ==================== VIDEO GENERATION ====================

  /**
   * Generate video from text prompt
   */
  generateVideo: async (request: GenerateVideoRequest) => {
    const response = await apiClient.post('/ai/generate/video', request);
    return response.data;
  },

  /**
   * Generate video from image (Image-to-Video)
   */
  generateVideoFromImage: async (request: GenerateVideoFromImageRequest) => {
    const response = await apiClient.post('/ai/generate/video-from-image', request);
    return response.data;
  },

  /**
   * Extend existing video
   */
  extendVideo: async (request: ExtendVideoRequest) => {
    const response = await apiClient.post('/ai/generate/extend-video', request);
    return response.data;
  },

  // ==================== IMAGE GENERATION ====================

  /**
   * Generate image from text prompt
   */
  generateImage: async (request: GenerateImageRequest) => {
    const response = await apiClient.post('/ai/generate/image', request);
    return response.data;
  },

  // ==================== AUDIO GENERATION ====================

  /**
   * Generate audio/voice
   */
  generateAudio: async (request: GenerateAudioRequest) => {
    const response = await apiClient.post('/ai/generate/audio', request);
    return response.data;
  },

  // ==================== GENERATION MANAGEMENT ====================

  /**
   * Get generation status by ID
   */
  getGenerationStatus: async (id: string): Promise<{ success: boolean; generation: AIGeneration }> => {
    const response = await apiClient.get(`/ai/generation/${id}`);
    return response.data;
  },

  /**
   * List all generations for a script
   */
  listGenerations: async (
    scriptId: string,
    filters?: {
      type?: AIGenerationType;
      status?: GenerationStatus;
    }
  ): Promise<{ success: boolean; count: number; generations: AIGeneration[] }> => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);

    const response = await apiClient.get(`/ai/generations/${scriptId}?${params.toString()}`);
    return response.data;
  },

  /**
   * Delete generation
   */
  deleteGeneration: async (id: string) => {
    const response = await apiClient.delete(`/ai/generation/${id}`);
    return response.data;
  },

  // ==================== ASSETS ====================

  /**
   * List AI assets for a script
   */
  listAssets: async (
    scriptId: string,
    filters?: {
      type?: AIGenerationType;
    }
  ): Promise<{ success: boolean; count: number; assets: AIAsset[] }> => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);

    const response = await apiClient.get(`/ai/assets/${scriptId}?${params.toString()}`);
    return response.data;
  },

  // ==================== SCRIPT ANALYSIS ====================

  /**
   * Get script summary status
   */
  getScriptSummaryStatus: async (scriptId: string): Promise<ScriptSummaryStatus> => {
    const response = await apiClient.get(`/ai/script/summary/status/${scriptId}`);
    return response.data;
  },

  /**
   * Generate script summary
   */
  generateScriptSummary: async (scriptId: string) => {
    const response = await apiClient.post('/ai/script/summary', { scriptId });
    return response.data;
  },

  /**
   * Get script summary
   */
  getScriptSummary: async (scriptId: string): Promise<{ success: boolean; summary: ScriptSummary }> => {
    const response = await apiClient.get(`/ai/script/summary/${scriptId}`);
    return response.data;
  },

  /**
   * Test prompt enhancement
   */
  testPromptEnhancement: async (data: {
    scriptId: string;
    sceneId?: string;
    characterId?: string;
    prompt: string;
    generationType: string;
  }) => {
    const response = await apiClient.post('/ai/test/prompt-enhancement', data);
    return response.data;
  },

  // ==================== UTILITIES ====================

  /**
   * Test AI API connection
   */
  testConnection: async () => {
    const response = await apiClient.get('/ai/test');
    return response.data;
  },

  /**
   * Poll generation status until completed
   */
  pollGenerationStatus: async (
    generationId: string,
    onUpdate?: (generation: AIGeneration) => void,
    maxAttempts: number = 120, // 20 minutes max (10s interval)
  ): Promise<AIGeneration> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await aiApi.getGenerationStatus(generationId);
        const generation = response.generation;

        if (onUpdate) {
          onUpdate(generation);
        }

        if (generation.status === 'COMPLETED' || generation.status === 'FAILED') {
          return generation;
        }

        // Wait 10 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 10000));
        attempts++;
      } catch (error) {
        console.error('Error polling generation status:', error);
        throw error;
      }
    }

    throw new Error('Generation polling timeout');
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Format generation type for display
 */
export const formatGenerationType = (type: AIGenerationType): string => {
  const map: Record<AIGenerationType, string> = {
    VIDEO: 'Video',
    IMAGE: 'Image',
    AUDIO: 'Audio',
    VOICE_CLONE: 'Voice Clone',
    COSTUME: 'Costume Design',
    CHARACTER: 'Character Design',
    STORYBOARD: 'Storyboard',
    LOCATION: 'Location/Set',
    PROPS: 'Props',
    SOUNDTRACK: 'Soundtrack',
    SOUND_EFFECTS: 'Sound Effects',
    VIDEO_EXTENSION: 'Video Extension',
    IMAGE_TO_VIDEO: 'Image-to-Video',
    VIDEO_COMPOSITE: 'Video Composite',
  };
  return map[type] || type;
};

/**
 * Format generation status for display
 */
export const formatGenerationStatus = (status: GenerationStatus): string => {
  const map: Record<GenerationStatus, string> = {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  };
  return map[status] || status;
};

/**
 * Get status color
 */
export const getStatusColor = (
  status: GenerationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const map: Record<GenerationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    PENDING: 'outline',
    PROCESSING: 'secondary',
    COMPLETED: 'default',
    FAILED: 'destructive',
    CANCELLED: 'outline',
  };
  return map[status] || 'outline';
};

/**
 * Format aspect ratio for display
 */
export const formatAspectRatio = (ratio: AspectRatio): string => {
  const map: Record<AspectRatio, string> = {
    RATIO_16_9: '16:9 (Widescreen)',
    RATIO_9_16: '9:16 (Portrait)',
    RATIO_1_1: '1:1 (Square)',
    RATIO_4_3: '4:3 (Classic)',
  };
  return map[ratio] || ratio;
};

/**
 * Format resolution for display
 */
export const formatResolution = (resolution: VideoResolution): string => {
  const map: Record<VideoResolution, string> = {
    RES_720P: '720p',
    RES_1080P: '1080p',
    RES_4K: '4K',
  };
  return map[resolution] || resolution;
};

/**
 * Calculate estimated generation time
 */
export const estimateGenerationTime = (type: AIGenerationType, duration?: number): string => {
  if (type === 'VIDEO') {
    const seconds = duration || 8;
    const minutes = Math.ceil(seconds * 0.5); // Roughly 0.5 min per second
    return `~${minutes}-${minutes + 2} minutes`;
  }
  if (type === 'IMAGE') {
    return '~30-60 seconds';
  }
  if (type === 'AUDIO') {
    return '~1-2 minutes';
  }
  return '~1-5 minutes';
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export default aiApi;