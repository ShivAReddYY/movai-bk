import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  aiApi,
  AIGeneration,
  GenerateVideoRequest,
  GenerateImageRequest,
  GenerateAudioRequest,
  GenerateVideoFromImageRequest,
  ExtendVideoRequest,
  AIGenerationType,
  GenerationStatus,
} from '@/lib/api/ai';
import { useEffect, useRef } from 'react';

// ==================== QUERY KEYS ====================

export const aiKeys = {
  all: ['ai'] as const,
  generations: (scriptId: string) => [...aiKeys.all, 'generations', scriptId] as const,
  generation: (id: string) => [...aiKeys.all, 'generation', id] as const,
  assets: (scriptId: string) => [...aiKeys.all, 'assets', scriptId] as const,
  asset: (id: string) => [...aiKeys.all, 'asset', id] as const,
  scriptSummaryStatus: (scriptId: string) => [...aiKeys.all, 'scriptSummaryStatus', scriptId] as const,
  scriptSummary: (scriptId: string) => [...aiKeys.all, 'scriptSummary', scriptId] as const,
};

// ==================== GENERATION HOOKS ====================

/**
 * Hook to generate video from text prompt
 */
export const useGenerateVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateVideoRequest) => aiApi.generateVideo(request),
    onSuccess: (_data: any, variables: GenerateVideoRequest) => {
      toast.success('Video generation started!', {
        description: 'This may take 1-5 minutes. You can continue working.',
      });
      queryClient.invalidateQueries({ queryKey: aiKeys.generations(variables.scriptId) });
    },
    onError: (error: any) => {
      toast.error('Video generation failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

/**
 * Hook to generate image from text prompt
 */
export const useGenerateImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateImageRequest) => aiApi.generateImage(request),
    onSuccess: (_data: any, variables: GenerateImageRequest) => {
      toast.success('Image generation started!', {
        description: 'This should complete in 30-60 seconds.',
      });
      queryClient.invalidateQueries({ queryKey: aiKeys.generations(variables.scriptId) });
    },
    onError: (error: any) => {
      toast.error('Image generation failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

/**
 * Hook to generate audio
 */
export const useGenerateAudio = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateAudioRequest) => aiApi.generateAudio(request),
    onSuccess: (_data: any, variables: GenerateAudioRequest) => {
      toast.success('Audio generation started!');
      queryClient.invalidateQueries({ queryKey: aiKeys.generations(variables.scriptId) });
    },
    onError: (error: any) => {
      toast.error('Audio generation failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

/**
 * Hook to generate video from image
 */
export const useGenerateVideoFromImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateVideoFromImageRequest) => aiApi.generateVideoFromImage(request),
    onSuccess: (_data: any, variables: GenerateVideoFromImageRequest) => {
      toast.success('Image-to-video generation started!');
      queryClient.invalidateQueries({ queryKey: aiKeys.generations(variables.scriptId) });
    },
    onError: (error: any) => {
      toast.error('Image-to-video failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

/**
 * Hook to extend video
 */
export const useExtendVideo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ExtendVideoRequest) => aiApi.extendVideo(request),
    onSuccess: (_data: any, variables: ExtendVideoRequest) => {
      toast.success('Video extension started!');
      queryClient.invalidateQueries({ queryKey: aiKeys.generations(variables.scriptId) });
    },
    onError: (error: any) => {
      toast.error('Video extension failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

// ==================== QUERY HOOKS ====================

/**
 * Hook to get generation status
 */
export const useGenerationStatus = (generationId: string, enabled: boolean = true) => {
  return useQuery<AIGeneration, Error>({
    queryKey: aiKeys.generation(generationId),
    queryFn: async () => {
      const response = await aiApi.getGenerationStatus(generationId);
      return response.generation;
    },
    enabled: enabled && !!generationId,
    refetchInterval: (query) => {
      // Auto-refresh every 10 seconds if still processing
      const data = query.state.data;
      if (data?.status === 'PROCESSING' || data?.status === 'PENDING') {
        return 10000;
      }
      return false;
    },
  });
};

/**
 * Hook to list all generations for a script
 */
export const useGenerations = (
  scriptId: string,
  filters?: {
    type?: AIGenerationType;
    status?: GenerationStatus;
  }
) => {
  return useQuery<AIGeneration[], Error>({
    queryKey: [...aiKeys.generations(scriptId), filters],
    queryFn: async () => {
      const response = await aiApi.listGenerations(scriptId, filters);
      return response.generations;
    },
    enabled: !!scriptId,
    refetchInterval: (query) => {
      // Auto-refresh if any generation is processing
      const data = query.state.data;
      const hasProcessing = data?.some(
        (g: AIGeneration) => g.status === 'PROCESSING' || g.status === 'PENDING'
      );
      return hasProcessing ? 10000 : false;
    },
  });
};

/**
 * Hook to list AI assets for a script
 */
export const useAssets = (
  scriptId: string,
  filters?: {
    type?: AIGenerationType;
  }
) => {
  return useQuery({
    queryKey: [...aiKeys.assets(scriptId), filters],
    queryFn: async () => {
      const response = await aiApi.listAssets(scriptId, filters);
      return response.assets;
    },
    enabled: !!scriptId,
  });
};

/**
 * Hook to delete generation
 */
export const useDeleteGeneration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (generationId: string) => aiApi.deleteGeneration(generationId),
    onSuccess: (_: any, generationId: string) => {
      toast.success('Generation deleted');
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
    onError: (error: any) => {
      toast.error('Failed to delete generation', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

// ==================== POLLING HOOK ====================

/**
 * Hook to poll generation status until completed
 */
export const usePollGeneration = (
  generationId: string,
  onComplete?: (generation: AIGeneration) => void,
  onError?: (error: Error) => void
) => {
  const { data, error, isLoading } = useGenerationStatus(generationId, !!generationId);
  const previousStatusRef = useRef<GenerationStatus | null>(null);

  useEffect(() => {
    if (data) {
      // Status changed
      if (previousStatusRef.current !== data.status) {
        previousStatusRef.current = data.status;

        if (data.status === 'COMPLETED') {
          toast.success('Generation completed!', {
            description: 'Your AI-generated content is ready.',
          });
          if (onComplete) {
            onComplete(data);
          }
        } else if (data.status === 'FAILED') {
          toast.error('Generation failed', {
            description: data.errorMessage || 'An error occurred during generation.',
          });
          if (onError) {
            onError(new Error(data.errorMessage || 'Generation failed'));
          }
        } else if (data.status === 'PROCESSING') {
          toast.info('Generation in progress...', {
            description: 'This may take a few minutes.',
          });
        }
      }
    }
  }, [data?.status, onComplete, onError, data]);

  return {
    generation: data,
    isLoading,
    error,
    isProcessing: data?.status === 'PROCESSING' || data?.status === 'PENDING',
    isCompleted: data?.status === 'COMPLETED',
    isFailed: data?.status === 'FAILED',
  };
};

// ==================== STATS HOOKS ====================

/**
 * Hook to get AI generation statistics
 */
export const useAIStats = (scriptId: string) => {
  const { data: generations } = useGenerations(scriptId);

  const stats = {
    total: generations?.length || 0,
    videos: generations?.filter((g: AIGeneration) => g.type === 'VIDEO').length || 0,
    images: generations?.filter((g: AIGeneration) => g.type === 'IMAGE').length || 0,
    audio: generations?.filter((g: AIGeneration) => g.type === 'AUDIO').length || 0,
    completed: generations?.filter((g: AIGeneration) => g.status === 'COMPLETED').length || 0,
    processing: generations?.filter((g: AIGeneration) => g.status === 'PROCESSING').length || 0,
    failed: generations?.filter((g: AIGeneration) => g.status === 'FAILED').length || 0,
  };

  return stats;
};

// ==================== SCRIPT ANALYSIS HOOKS ====================

/**
 * Hook to get script summary status
 */
export const useScriptSummaryStatus = (scriptId: string) => {
  return useQuery({
    queryKey: aiKeys.scriptSummaryStatus(scriptId),
    queryFn: () => aiApi.getScriptSummaryStatus(scriptId),
    enabled: !!scriptId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to generate script summary
 */
export const useGenerateScriptSummary = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (scriptId: string) => aiApi.generateScriptSummary(scriptId),
    onSuccess: (data, scriptId) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: aiKeys.scriptSummaryStatus(scriptId) });
      queryClient.invalidateQueries({ queryKey: aiKeys.scriptSummary(scriptId) });
      
      toast.success('Script analysis completed!', {
        description: 'AI context is now available for enhanced generation.',
      });
    },
    onError: (error: any) => {
      toast.error('Script analysis failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};

/**
 * Hook to get script summary
 */
export const useScriptSummary = (scriptId: string) => {
  return useQuery({
    queryKey: aiKeys.scriptSummary(scriptId),
    queryFn: () => aiApi.getScriptSummary(scriptId),
    enabled: !!scriptId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to test prompt enhancement
 */
export const useTestPromptEnhancement = () => {
  return useMutation({
    mutationFn: (data: {
      scriptId: string;
      sceneId?: string;
      characterId?: string;
      prompt: string;
      generationType: string;
    }) => aiApi.testPromptEnhancement(data),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Prompt enhanced successfully!', {
          description: `Intent preserved: ${data.intentPreserved ? 'Yes' : 'No'}`,
        });
      }
    },
    onError: (error: any) => {
      toast.error('Prompt enhancement failed', {
        description: error.response?.data?.error || error.message,
      });
    },
  });
};