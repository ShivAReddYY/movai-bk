'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Sparkles, Video, Image as ImageIcon, Music,
  Wand2, Loader2, AlertCircle, CheckCircle2, Film,
  Palette, X, Zap, Settings2, Network, Brain, BarChart3,
  FileText, Users, MapPin, Clock, RefreshCw, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { scriptsApi } from '@/lib/api/scripts';
import { aiApi } from '@/lib/api/ai';
import { useScriptSummaryStatus, useGenerateScriptSummary } from '@/lib/hooks/useScriptAnalysis';

interface Scene {
  id: string;
  sceneNumber: number;
  heading: string;
  location?: string;
  summary?: string;
}

interface Character {
  id: string;
  name: string;
  description?: string;
}

interface Script {
  id: string;
  title: string;
  scenes?: Scene[];
  characters?: Character[];
}

export default function AIGeneratePage() {
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as string;

  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationType, setGenerationType] = useState<string>('video');

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedScene, setSelectedScene] = useState<string>('none');
  const [selectedCharacter, setSelectedCharacter] = useState<string>('none');
  
  const [model, setModel] = useState('VEO_3_1');
  const [aspectRatio, setAspectRatio] = useState('RATIO_16_9');
  const [resolution, setResolution] = useState('RES_720P');
  const [duration, setDuration] = useState('8');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGeneratingSmartPrompt, setIsGeneratingSmartPrompt] = useState(false);

  // Script analysis hooks
  const { data: summaryStatus, isLoading: statusLoading } = useScriptSummaryStatus(scriptId);
  const generateSummary = useGenerateScriptSummary();

  useEffect(() => {
    if (scriptId) {
      fetchScriptData();
    }
  }, [scriptId]);

  const fetchScriptData = async () => {
    try {
      setLoading(true);
      const response = await scriptsApi.getScript(scriptId);
      setScript(response.data);
    } catch (error) {
      console.error('Error fetching script:', error);
      toast.error('Failed to load script data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    try {
      setGenerating(true);

      const config: any = {
        model,
        aspectRatio,
        resolution,
        duration: parseInt(duration),
      };

      if (negativePrompt) {
        config.negativePrompt = negativePrompt;
      }

      const payload: any = {
        scriptId,
        prompt,
        config,
      };

      if (selectedScene && selectedScene !== 'none') {
        payload.sceneId = selectedScene;
      }
      
      if (selectedCharacter && selectedCharacter !== 'none') {
        payload.characterId = selectedCharacter;
      }

      if (generationType === 'video') {
        await aiApi.generateVideo(payload);
      } else if (generationType === 'image') {
        await aiApi.generateImage(payload);
      } else if (generationType === 'audio') {
        payload.text = prompt;
        await aiApi.generateAudio(payload);
      }

      toast.success('Generation started! This may take a few minutes.');
      router.push(`/studio/scripts/${scriptId}/ai-hub`);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const generateSmartPrompt = async () => {
    // Check if script analysis is available
    if (!summaryStatus?.hasSummary) {
      toast.error('Script analysis required for smart prompts. Please analyze the script first.');
      return;
    }

    setIsGeneratingSmartPrompt(true);
    
    // Create loading message based on context
    let loadingMessage = 'Generating AI-enhanced prompt...';
    if (selectedScene !== 'none' && selectedCharacter !== 'none') {
      loadingMessage = 'Analyzing scene and character context...';
    } else if (selectedScene !== 'none') {
      loadingMessage = 'Analyzing scene context...';
    } else if (selectedCharacter !== 'none') {
      loadingMessage = 'Analyzing character context...';
    }
    
    toast.loading(loadingMessage, {
      id: 'smart-prompt-loading'
    });

    try {
      // Use AI to generate context-aware prompt
      const response = await aiApi.testPromptEnhancement({
        scriptId,
        sceneId: selectedScene !== 'none' ? selectedScene : undefined,
        characterId: selectedCharacter !== 'none' ? selectedCharacter : undefined,
        prompt: `Generate a ${generationType} for this script`,
        generationType: generationType
      });

      if (response.success) {
        setPrompt(response.enhancedPrompt);
        toast.dismiss('smart-prompt-loading');
        
        // Create context description
        let contextDescription = 'Enhanced with script context';
        if (selectedScene !== 'none' && selectedCharacter !== 'none') {
          contextDescription = 'Enhanced with scene and character context';
        } else if (selectedScene !== 'none') {
          contextDescription = 'Enhanced with scene context';
        } else if (selectedCharacter !== 'none') {
          contextDescription = 'Enhanced with character context';
        }
        
        toast.success('AI-enhanced prompt generated!', {
          description: contextDescription
        });
      } else {
        toast.dismiss('smart-prompt-loading');
        toast.warning('AI enhancement failed, using basic prompt');
        generateBasicSmartPrompt();
      }
    } catch (error) {
      console.error('Smart prompt generation failed:', error);
      toast.dismiss('smart-prompt-loading');
      toast.error('AI enhancement failed', {
        description: 'Using basic smart prompt instead.'
      });
      generateBasicSmartPrompt();
    } finally {
      setIsGeneratingSmartPrompt(false);
    }
  };

  const generateBasicSmartPrompt = () => {
    let smartPrompt = '';

    if (selectedScene && selectedScene !== 'none' && script?.scenes) {
      const scene = script.scenes.find((s) => s.id === selectedScene);
      if (scene) {
        smartPrompt = `A cinematic ${generationType} of ${scene.heading}. `;
        if (scene.location) smartPrompt += `Location: ${scene.location}. `;
        if (scene.summary) smartPrompt += scene.summary;
      }
    }

    if (selectedCharacter && selectedCharacter !== 'none' && script?.characters) {
      const character = script.characters.find((c) => c.id === selectedCharacter);
      if (character) {
        smartPrompt += ` Featuring ${character.name}`;
        if (character.description) smartPrompt += ` (${character.description})`;
      }
    }

    if (!smartPrompt) {
      smartPrompt = `A cinematic ${generationType} for the screenplay "${script?.title}"`;
    }

    setPrompt(smartPrompt);
    toast.success('Basic smart prompt generated!', {
      description: 'Generated based on selected scene and character context.'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading generation studio...</p>
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
            <Link href={`/studio/scripts/${scriptId}/ai-hub`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Wand2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full">
                    <span className="text-xs font-medium text-primary">AI Studio</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-3xl font-bold">AI Generation</h1>
                <p className="text-sm text-muted-foreground">{script?.title}</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            size="lg"
            className="h-11"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
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
          <Card className={`border-2 ${summaryStatus.hasSummary ? 'border-green-200 bg-green-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${summaryStatus.hasSummary ? 'bg-green-100' : 'bg-orange-100'} rounded-lg flex items-center justify-center`}>
                    <Brain className={`h-5 w-5 ${summaryStatus.hasSummary ? 'text-green-600' : 'text-orange-600'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Script Analysis Status</h3>
                    <p className="text-sm text-muted-foreground">
                      {summaryStatus.hasSummary ? 'AI context available for enhanced generation' : 'Generate AI analysis for better results'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {summaryStatus.hasSummary ? (
                    <Badge variant="outline" className="gap-1.5 border-green-200 text-green-700">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Analyzed
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1.5">
                      <AlertCircle className="h-3 w-3" />
                      Not Analyzed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">Script:</span>
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
                    variant={summaryStatus.hasSummary ? "outline" : "default"}
                  >
                    {generateSummary.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    {summaryStatus.hasSummary ? 'Update Analysis' : 'Analyze Script'}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>AI context ready for enhanced generation</span>
                  </div>
                )}
                
                <Button variant="ghost" size="sm" className="gap-2">
                  <Info className="h-4 w-4" />
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form - Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Generation Type Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-6 space-y-4">
                <Label className="text-base font-bold uppercase tracking-wider">
                  Generation Type
                </Label>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'video', label: 'Video', icon: Video, bgColor: 'bg-purple-500/10', iconColor: 'text-purple-500' },
                    { value: 'image', label: 'Image', icon: ImageIcon, bgColor: 'bg-blue-500/10', iconColor: 'text-blue-500' },
                    { value: 'audio', label: 'Audio', icon: Music, bgColor: 'bg-green-500/10', iconColor: 'text-green-500' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setGenerationType(type.value)}
                      className={`p-6 rounded-lg transition-all ${
                        generationType === type.value
                          ? 'bg-primary/10 border-2 border-primary/30 shadow-md'
                          : 'border-2 border-border hover:border-primary/20'
                      }`}
                    >
                      <div className={`w-12 h-12 ${type.bgColor} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                        <type.icon className={`h-6 w-6 ${type.iconColor}`} />
                      </div>
                      <p className="text-sm font-medium">{type.label}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Prompt Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold uppercase tracking-wider">
                    Prompt
                  </Label>
                  <div className="flex items-center gap-2">
                    {summaryStatus?.hasSummary ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateSmartPrompt}
                        disabled={isGeneratingSmartPrompt}
                        className="gap-2"
                      >
                        {isGeneratingSmartPrompt ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Brain className="h-4 w-4" />
                        )}
                        {isGeneratingSmartPrompt ? 'Generating...' : 'AI Smart Prompt'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateBasicSmartPrompt}
                        className="gap-2"
                      >
                        <Network className="h-4 w-4" />
                        Basic Smart Prompt
                      </Button>
                    )}
                    {!summaryStatus?.hasSummary && (
                      <div className="text-xs text-orange-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Analysis needed for AI prompts
                      </div>
                    )}
                  </div>
                </div>

                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe the ${generationType} you want to generate in detail...

Example: "A cinematic drone shot of a red convertible driving along a coastal road at sunset, waves crashing against the rocks below."`}
                  rows={8}
                  className="resize-none"
                />

                <div className="flex items-start gap-3 p-4 bg-blue-500/10 rounded-lg border-2 border-blue-500/20">
                  <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Pro Tip</p>
                    <p className="text-muted-foreground">
                      Be specific about camera angles, lighting, mood, and actions for best results.
                    </p>
                  </div>
                </div>

                {/* Negative Prompt */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <X className="h-4 w-4 text-red-500" />
                    Negative Prompt (Optional)
                  </Label>
                  <Textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="What to avoid (e.g., cartoon, low quality, blurry)..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Configuration */}
          {generationType === 'video' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold uppercase tracking-wider">
                      Video Settings
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Advanced</span>
                      <Switch
                        checked={showAdvanced}
                        onCheckedChange={setShowAdvanced}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Model</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VEO_3_1">Veo 3.1 (Latest)</SelectItem>
                          <SelectItem value="VEO_3_1_FAST">Veo 3.1 Fast</SelectItem>
                          <SelectItem value="VEO_3">Veo 3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Duration</Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4 seconds</SelectItem>
                          <SelectItem value="6">6 seconds</SelectItem>
                          <SelectItem value="8">8 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {showAdvanced && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Aspect Ratio</Label>
                          <Select value={aspectRatio} onValueChange={setAspectRatio}>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RATIO_16_9">16:9 Widescreen</SelectItem>
                              <SelectItem value="RATIO_9_16">9:16 Portrait</SelectItem>
                              <SelectItem value="RATIO_1_1">1:1 Square</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Resolution</Label>
                          <Select value={resolution} onValueChange={setResolution}>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RES_720P">720p HD</SelectItem>
                              <SelectItem value="RES_1080P">1080p Full HD</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Sidebar - Context */}
        <div className="space-y-6">
          {/* Scene Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Film className="h-4 w-4 text-blue-500" />
                  Link to Scene
                </Label>

                {script?.scenes && script.scenes.length > 0 ? (
                  <>
                    <Select value={selectedScene} onValueChange={setSelectedScene}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select scene..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="none">None</SelectItem>
                        {script.scenes.map((scene) => (
                          <SelectItem key={scene.id} value={scene.id}>
                            Scene {scene.sceneNumber}: {scene.heading}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedScene && selectedScene !== 'none' && script.scenes && (
                      <div className="p-3 bg-blue-500/10 rounded-lg border-2 border-blue-500/20">
                        <p className="text-sm">
                          {script.scenes.find((s) => s.id === selectedScene)?.summary || 'Scene selected'}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No scenes available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Character Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Palette className="h-4 w-4 text-pink-500" />
                  Link to Character
                </Label>

                {script?.characters && script.characters.length > 0 ? (
                  <>
                    <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select character..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="none">None</SelectItem>
                        {script.characters.map((character) => (
                          <SelectItem key={character.id} value={character.id}>
                            {character.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedCharacter && selectedCharacter !== 'none' && script.characters && (
                      <div className="p-3 bg-pink-500/10 rounded-lg border-2 border-pink-500/20">
                        <p className="text-sm">
                          {script.characters.find((c) => c.id === selectedCharacter)?.description || 'Character selected'}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No characters available</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Generation Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <Label className="text-sm font-bold uppercase tracking-wider text-blue-800">
                    Generation Status
                  </Label>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Script Analysis:</span>
                    <div className="flex items-center gap-2">
                      {summaryStatus?.hasSummary ? (
                        <Badge variant="outline" className="gap-1 border-green-200 text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">AI Enhancement:</span>
                    <div className="flex items-center gap-2">
                      {summaryStatus?.hasSummary ? (
                        <Badge variant="outline" className="gap-1 border-blue-200 text-blue-700">
                          <Brain className="h-3 w-3" />
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <X className="h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Context:</span>
                    <div className="flex items-center gap-2">
                      {selectedScene !== 'none' || selectedCharacter !== 'none' ? (
                        <Badge variant="outline" className="gap-1 border-purple-200 text-purple-700">
                          <Film className="h-3 w-3" />
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <X className="h-3 w-3" />
                          None
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card className="bg-primary/5">
              <CardContent className="p-6 space-y-3">
                <Label className="text-sm font-bold uppercase tracking-wider">
                  Quick Facts
                </Label>
                {[
                  'Generation takes 1-5 minutes',
                  'Videos include native audio',
                  'Continue working while generating',
                  summaryStatus?.hasSummary ? 'AI context will enhance your prompts' : 'Analyze script for AI-enhanced prompts'
                ].map((fact, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{fact}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
