'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  Sparkles, Video, Image as ImageIcon, Music, ArrowLeft,
  Plus, Loader2, CheckCircle, XCircle, Clock, RefreshCw,
  Trash2, Download, Eye, AlertTriangle, Film, X,
  Brain, BarChart3, Zap, Settings, FileText, Users, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useGenerations, useDeleteGeneration, useAIStats } from '@/lib/hooks/useAI';
import { formatGenerationType, formatGenerationStatus, getStatusColor, AIGeneration } from '@/lib/api/ai';
import { useScriptSummaryStatus, useGenerateScriptSummary } from '@/lib/hooks/useScriptAnalysis';

export default function AIHubPage() {
  const API_URL = 'http://localhost:5000';

  const params = useParams();
  const scriptId = params.id as string;

  const [activeTab, setActiveTab] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewGeneration, setPreviewGeneration] = useState<AIGeneration | null>(null);

  const { data: generations, isLoading, refetch } = useGenerations(scriptId);
  const deleteGeneration = useDeleteGeneration();
  const stats = useAIStats(scriptId);
  
  // Script analysis hooks
  const { data: summaryStatus, isLoading: statusLoading } = useScriptSummaryStatus(scriptId);
  const generateSummary = useGenerateScriptSummary();

  const getFilteredGenerations = (): AIGeneration[] => {
    if (!generations) return [];
    if (activeTab === 'all') return generations;
    return generations.filter((g: AIGeneration) => g.type.toLowerCase() === activeTab);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return <Video className="h-5 w-5 text-purple-500" />;
      case 'IMAGE':
        return <ImageIcon className="h-5 w-5 text-blue-500" />;
      case 'AUDIO':
        return <Music className="h-5 w-5 text-green-500" />;
      default:
        return <Sparkles className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const handleDeleteClick = (id: string) => {
    setSelectedGenerationId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedGenerationId) {
      await deleteGeneration.mutateAsync(selectedGenerationId);
      setDeleteDialogOpen(false);
      setSelectedGenerationId(null);
    }
  };

  const handlePreview = (generation: AIGeneration) => {
    setPreviewGeneration(generation);
    setPreviewOpen(true);
  };

  const handleDownload = async (fileSrc: string, filename: string) => {
    try {
      const response = await fetch(fileSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading AI Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link href={`/studio/scripts/${scriptId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full">
                    <span className="text-xs font-medium text-primary">AI Hub</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-3xl font-bold">Generations</h1>
                <p className="text-sm text-muted-foreground">
                  {stats.processing} processing • {stats.completed} completed
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <Link href={`/studio/scripts/${scriptId}/ai-hub/generate`}>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Generation
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Script Analysis Status */}
      {summaryStatus && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-blue-500/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Script Analysis Status</h3>
                    <p className="text-sm text-muted-foreground">
                      AI-powered script understanding and context
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {summaryStatus.hasSummary ? (
                    <Badge variant="outline" className="gap-1.5">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Analyzed
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1.5">
                      <XCircle className="h-3 w-3" />
                      Not Analyzed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">Script Length:</span>
                  <span className="font-medium">{summaryStatus.scriptLength?.toLocaleString() || 'N/A'} chars</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Film className="h-4 w-4 text-purple-500" />
                  <span className="text-muted-foreground">Scenes:</span>
                  <span className="font-medium">{summaryStatus.sceneCount || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">Characters:</span>
                  <span className="font-medium">{summaryStatus.characterCount || 'N/A'}</span>
                </div>
              </div>

              {summaryStatus.cacheAge !== null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Clock className="h-4 w-4" />
                  <span>Last analyzed {summaryStatus.cacheAge} hours ago</span>
                  {summaryStatus.needsRegeneration && (
                    <Badge variant="outline" className="ml-2">
                      Needs Update
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                {!summaryStatus.hasSummary || summaryStatus.needsRegeneration ? (
                  <Button
                    onClick={() => generateSummary.mutate(scriptId)}
                    disabled={generateSummary.isPending}
                    className="gap-2"
                  >
                    {generateSummary.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    {summaryStatus.hasSummary ? 'Update Analysis' : 'Analyze Script'}
                  </Button>
                ) : (
                  <Button variant="outline" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    View Analysis
                  </Button>
                )}
                
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', count: stats.total, icon: Sparkles, bgColor: 'bg-purple-500/10', iconColor: 'text-purple-500' },
          { label: 'Videos', count: stats.videos, icon: Video, bgColor: 'bg-blue-500/10', iconColor: 'text-blue-500' },
          { label: 'Images', count: stats.images, icon: ImageIcon, bgColor: 'bg-green-500/10', iconColor: 'text-green-500' },
          { label: 'Audio', count: stats.audio, icon: Music, bgColor: 'bg-orange-500/10', iconColor: 'text-orange-500' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold">{stat.count}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-11">
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="video">Videos ({stats.videos})</TabsTrigger>
          <TabsTrigger value="image">Images ({stats.images})</TabsTrigger>
          <TabsTrigger value="audio">Audio ({stats.audio})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {getFilteredGenerations().length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center max-w-md mx-auto">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent mb-6">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No generations yet</h3>
                  <p className="text-muted-foreground mb-8">
                    Start creating AI-generated content for your script
                  </p>
                  <Link href={`/studio/scripts/${scriptId}/ai-hub/generate`}>
                    <Button size="lg">
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Generation
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredGenerations().map((generation: AIGeneration, index: number) => {
                const fileSrc = `${API_URL}${generation.outputUrl}`;
                const filename = generation.outputUrl?.split('/').pop() || 'download';

                return (
                  <motion.div
                    key={generation.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <Card className="group overflow-hidden hover:shadow-lg transition-all">
                      {/* Thumbnail */}
                      <div className="relative h-48 bg-accent flex items-center justify-center overflow-hidden">
                        {generation.status === 'COMPLETED' && generation.outputUrl ? (
                          generation.type === 'VIDEO' ? (
                            <video
                              src={fileSrc}
                              className="w-full h-full object-cover"
                              controls
                            />
                          ) : generation.type === 'IMAGE' ? (
                            <img
                              src={fileSrc}
                              alt="Generated content"
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                              onClick={() => handlePreview(generation)}
                              onError={(e) => {
                                console.error('Image failed to load:', fileSrc);
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                              }}
                            />
                          ) : generation.type === 'AUDIO' ? (
                            <div className="w-full p-4">
                              <audio src={fileSrc} controls className="w-full" />
                            </div>
                          ) : (
                            <Music className="h-12 w-12 text-green-500" />
                          )
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            {getTypeIcon(generation.type)}
                            <span className="text-xs text-muted-foreground">
                              {generation.status === 'PROCESSING' ? 'Generating...' : 'Failed'}
                            </span>
                          </div>
                        )}

                        <div className="fallback-icon hidden flex items-center justify-center">
                          {getTypeIcon(generation.type)}
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                          {getStatusIcon(generation.status)}
                        </div>
                      </div>

                      {/* Content */}
                      <CardContent className="p-5 space-y-3">
                        {/* Type and Status */}
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="gap-1.5">
                            {getTypeIcon(generation.type)}
                            {formatGenerationType(generation.type)}
                          </Badge>
                          <Badge variant={getStatusColor(generation.status)}>
                            {formatGenerationStatus(generation.status)}
                          </Badge>
                        </div>

                        {/* Prompt */}
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                          {generation.prompt}
                        </p>

                        {/* Scene Info */}
                        {generation.scene && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Film className="h-3 w-3" />
                            <span className="font-mono">
                              Scene {generation.scene.sceneNumber}: {generation.scene.heading}
                            </span>
                          </div>
                        )}

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-3 border-t">
                          <span className="text-xs font-mono text-muted-foreground">
                            {new Date(generation.createdAt).toLocaleDateString()}
                          </span>

                          <div className="flex items-center gap-1">
                            {generation.outputUrl && generation.status === 'COMPLETED' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => handlePreview(generation)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => handleDownload(fileSrc, filename)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteClick(generation.id)}
                              disabled={deleteGeneration.isPending}
                            >
                              {deleteGeneration.isPending && selectedGenerationId === generation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Modal - CUSTOM FULL SCREEN */}
      {previewOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/5 backdrop-blur-3xl"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {previewGeneration && getTypeIcon(previewGeneration.type)}
                <h2 className="text-xl font-bold">
                  {previewGeneration?.type === 'IMAGE' ? 'Image Preview' : previewGeneration?.type === 'VIDEO' ? 'Video Preview' : 'Audio Preview'}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            {previewGeneration && previewGeneration.outputUrl && (
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6">
                  {/* Left - Image (2 columns) */}
                  <div className="lg:col-span-2">
                    {previewGeneration.type === 'IMAGE' ? (
                      <div className="flex items-center justify-center bg-accent/30 rounded-lg p-4 min-h-[600px]">
                        <img
                          src={`${API_URL}${previewGeneration.outputUrl}`}
                          alt="Full size preview"
                          className="max-w-full max-h-[calc(100vh-200px)] w-auto h-auto object-contain rounded-lg"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : previewGeneration.type === 'VIDEO' ? (
                      <video
                        src={`${API_URL}${previewGeneration.outputUrl}`}
                        className="w-full h-auto rounded-lg max-h-[calc(100vh-200px)]"
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : previewGeneration.type === 'AUDIO' ? (
                      <div className="p-8 bg-accent rounded-lg flex items-center justify-center min-h-[400px]">
                        <audio
                          src={`${API_URL}${previewGeneration.outputUrl}`}
                          controls
                          className="w-full"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Right - Info (1 column) */}
                  <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                    <Card className="border-2">
                      <CardContent className="p-5 space-y-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Prompt
                          </p>
                          <p className="text-sm leading-relaxed">{previewGeneration.prompt}</p>
                        </div>

                        {previewGeneration.scene && (
                          <div className="pt-3 border-t">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Scene
                            </p>
                            <p className="text-sm font-mono">
                              Scene {previewGeneration.scene.sceneNumber}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {previewGeneration.scene.heading}
                            </p>
                          </div>
                        )}

                        <div className="pt-3 border-t">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Type
                          </p>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(previewGeneration.type)}
                            <span className="text-sm font-medium">
                              {formatGenerationType(previewGeneration.type)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Status
                          </p>
                          <Badge variant={getStatusColor(previewGeneration.status)}>
                            {formatGenerationStatus(previewGeneration.status)}
                          </Badge>
                        </div>

                        <div className="pt-3 border-t">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            Created
                          </p>
                          <p className="text-sm font-mono">
                            {new Date(previewGeneration.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Button
                      className="w-full h-11"
                      onClick={(e) => {
                        e.stopPropagation();
                        const fileSrc = `${API_URL}${previewGeneration.outputUrl}`;
                        const filename = previewGeneration.outputUrl?.split('/').pop() || 'download';
                        handleDownload(fileSrc, filename);
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download File
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}


      {/* Delete Confirmation Sheet - BETTER UI */}
      <Sheet open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <SheetContent side="bottom" className="h-auto pb-8">
          <SheetHeader className="text-left space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <SheetTitle className="text-2xl">Delete Generation</SheetTitle>
                <SheetDescription className="text-base">
                  This action cannot be undone
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="py-6">
            <p className="text-base leading-relaxed ml-4">
              Are you sure you want to delete this generation? The generated file will be permanently removed from the server.
            </p>
          </div>

          <SheetFooter className="flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 h-12 text-base"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteGeneration.isPending}
              className="flex-1 h-12 text-red-600"
            >
              {deleteGeneration.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5 mr-2 red-600" />
                  Delete
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>


    </div>
  );
}
