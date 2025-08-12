import { AlertCircle, ChevronDown, ChevronRight, Download, FileText, Loader2, Lock, Pause, Play, RotateCcw, Settings, Square, Unlock, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Default configuration
const DEFAULT_CONFIG = {
    categories: "cs.LG, cs.AI, cs.CV, cs.CL, cs.NE, cs.IR, stat.AP, stat.CO, stat.ME, stat.ML, stat.TH, astro-ph.GA, astro-ph.SR, astro-ph.IM, astro-ph.CO, astro-ph.EP, astro-ph.HE",
    scoringCriteria: `
    **AI/ML (Broad Interest):** Deep learning advances, general ML methods, mechanistic interpretability, trustworthy AI, statistical learning theory, probabilistic ML, AI for scientific discovery.  

    **Statistics, Computation, and Inference:** Sampling and approximate inference methods, uncertainty quantification, time series analysis, state space models, hierarchical modeling, scalable inference.

    **Astrophysics Applications:** Galactic structure and dynamics, stellar astrophysics and populations, galaxy formation and evolution, large astronomical surveys.

    **Research Context:** Researcher interested in statistical learning and ML/AI methods broadly, with particular focus on interpretability and uncertainty quantification. Applies these methods primarily in astrophysics but values methodological advances independent of application domain.
    `,
    outputFormat: "arXiv ID, title, short author tag, brief relevance note explaining why this paper is relevant to my research interests, 2-3 paragraph technical summary of paper contents",
    maxDeepAnalysis: 30,
    finalOutputCount: 15,
    daysBack: 2, // Number of days to look back for papers
    selectedModel: 'claude-sonnet-4' // Default model
};

// Available AI models
const AVAILABLE_MODELS = [
    {
        id: 'claude-sonnet-4',
        name: 'Claude Sonnet 4',
        provider: 'Anthropic',
        supportsPDF: true,
        description: 'Fast and efficient for most tasks'
    },
    {
        id: 'claude-opus-4.1',
        name: 'Claude Opus 4.1',
        provider: 'Anthropic',
        supportsPDF: true,
        description: 'Most capable Claude model'
    },
    {
        id: 'gpt-5',
        name: 'OpenAI GPT-5',
        provider: 'OpenAI',
        supportsPDF: true,
        description: 'Most capable OpenAI model'
    },
    {
        id: 'gpt-5-mini',
        name: 'OpenAI GPT-5 Mini',
        provider: 'OpenAI',
        supportsPDF: true,
        description: 'Balanced performance and cost'
    },
    {
        id: 'gpt-5-nano',
        name: 'OpenAI GPT-5 Nano',
        provider: 'OpenAI',
        supportsPDF: true,
        description: 'Fastest and most cost-effective'
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        supportsPDF: true,
        description: 'Fast Google model'
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'Google',
        supportsPDF: true,
        description: 'Most capable Gemini model'
    }
];

// Main Application Component
function ArxivAnalyzer() {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [processing, setProcessing] = useState({
        stage: 'idle',
        progress: { current: 0, total: 0 },
        errors: [],
        isRunning: false,
        isPaused: false
    });
    const [results, setResults] = useState({
        allPapers: [],
        scoredPapers: [],
        finalRanking: []
    });
    const [showErrors, setShowErrors] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const abortControllerRef = useRef(null);
    const pauseRef = useRef(false);

    // Load saved state from localStorage
    useEffect(() => {
        const savedState = localStorage.getItem('arxivAnalyzerState');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.config) setConfig(parsed.config);
                if (parsed.results) setResults(parsed.results);
                if (parsed.password) {
                    setPassword(parsed.password);
                    setIsAuthenticated(true);
                }
            } catch (e) {
                console.error('Failed to load saved state:', e);
            }
        }
    }, []);

    // Save state to localStorage
    useEffect(() => {
        if (results.allPapers.length > 0 || results.scoredPapers.length > 0 || password) {
            localStorage.setItem('arxivAnalyzerState', JSON.stringify({
                config,
                results,
                password: isAuthenticated ? password : ''
            }));
        }
    }, [config, results, password, isAuthenticated]);

    // Add error to log
    const addError = useCallback((error) => {
        setProcessing(prev => ({
            ...prev,
            errors: [...prev.errors, `[${new Date().toLocaleTimeString()}] ${error}`]
        }));
    }, []);

    // Handle authentication
    const handleAuth = async () => {
        if (!password.trim()) {
            addError('Please enter a password');
            return;
        }

        try {
            // Test password with a simple API call
            const response = await fetch('/api/score-abstracts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    papers: [], // Empty test
                    scoringCriteria: '',
                    password: password
                })
            });

            if (response.status === 401) {
                addError('Invalid password');
                return;
            }

            setIsAuthenticated(true);
        } catch (error) {
            addError('Authentication failed');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setPassword('');
        localStorage.removeItem('arxivAnalyzerState');
    };

    // Fetch papers from arXiv
    const fetchPapers = async () => {
        setProcessing(prev => ({ ...prev, stage: 'fetching', progress: { current: 0, total: 1 } }));

        try {
            const categories = config.categories.split(',').map(c => c.trim()).filter(c => c);
            const categoriesQuery = categories.map(cat => `cat:${cat}`).join(' OR ');

            // Calculate date range
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - config.daysBack);

            const dateQuery = `submittedDate:[${startDate.toISOString().split('T')[0].replace(/-/g, '')}0000 TO ${endDate.toISOString().split('T')[0].replace(/-/g, '')}2359]`;

            const query = `${categoriesQuery} AND ${dateQuery}`;
            const maxResults = 200; // Fetch up to 200 recent papers

            const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`arXiv API error: ${response.status}`);

            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            const entries = xml.getElementsByTagName('entry');
            const papers = [];

            for (let entry of entries) {
                const getId = (entry) => {
                    const id = entry.getElementsByTagName('id')[0]?.textContent;
                    return id ? id.split('/abs/')[1] : '';
                };

                const getAuthors = (entry) => {
                    const authors = entry.getElementsByTagName('author');
                    return Array.from(authors).map(a =>
                        a.getElementsByTagName('name')[0]?.textContent || ''
                    );
                };

                papers.push({
                    id: getId(entry),
                    title: entry.getElementsByTagName('title')[0]?.textContent?.trim() || '',
                    abstract: entry.getElementsByTagName('summary')[0]?.textContent?.trim() || '',
                    authors: getAuthors(entry),
                    published: entry.getElementsByTagName('published')[0]?.textContent || '',
                    pdfUrl: `https://arxiv.org/pdf/${getId(entry)}.pdf`
                });
            }

            setResults(prev => ({ ...prev, allPapers: papers }));
            setProcessing(prev => ({ ...prev, progress: { current: 1, total: 1 } }));

            return papers;
        } catch (error) {
            addError(`Failed to fetch papers: ${error.message}`);
            throw error;
        }
    };

    // Score abstracts using chosen API
    const scoreAbstracts = async (papers) => {
        setProcessing(prev => ({ ...prev, stage: 'initial-scoring', progress: { current: 0, total: papers.length } }));

        const scoredPapers = [];
        const batchSize = 5; // Process 5 papers at a time

        for (let i = 0; i < papers.length; i += batchSize) {
            if (pauseRef.current) {
                await waitForResume();
            }

            const batch = papers.slice(i, Math.min(i + batchSize, papers.length));

            try {
                const response = await fetch('/api/score-abstracts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        papers: batch,
                        scoringCriteria: config.scoringCriteria,
                        password: password,
                        model: config.selectedModel
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `API error: ${response.status}`);
                }

                const data = await response.json();
                const scores = data.scores;

                scores.forEach((scoreData) => {
                    const paperIdx = scoreData.paperIndex - 1;
                    if (paperIdx >= 0 && paperIdx < batch.length) {
                        scoredPapers.push({
                            ...batch[paperIdx],
                            relevanceScore: scoreData.score,
                            scoreJustification: scoreData.justification
                        });
                    }
                });

                setProcessing(prev => ({
                    ...prev,
                    progress: { current: Math.min(i + batchSize, papers.length), total: papers.length }
                }));

                // Add delay between batches
                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (error) {
                addError(`Failed to score batch starting at paper ${i + 1}: ${error.message}`);
                // Add unscored papers with default score
                batch.forEach(p => {
                    scoredPapers.push({ ...p, relevanceScore: 0, scoreJustification: 'Failed to score' });
                });
            }
        }

        // Sort by relevance score
        scoredPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);
        setResults(prev => ({ ...prev, scoredPapers }));

        return scoredPapers;
    };

    // Deep analysis of PDFs
    const analyzePDFs = async (papers) => {
        setProcessing(prev => ({
            ...prev,
            stage: 'deep-analysis',
            progress: { current: 0, total: papers.length }
        }));

        const analyzedPapers = [];

        for (let i = 0; i < papers.length; i++) {
            if (pauseRef.current) {
                await waitForResume();
            }

            const paper = papers[i];

            try {
                const response = await fetch('/api/analyze-pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pdfUrl: paper.pdfUrl,
                        scoringCriteria: config.scoringCriteria,
                        originalScore: paper.relevanceScore,
                        originalJustification: paper.scoreJustification,
                        password: password,
                        model: config.selectedModel
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `API error: ${response.status}`);
                }

                const data = await response.json();
                const analysis = data.analysis;

                analyzedPapers.push({
                    ...paper,
                    deepAnalysis: analysis,
                    finalScore: analysis.updatedScore
                });

                setProcessing(prev => ({
                    ...prev,
                    progress: { current: i + 1, total: papers.length }
                }));

                // Add delay between API calls
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                addError(`Failed to analyze paper "${paper.title}": ${error.message}`);
                analyzedPapers.push({
                    ...paper,
                    deepAnalysis: null,
                    finalScore: paper.relevanceScore || 0
                });
            }
        }

        return analyzedPapers;
    };

    // Wait for resume when paused
    const waitForResume = () => {
        return new Promise((resolve) => {
            const checkPause = setInterval(() => {
                if (!pauseRef.current) {
                    clearInterval(checkPause);
                    resolve();
                }
            }, 100);
        });
    };

    // Main processing pipeline
    const startProcessing = async () => {
        setProcessing(prev => ({ ...prev, isRunning: true, isPaused: false, errors: [] }));
        pauseRef.current = false;
        abortControllerRef.current = new AbortController();

        try {
            // Stage 1: Fetch papers
            const papers = await fetchPapers();
            if (papers.length === 0) {
                addError('No papers found for specified categories');
                return;
            }

            // Stage 2: Score abstracts
            const scoredPapers = await scoreAbstracts(papers);

            // Stage 3: Select top papers for deep analysis
            setProcessing(prev => ({ ...prev, stage: 'selecting' }));
            const topPapers = scoredPapers.slice(0, config.maxDeepAnalysis);

            // Stage 4: Deep analysis
            const analyzedPapers = await analyzePDFs(topPapers);

            // Stage 5: Final ranking and output
            setProcessing(prev => ({ ...prev, stage: 'complete' }));

            // Sort by final score and select top papers
            analyzedPapers.sort((a, b) => b.finalScore - a.finalScore);
            const finalPapers = analyzedPapers.slice(0, config.finalOutputCount);

            setResults(prev => ({ ...prev, finalRanking: finalPapers }));

        } catch (error) {
            if (error.name !== 'AbortError') {
                addError(`Processing failed: ${error.message}`);
            }
        } finally {
            setProcessing(prev => ({
                ...prev,
                isRunning: false,
                isPaused: false,
                stage: results.finalRanking.length > 0 ? 'complete' : 'idle'
            }));
        }
    };

    // Control functions
    const handleStart = () => {
        startProcessing();
    };

    const handlePause = () => {
        pauseRef.current = true;
        setProcessing(prev => ({ ...prev, isPaused: true }));
    };

    const handleResume = () => {
        pauseRef.current = false;
        setProcessing(prev => ({ ...prev, isPaused: false }));
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        pauseRef.current = false;
        setProcessing(prev => ({
            ...prev,
            isRunning: false,
            isPaused: false,
            stage: 'idle'
        }));
    };

    const handleReset = () => {
        handleStop();
        setResults({ allPapers: [], scoredPapers: [], finalRanking: [] });
        setProcessing({
            stage: 'idle',
            progress: { current: 0, total: 0 },
            errors: [],
            isRunning: false,
            isPaused: false
        });
        localStorage.removeItem('arxivAnalyzerState');
    };

    // Export results
    const exportResults = () => {
        const output = results.finalRanking.map(paper => {
            const authorTag = paper.authors.length > 0 ?
                (paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(' & ')) :
                'Unknown';

            return `arXiv ID: ${paper.id}
Title: ${paper.title}
Authors: ${authorTag}
Relevance: ${paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}

Technical Summary:
${paper.deepAnalysis?.summary || 'No deep analysis available'}

Key Findings:
${paper.deepAnalysis?.keyFindings || 'N/A'}

—`;
        }).join('\n\n');

        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arxiv_analysis_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Get stage display name
    const getStageDisplay = () => {
        const stages = {
            'idle': 'Ready',
            'fetching': 'Fetching Papers',
            'initial-scoring': 'Scoring Abstracts',
            'selecting': 'Selecting Top Papers',
            'deep-analysis': 'Analyzing PDFs',
            'complete': 'Complete'
        };
        return stages[processing.stage] || processing.stage;
    };

    // Get stage progress percentage
    const getProgressPercentage = () => {
        if (processing.progress.total === 0) return 0;
        return Math.round((processing.progress.current / processing.progress.total) * 100);
    };

    // If not authenticated, show login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-center p-6">
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-8 border border-slate-800 max-w-md w-full">
                    <div className="text-center mb-6">
                        <Lock className="w-12 h-12 mx-auto mb-4 text-blue-400" />
                        <h1 className="text-2xl font-bold mb-2">aparture</h1>
                        <p className="text-gray-400">Enter password to access</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                placeholder="Enter password"
                            />
                        </div>

                        <button
                            onClick={handleAuth}
                            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
                        >
                            Access Analyzer
                        </button>
                    </div>

                    {processing.errors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                            <p className="text-red-300 text-sm">{processing.errors[processing.errors.length - 1]}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            aparture
                        </h1>
                        <p className="text-gray-400">Bringing the arXiv into focus</p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="px-3 py-2 bg-slate-700 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Unlock className="w-4 h-4" />
                        Logout
                    </button>
                </div>

                {/* Configuration Panel */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                    <div className="flex items-center mb-4">
                        <Settings className="w-5 h-5 mr-2 text-blue-400" />
                        <h2 className="text-xl font-semibold">Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                ArXiv Categories (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={config.categories}
                                onChange={(e) => setConfig(prev => ({ ...prev, categories: e.target.value }))}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                placeholder="cs.LG, cs.AI, stat.ML..."
                                disabled={processing.isRunning}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                AI Model
                            </label>
                            <select
                                value={config.selectedModel}
                                onChange={(e) => setConfig(prev => ({ ...prev, selectedModel: e.target.value }))}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                disabled={processing.isRunning}
                            >
                                {AVAILABLE_MODELS.map(model => (
                                    <option key={model.id} value={model.id}>
                                        {model.name} ({model.provider})
                                    </option>
                                ))}
                            </select>
                            <div className="mt-2 p-3 bg-slate-800/50 rounded-lg">
                                <p className="text-xs text-gray-400 mb-2">
                                    <strong>Selected:</strong> {AVAILABLE_MODELS.find(m => m.id === config.selectedModel)?.name}
                                </p>
                                <p className="text-xs text-gray-300">
                                    {AVAILABLE_MODELS.find(m => m.id === config.selectedModel)?.description}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Scoring Criteria (Research Interests)
                            </label>
                            <textarea
                                value={config.scoringCriteria}
                                onChange={(e) => setConfig(prev => ({ ...prev, scoringCriteria: e.target.value }))}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white h-32 resize-none"
                                placeholder="Describe your research interests..."
                                disabled={processing.isRunning}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Output Format Preferences
                            </label>
                            <input
                                type="text"
                                value={config.outputFormat}
                                onChange={(e) => setConfig(prev => ({ ...prev, outputFormat: e.target.value }))}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                disabled={processing.isRunning}
                            />
                        </div>

                        {/* Advanced Options */}
                        <div>
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                {showAdvanced ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                                Advanced Options
                            </button>

                            {showAdvanced && (
                                <div className="mt-3 space-y-3 pl-5 border-l-2 border-slate-700">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                                Days to Look Back
                                            </label>
                                            <input
                                                type="number"
                                                value={config.daysBack}
                                                onChange={(e) => setConfig(prev => ({ ...prev, daysBack: parseInt(e.target.value) || 7 }))}
                                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                min="1"
                                                max="30"
                                                disabled={processing.isRunning}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                                Max Papers for Deep Analysis
                                            </label>
                                            <input
                                                type="number"
                                                value={config.maxDeepAnalysis}
                                                onChange={(e) => setConfig(prev => ({ ...prev, maxDeepAnalysis: parseInt(e.target.value) || 30 }))}
                                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                min="1"
                                                max="100"
                                                disabled={processing.isRunning}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                                Final Output Count
                                            </label>
                                            <input
                                                type="number"
                                                value={config.finalOutputCount}
                                                onChange={(e) => setConfig(prev => ({ ...prev, finalOutputCount: parseInt(e.target.value) || 15 }))}
                                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                min="1"
                                                max="50"
                                                disabled={processing.isRunning}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Control Panel */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex gap-3">
                            {!processing.isRunning && (
                                <button
                                    onClick={handleStart}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all flex items-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    Start Analysis
                                </button>
                            )}

                            {processing.isRunning && !processing.isPaused && (
                                <button
                                    onClick={handlePause}
                                    className="px-4 py-2 bg-yellow-500 rounded-lg font-medium hover:bg-yellow-600 transition-colors flex items-center gap-2"
                                >
                                    <Pause className="w-4 h-4" />
                                    Pause
                                </button>
                            )}

                            {processing.isRunning && processing.isPaused && (
                                <button
                                    onClick={handleResume}
                                    className="px-4 py-2 bg-green-500 rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    Resume
                                </button>
                            )}

                            {processing.isRunning && (
                                <button
                                    onClick={handleStop}
                                    className="px-4 py-2 bg-red-500 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                                >
                                    <Square className="w-4 h-4" />
                                    Stop
                                </button>
                            )}

                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-slate-700 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>
                        </div>

                        {results.finalRanking.length > 0 && (
                            <button
                                onClick={exportResults}
                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Export Results
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Tracker */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                    <div className="flex items-center mb-4">
                        <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                        <h2 className="text-xl font-semibold">Progress</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300">Current Stage:</span>
                            <span className="font-medium flex items-center gap-2">
                                {processing.isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                                {getStageDisplay()}
                                {processing.isPaused && <span className="text-yellow-400">(Paused)</span>}
                            </span>
                        </div>

                        {processing.progress.total > 0 && (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm text-gray-400">
                                        <span>Progress</span>
                                        <span>{processing.progress.current} / {processing.progress.total} papers</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
                                            style={{ width: `${getProgressPercentage()}%` }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Error Log */}
                        {processing.errors.length > 0 && (
                            <div>
                                <button
                                    onClick={() => setShowErrors(!showErrors)}
                                    className="flex items-center text-sm text-red-400 hover:text-red-300 transition-colors"
                                >
                                    <AlertCircle className="w-4 h-4 mr-1" />
                                    {showErrors ? 'Hide' : 'Show'} Errors ({processing.errors.length})
                                </button>

                                {showErrors && (
                                    <div className="mt-2 max-h-40 overflow-y-auto bg-slate-800 rounded-lg p-3 text-xs text-red-300 font-mono">
                                        {processing.errors.map((error, idx) => (
                                            <div key={idx} className="mb-1">{error}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Display */}
                {(results.scoredPapers.length > 0 || results.finalRanking.length > 0) && (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 border border-slate-800">
                        <div className="flex items-center mb-4">
                            <FileText className="w-5 h-5 mr-2 text-green-400" />
                            <h2 className="text-xl font-semibold">
                                {results.finalRanking.length > 0 ? 'Final Results' : 'Scored Papers'}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {(results.finalRanking.length > 0 ? results.finalRanking : results.scoredPapers.slice(0, 15)).map((paper, idx) => (
                                <div key={paper.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                                                    Score: {paper.finalScore || paper.relevanceScore}/10
                                                </span>
                                                <a
                                                    href={`https://arxiv.org/abs/${paper.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded hover:bg-slate-600 transition-colors"
                                                >
                                                    arXiv:{paper.id}
                                                </a>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white mb-1">{paper.title}</h3>
                                            <p className="text-sm text-gray-400 mb-2">
                                                {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
                                            </p>
                                            <p className="text-sm text-gray-300 italic mb-2">
                                                {paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}
                                            </p>
                                            {paper.deepAnalysis && (
                                                <div className="mt-3 pt-3 border-t border-slate-700">
                                                    <p className="text-sm text-gray-300 leading-relaxed">
                                                        {paper.deepAnalysis.summary}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ArxivAnalyzer;