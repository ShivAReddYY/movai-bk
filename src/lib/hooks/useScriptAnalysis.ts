import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiApi, ScriptSummaryStatus, ScriptSummary } from '@/lib/api/ai';

// ==================== QUERY KEYS ====================

export const scriptAnalysisKeys = {
  all: ['scriptAnalysis'] as const,
  summaryStatus: (scriptId: string) => [...scriptAnalysisKeys.all, 'summaryStatus', scriptId] as const,
  summary: (scriptId: string) => [...scriptAnalysisKeys.all, 'summary', scriptId] as const,
};

// ==================== SCRIPT ANALYSIS HOOKS ====================

/**
 * Hook to get script summary status
 */
export const useScriptSummaryStatus = (scriptId: string) => {
  return useQuery<ScriptSummaryStatus, Error>({
    queryKey: scriptAnalysisKeys.summaryStatus(scriptId),
    queryFn: async () => {
      const response = await aiApi.getScriptSummaryStatus(scriptId);
      return response;
    },
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
      queryClient.invalidateQueries({ queryKey: scriptAnalysisKeys.summaryStatus(scriptId) });
      queryClient.invalidateQueries({ queryKey: scriptAnalysisKeys.summary(scriptId) });
      
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
  return useQuery<ScriptSummary, Error>({
    queryKey: scriptAnalysisKeys.summary(scriptId),
    queryFn: async () => {
      const response = await aiApi.getScriptSummary(scriptId);
      return response.summary;
    },
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