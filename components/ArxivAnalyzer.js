import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, Download, FileText, Loader2, Lock, Pause, Play, RotateCcw, Settings, Square, TestTube, Unlock, XCircle, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MockAPITester, TEST_PAPERS, generateTestReport } from '../utils/testUtils';

// Complete arXiv category taxonomy
const ARXIV_CATEGORIES = {
    "Computer Science": {
        prefix: "cs",
        subcategories: {
            "AI": { code: "cs.AI", name: "Artificial Intelligence" },
            "AR": { code: "cs.AR", name: "Hardware Architecture" },
            "CC": { code: "cs.CC", name: "Computational Complexity" },
            "CE": { code: "cs.CE", name: "Computational Engineering, Finance, and Science" },
            "CG": { code: "cs.CG", name: "Computational Geometry" },
            "CL": { code: "cs.CL", name: "Computation and Language" },
            "CR": { code: "cs.CR", name: "Cryptography and Security" },
            "CV": { code: "cs.CV", name: "Computer Vision and Pattern Recognition" },
            "CY": { code: "cs.CY", name: "Computers and Society" },
            "DB": { code: "cs.DB", name: "Databases" },
            "DC": { code: "cs.DC", name: "Distributed, Parallel, and Cluster Computing" },
            "DL": { code: "cs.DL", name: "Digital Libraries" },
            "DM": { code: "cs.DM", name: "Discrete Mathematics" },
            "DS": { code: "cs.DS", name: "Data Structures and Algorithms" },
            "ET": { code: "cs.ET", name: "Emerging Technologies" },
            "FL": { code: "cs.FL", name: "Formal Languages and Automata Theory" },
            "GL": { code: "cs.GL", name: "General Literature" },
            "GR": { code: "cs.GR", name: "Graphics" },
            "GT": { code: "cs.GT", name: "Computer Science and Game Theory" },
            "HC": { code: "cs.HC", name: "Human-Computer Interaction" },
            "IR": { code: "cs.IR", name: "Information Retrieval" },
            "IT": { code: "cs.IT", name: "Information Theory" },
            "LG": { code: "cs.LG", name: "Machine Learning" },
            "LO": { code: "cs.LO", name: "Logic in Computer Science" },
            "MA": { code: "cs.MA", name: "Multiagent Systems" },
            "MM": { code: "cs.MM", name: "Multimedia" },
            "MS": { code: "cs.MS", name: "Mathematical Software" },
            "NA": { code: "cs.NA", name: "Numerical Analysis" },
            "NE": { code: "cs.NE", name: "Neural and Evolutionary Computing" },
            "NI": { code: "cs.NI", name: "Networking and Internet Architecture" },
            "OH": { code: "cs.OH", name: "Other Computer Science" },
            "OS": { code: "cs.OS", name: "Operating Systems" },
            "PF": { code: "cs.PF", name: "Performance" },
            "PL": { code: "cs.PL", name: "Programming Languages" },
            "RO": { code: "cs.RO", name: "Robotics" },
            "SC": { code: "cs.SC", name: "Symbolic Computation" },
            "SD": { code: "cs.SD", name: "Sound" },
            "SE": { code: "cs.SE", name: "Software Engineering" },
            "SI": { code: "cs.SI", name: "Social and Information Networks" },
            "SY": { code: "cs.SY", name: "Systems and Control" }
        }
    },
    "Mathematics": {
        prefix: "math",
        subcategories: {
            "AC": { code: "math.AC", name: "Commutative Algebra" },
            "AG": { code: "math.AG", name: "Algebraic Geometry" },
            "AP": { code: "math.AP", name: "Analysis of PDEs" },
            "AT": { code: "math.AT", name: "Algebraic Topology" },
            "CA": { code: "math.CA", name: "Classical Analysis and ODEs" },
            "CO": { code: "math.CO", name: "Combinatorics" },
            "CT": { code: "math.CT", name: "Category Theory" },
            "CV": { code: "math.CV", name: "Complex Variables" },
            "DG": { code: "math.DG", name: "Differential Geometry" },
            "DS": { code: "math.DS", name: "Dynamical Systems" },
            "FA": { code: "math.FA", name: "Functional Analysis" },
            "GM": { code: "math.GM", name: "General Mathematics" },
            "GN": { code: "math.GN", name: "General Topology" },
            "GR": { code: "math.GR", name: "Group Theory" },
            "GT": { code: "math.GT", name: "Geometric Topology" },
            "HO": { code: "math.HO", name: "History and Overview" },
            "IT": { code: "math.IT", name: "Information Theory" },
            "KT": { code: "math.KT", name: "K-Theory and Homology" },
            "LO": { code: "math.LO", name: "Logic" },
            "MG": { code: "math.MG", name: "Metric Geometry" },
            "MP": { code: "math.MP", name: "Mathematical Physics" },
            "NA": { code: "math.NA", name: "Numerical Analysis" },
            "NT": { code: "math.NT", name: "Number Theory" },
            "OA": { code: "math.OA", name: "Operator Algebras" },
            "OC": { code: "math.OC", name: "Optimization and Control" },
            "PR": { code: "math.PR", name: "Probability" },
            "QA": { code: "math.QA", name: "Quantum Algebra" },
            "RA": { code: "math.RA", name: "Rings and Algebras" },
            "RT": { code: "math.RT", name: "Representation Theory" },
            "SG": { code: "math.SG", name: "Symplectic Geometry" },
            "SP": { code: "math.SP", name: "Spectral Theory" },
            "ST": { code: "math.ST", name: "Statistics Theory" }
        }
    },
    "Physics": {
        prefix: "physics",
        subcategories: {
            "acc-ph": { code: "physics.acc-ph", name: "Accelerator Physics" },
            "app-ph": { code: "physics.app-ph", name: "Applied Physics" },
            "ao-ph": { code: "physics.ao-ph", name: "Atmospheric and Oceanic Physics" },
            "atom-ph": { code: "physics.atom-ph", name: "Atomic Physics" },
            "atm-clus": { code: "physics.atm-clus", name: "Atomic and Molecular Clusters" },
            "bio-ph": { code: "physics.bio-ph", name: "Biological Physics" },
            "chem-ph": { code: "physics.chem-ph", name: "Chemical Physics" },
            "class-ph": { code: "physics.class-ph", name: "Classical Physics" },
            "comp-ph": { code: "physics.comp-ph", name: "Computational Physics" },
            "data-an": { code: "physics.data-an", name: "Data Analysis, Statistics and Probability" },
            "ed-ph": { code: "physics.ed-ph", name: "Physics Education" },
            "flu-dyn": { code: "physics.flu-dyn", name: "Fluid Dynamics" },
            "gen-ph": { code: "physics.gen-ph", name: "General Physics" },
            "geo-ph": { code: "physics.geo-ph", name: "Geophysics" },
            "hist-ph": { code: "physics.hist-ph", name: "History and Philosophy of Physics" },
            "ins-det": { code: "physics.ins-det", name: "Instrumentation and Detectors" },
            "med-ph": { code: "physics.med-ph", name: "Medical Physics" },
            "optics": { code: "physics.optics", name: "Optics" },
            "plasm-ph": { code: "physics.plasm-ph", name: "Plasma Physics" },
            "pop-ph": { code: "physics.pop-ph", name: "Popular Physics" },
            "soc-ph": { code: "physics.soc-ph", name: "Physics and Society" },
            "space-ph": { code: "physics.space-ph", name: "Space Physics" }
        }
    },
    "Astrophysics": {
        prefix: "astro-ph",
        subcategories: {
            "CO": { code: "astro-ph.CO", name: "Cosmology and Nongalactic Astrophysics" },
            "EP": { code: "astro-ph.EP", name: "Earth and Planetary Astrophysics" },
            "GA": { code: "astro-ph.GA", name: "Astrophysics of Galaxies" },
            "HE": { code: "astro-ph.HE", name: "High Energy Astrophysical Phenomena" },
            "IM": { code: "astro-ph.IM", name: "Instrumentation and Methods for Astrophysics" },
            "SR": { code: "astro-ph.SR", name: "Solar and Stellar Astrophysics" }
        }
    },
    "Condensed Matter": {
        prefix: "cond-mat",
        subcategories: {
            "dis-nn": { code: "cond-mat.dis-nn", name: "Disordered Systems and Neural Networks" },
            "mtrl-sci": { code: "cond-mat.mtrl-sci", name: "Materials Science" },
            "mes-hall": { code: "cond-mat.mes-hall", name: "Mesoscale and Nanoscale Physics" },
            "other": { code: "cond-mat.other", name: "Other Condensed Matter" },
            "quant-gas": { code: "cond-mat.quant-gas", name: "Quantum Gases" },
            "soft": { code: "cond-mat.soft", name: "Soft Condensed Matter" },
            "stat-mech": { code: "cond-mat.stat-mech", name: "Statistical Mechanics" },
            "str-el": { code: "cond-mat.str-el", name: "Strongly Correlated Electrons" },
            "supr-con": { code: "cond-mat.supr-con", name: "Superconductivity" }
        }
    },
    "High Energy Physics": {
        prefix: "hep",
        subcategories: {
            "ex": { code: "hep-ex", name: "High Energy Physics - Experiment" },
            "lat": { code: "hep-lat", name: "High Energy Physics - Lattice" },
            "ph": { code: "hep-ph", name: "High Energy Physics - Phenomenology" },
            "th": { code: "hep-th", name: "High Energy Physics - Theory" }
        }
    },
    "Nonlinear Sciences": {
        prefix: "nlin",
        subcategories: {
            "AO": { code: "nlin.AO", name: "Adaptation and Self-Organizing Systems" },
            "CG": { code: "nlin.CG", name: "Cellular Automata and Lattice Gases" },
            "CD": { code: "nlin.CD", name: "Chaotic Dynamics" },
            "SI": { code: "nlin.SI", name: "Exactly Solvable and Integrable Systems" },
            "PS": { code: "nlin.PS", name: "Pattern Formation and Solitons" }
        }
    },
    "Quantitative Biology": {
        prefix: "q-bio",
        subcategories: {
            "BM": { code: "q-bio.BM", name: "Biomolecules" },
            "CB": { code: "q-bio.CB", name: "Cell Behavior" },
            "GN": { code: "q-bio.GN", name: "Genomics" },
            "MN": { code: "q-bio.MN", name: "Molecular Networks" },
            "NC": { code: "q-bio.NC", name: "Neurons and Cognition" },
            "OT": { code: "q-bio.OT", name: "Other Quantitative Biology" },
            "PE": { code: "q-bio.PE", name: "Populations and Evolution" },
            "QM": { code: "q-bio.QM", name: "Quantitative Methods" },
            "SC": { code: "q-bio.SC", name: "Subcellular Processes" },
            "TO": { code: "q-bio.TO", name: "Tissues and Organs" }
        }
    },
    "Quantitative Finance": {
        prefix: "q-fin",
        subcategories: {
            "CP": { code: "q-fin.CP", name: "Computational Finance" },
            "EC": { code: "q-fin.EC", name: "Economics" },
            "GN": { code: "q-fin.GN", name: "General Finance" },
            "MF": { code: "q-fin.MF", name: "Mathematical Finance" },
            "PM": { code: "q-fin.PM", name: "Portfolio Management" },
            "PR": { code: "q-fin.PR", name: "Pricing of Securities" },
            "RM": { code: "q-fin.RM", name: "Risk Management" },
            "ST": { code: "q-fin.ST", name: "Statistical Finance" },
            "TR": { code: "q-fin.TR", name: "Trading and Market Microstructure" }
        }
    },
    "Statistics": {
        prefix: "stat",
        subcategories: {
            "AP": { code: "stat.AP", name: "Applications" },
            "CO": { code: "stat.CO", name: "Computation" },
            "ME": { code: "stat.ME", name: "Methodology" },
            "ML": { code: "stat.ML", name: "Machine Learning" },
            "OT": { code: "stat.OT", name: "Other Statistics" },
            "TH": { code: "stat.TH", name: "Statistics Theory" }
        }
    },
    "Electrical Engineering and Systems Science": {
        prefix: "eess",
        subcategories: {
            "AS": { code: "eess.AS", name: "Audio and Speech Processing" },
            "IV": { code: "eess.IV", name: "Image and Video Processing" },
            "SP": { code: "eess.SP", name: "Signal Processing" },
            "SY": { code: "eess.SY", name: "Systems and Control" }
        }
    },
    "Single Categories": {
        prefix: "",
        subcategories: {
            "gr-qc": { code: "gr-qc", name: "General Relativity and Quantum Cosmology" },
            "math-ph": { code: "math-ph", name: "Mathematical Physics" },
            "nucl-ex": { code: "nucl-ex", name: "Nuclear Experiment" },
            "nucl-th": { code: "nucl-th", name: "Nuclear Theory" },
            "quant-ph": { code: "quant-ph", name: "Quantum Physics" },
            "econ": { code: "econ", name: "Economics" }
        }
    }
};

// Default configuration
const DEFAULT_CONFIG = {
    version: 2,
    selectedCategories: ["cs.AI", "cs.CL", "cs.CV", "cs.IR", "cs.LG", "cs.MA", "cs.NE", "stat.AP", "stat.CO", "stat.ME", "stat.ML", "stat.OT", "stat.TH", "astro-ph.CO", "astro-ph.EP", "astro-ph.GA", "astro-ph.HE", "astro-ph.IM", "astro-ph.SR"],
    scoringCriteria: `
    **AI/ML (Broad Interest):** Deep learning advances, general ML methods, mechanistic interpretability, trustworthy AI, statistical learning theory, probabilistic ML, AI for scientific discovery.  

    **Statistics, Computation, and Inference:** Sampling and approximate inference methods, uncertainty quantification, time series analysis, state space models, hierarchical modeling, scalable inference.

    **Astrophysics Applications:** Galactic structure and dynamics, stellar astrophysics and populations, galaxy formation and evolution, large astronomical surveys.

    **Research Context:** Researcher interested in statistical learning and ML/AI methods broadly, with particular focus on interpretability and uncertainty quantification. Applies these methods primarily in astrophysics but values methodological advances independent of application domain.
    `,
    maxDeepAnalysis: 30,
    finalOutputCount: 15,
    daysBack: 2,
    batchSize: 5,
    maxCorrections: 1,
    maxRetries: 1,
    screeningModel: 'claude-sonnet-4',
    deepAnalysisModel: 'claude-sonnet-4'
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
    const [processingTiming, setProcessingTiming] = useState({
        startTime: null,
        endTime: null,
        duration: null
    });
    const [testState, setTestState] = useState({
        dryRunCompleted: false,
        dryRunInProgress: false,
        minimalTestInProgress: false,
        lastDryRunTime: null,
        lastMinimalTestTime: null
    });
    const [showErrors, setShowErrors] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [showTestDropdown, setShowTestDropdown] = useState(false);

    const abortControllerRef = useRef(null);
    const pauseRef = useRef(false);
    const dropdownRef = useRef(null);
    const mockAPITesterRef = useRef(new MockAPITester());

    // Handle clicks outside dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowCategoryDropdown(false);
                setExpandedCategory(null);
            }
        };

        if (showCategoryDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showCategoryDropdown]);

    // Load saved state from localStorage
    useEffect(() => {
        const savedState = localStorage.getItem('arxivAnalyzerState');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.config) {
                    // Handle backward compatibility: convert old categories string to selectedCategories array
                    if (parsed.config.categories && !parsed.config.selectedCategories) {
                        const categoriesArray = parsed.config.categories.split(',').map(c => c.trim()).filter(c => c);
                        parsed.config.selectedCategories = categoriesArray;
                        delete parsed.config.categories;
                    }

                    // Check if saved config is from an older version
                    if (!parsed.config.version || parsed.config.version < DEFAULT_CONFIG.version) {
                        // Use fresh defaults for outdated configs
                        setConfig(DEFAULT_CONFIG);
                    } else {
                        // Handle migration from single model to dual model setup
                        if (parsed.config.selectedModel && !parsed.config.screeningModel) {
                            parsed.config.screeningModel = 'claude-sonnet-4';
                            parsed.config.deepAnalysisModel = parsed.config.selectedModel;
                            delete parsed.config.selectedModel;
                        }

                        // Merge saved config with new defaults to pick up any new default values
                        const mergedConfig = {
                            ...DEFAULT_CONFIG,
                            ...parsed.config,
                        };
                        setConfig(mergedConfig);
                    }
                }
                if (parsed.results) setResults(parsed.results);
                if (parsed.processingTiming) setProcessingTiming(parsed.processingTiming);
                if (parsed.testState) setTestState(parsed.testState);
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
                processingTiming,
                testState,
                password: isAuthenticated ? password : ''
            }));
        }
    }, [config, results, processingTiming, testState, password, isAuthenticated]);

    // Add error to log
    const addError = useCallback((error) => {
        setProcessing(prev => ({
            ...prev,
            errors: [...prev.errors, `[${new Date().toLocaleTimeString()}] ${error}`]
        }));
    }, []);

    // Category management functions
    const addCategory = useCallback((categoryCode) => {
        setConfig(prev => ({
            ...prev,
            selectedCategories: [...new Set([...prev.selectedCategories, categoryCode])]
        }));
    }, []);

    const removeCategory = useCallback((categoryCode) => {
        setConfig(prev => ({
            ...prev,
            selectedCategories: prev.selectedCategories.filter(cat => cat !== categoryCode)
        }));
    }, []);

    const addMainCategory = useCallback((mainCategoryName) => {
        const categoryData = ARXIV_CATEGORIES[mainCategoryName];
        if (!categoryData) return;

        const newCategories = [];

        if (categoryData.prefix === "") {
            Object.values(categoryData.subcategories).forEach(subcat => {
                newCategories.push(subcat.code);
            });
        } else {
            Object.values(categoryData.subcategories).forEach(subcat => {
                newCategories.push(subcat.code);
            });
        }

        setConfig(prev => ({
            ...prev,
            selectedCategories: [...new Set([...prev.selectedCategories, ...newCategories])]
        }));
    }, []);

    const getCategoryDisplayName = useCallback((categoryCode) => {
        for (const [mainName, mainData] of Object.entries(ARXIV_CATEGORIES)) {
            for (const [subKey, subData] of Object.entries(mainData.subcategories)) {
                if (subData.code === categoryCode) {
                    if (mainName === "Single Categories") {
                        return subData.name;
                    }
                    return `${mainName}: ${subData.name}`;
                }
            }
        }
        return categoryCode;
    }, []);

    // Robust API call with retry and correction logic
    const makeRobustAPICall = useCallback(async (apiCallFunction, parseFunction, context = "", originalPromptInfo = "") => {
        let lastError = null;

        for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
            try {
                let responseText = await apiCallFunction();

                try {
                    const result = parseFunction(responseText);
                    return result;
                } catch (parseError) {
                    lastError = parseError;
                    addError(`${context} - Initial parse failed: ${parseError.message}`);
                }

                for (let correctionCount = 1; correctionCount <= config.maxCorrections; correctionCount++) {
                    try {
                        addError(`${context} - Attempting correction ${correctionCount}/${config.maxCorrections}`);

                        const correctionPrompt = `The previous response was not in the correct format. Here is the malformed output:

${responseText}

Please fix the formatting and return ONLY valid JSON. The error was: ${lastError.message}

${originalPromptInfo ? `Original task: ${originalPromptInfo}` : ''}

Your entire response MUST ONLY be a single, valid JSON object/array. DO NOT respond with anything other than valid JSON.`;

                        responseText = await apiCallFunction(correctionPrompt, true);

                        const result = parseFunction(responseText);
                        addError(`${context} - Correction ${correctionCount} succeeded`);
                        return result;

                    } catch (correctionError) {
                        lastError = correctionError;
                        addError(`${context} - Correction ${correctionCount} failed: ${correctionError.message}`);
                    }
                }

                if (retryCount < config.maxRetries) {
                    addError(`${context} - All corrections failed, attempting full retry ${retryCount + 1}/${config.maxRetries}`);
                } else {
                    throw new Error(`All retries and corrections exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
                }

            } catch (apiError) {
                lastError = apiError;
                if (retryCount < config.maxRetries) {
                    addError(`${context} - API call failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw apiError;
                }
            }
        }

        throw lastError;
    }, [config.maxRetries, config.maxCorrections, addError]);

    // Mock robust API call for dry run tests
    const makeMockRobustAPICall = useCallback(async (mockApiFunction, parseFunction, context = "") => {
        let lastError = null;

        for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
            try {
                let responseText = await mockApiFunction();

                try {
                    const result = parseFunction(responseText);
                    return result;
                } catch (parseError) {
                    lastError = parseError;
                    addError(`${context} - Mock parse failed: ${parseError.message}`);
                }

                for (let correctionCount = 1; correctionCount <= config.maxCorrections; correctionCount++) {
                    try {
                        addError(`${context} - Mock correction ${correctionCount}/${config.maxCorrections}`);
                        responseText = await mockApiFunction(true); // Pass isCorrection = true
                        const result = parseFunction(responseText);
                        addError(`${context} - Mock correction ${correctionCount} succeeded`);
                        return result;
                    } catch (correctionError) {
                        lastError = correctionError;
                        addError(`${context} - Mock correction ${correctionCount} failed: ${correctionError.message}`);
                    }
                }

                if (retryCount < config.maxRetries) {
                    addError(`${context} - Mock corrections failed, retry ${retryCount + 1}/${config.maxRetries}`);
                } else {
                    throw new Error(`Mock retries exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
                }

            } catch (apiError) {
                lastError = apiError;
                if (retryCount < config.maxRetries) {
                    addError(`${context} - Mock API failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    throw apiError;
                }
            }
        }

        throw lastError;
    }, [config.maxRetries, config.maxCorrections, addError]);

    // Handle authentication
    const handleAuth = async () => {
        if (!password.trim()) {
            addError('Please enter a password');
            return;
        }

        try {
            const response = await fetch('/api/score-abstracts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    papers: [],
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
            const categories = config.selectedCategories.filter(cat => cat.trim());
            if (categories.length === 0) {
                throw new Error('No categories selected');
            }

            const categoriesQuery = categories.map(cat => `cat:${cat}`).join(' OR ');

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - config.daysBack);

            const dateQuery = `submittedDate:[${startDate.toISOString().split('T')[0].replace(/-/g, '')}0000 TO ${endDate.toISOString().split('T')[0].replace(/-/g, '')}2359]`;

            const query = `${categoriesQuery} AND ${dateQuery}`;
            const maxResults = 1000;

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

    // Score abstracts using chosen API (or mock for dry run)
    const scoreAbstracts = async (papers, isDryRun = false) => {
        setProcessing(prev => ({ ...prev, stage: 'initial-scoring', progress: { current: 0, total: papers.length } }));

        const scoredPapers = [];
        const batchSize = config.batchSize;

        for (let i = 0; i < papers.length; i += batchSize) {
            if (pauseRef.current) {
                await waitForResume();
            }

            const batch = papers.slice(i, Math.min(i + batchSize, papers.length));

            try {
                let scores;

                if (isDryRun) {
                    // Use mock API for dry run
                    const mockApiCall = async (isCorrection = false) => {
                        return await mockAPITesterRef.current.mockScoreAbstracts(batch, isCorrection);
                    };

                    const parseResponse = (responseText) => {
                        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const scores = JSON.parse(cleanedText);

                        if (!Array.isArray(scores)) {
                            throw new Error("Response is not an array");
                        }

                        scores.forEach((score, idx) => {
                            if (!score.hasOwnProperty('paperIndex') || !score.hasOwnProperty('score') || !score.hasOwnProperty('justification')) {
                                throw new Error(`Score object ${idx} missing required fields`);
                            }
                            if (typeof score.paperIndex !== 'number' || typeof score.score !== 'number' || typeof score.justification !== 'string') {
                                throw new Error(`Score object ${idx} has invalid field types`);
                            }
                        });

                        return scores;
                    };

                    scores = await makeMockRobustAPICall(
                        mockApiCall,
                        parseResponse,
                        `Mock scoring batch ${Math.floor(i / batchSize) + 1}`
                    );
                } else {
                    // Use real API for production
                    const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
                        const requestBody = {
                            papers: batch,
                            scoringCriteria: config.scoringCriteria,
                            password: password,
                            model: config.screeningModel
                        };

                        if (isCorrection && correctionPrompt) {
                            requestBody.correctionPrompt = correctionPrompt;
                        }

                        const response = await fetch('/api/score-abstracts', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody)
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `API error: ${response.status}`);
                        }

                        const data = await response.json();
                        return data.rawResponse || JSON.stringify(data.scores || data);
                    };

                    const parseResponse = (responseText) => {
                        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const scores = JSON.parse(cleanedText);

                        if (!Array.isArray(scores)) {
                            throw new Error("Response is not an array");
                        }

                        scores.forEach((score, idx) => {
                            if (!score.hasOwnProperty('paperIndex') || !score.hasOwnProperty('score') || !score.hasOwnProperty('justification')) {
                                throw new Error(`Score object ${idx} missing required fields`);
                            }
                            if (typeof score.paperIndex !== 'number' || typeof score.score !== 'number' || typeof score.justification !== 'string') {
                                throw new Error(`Score object ${idx} has invalid field types`);
                            }
                        });

                        return scores;
                    };

                    scores = await makeRobustAPICall(
                        makeAPICall,
                        parseResponse,
                        `Scoring batch ${Math.floor(i / batchSize) + 1}`,
                        `Score ${batch.length} paper abstracts for relevance using the provided criteria`
                    );
                }

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

                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (error) {
                addError(`Failed to score batch starting at paper ${i + 1} after all retries: ${error.message}`);
                batch.forEach(p => {
                    scoredPapers.push({ ...p, relevanceScore: 0, scoreJustification: 'Failed to score after retries' });
                });
            }
        }

        scoredPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);
        setResults(prev => ({ ...prev, scoredPapers }));

        return scoredPapers;
    };

    // Deep analysis of PDFs (or mock for dry run)
    const analyzePDFs = async (papers, isDryRun = false) => {
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
                let analysis;

                if (isDryRun) {
                    // Use mock API for dry run
                    const mockApiCall = async (isCorrection = false) => {
                        return await mockAPITesterRef.current.mockAnalyzePDF(paper, isCorrection);
                    };

                    const parseResponse = (responseText) => {
                        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const analysis = JSON.parse(cleanedText);

                        if (!analysis.summary || typeof analysis.updatedScore === 'undefined') {
                            throw new Error("Missing required fields (summary or updatedScore) in analysis response");
                        }

                        if (typeof analysis.summary !== 'string') {
                            throw new Error("Summary field must be a string");
                        }
                        if (typeof analysis.updatedScore !== 'number') {
                            throw new Error("UpdatedScore field must be a number");
                        }

                        return analysis;
                    };

                    analysis = await makeMockRobustAPICall(
                        mockApiCall,
                        parseResponse,
                        `Mock analyzing paper "${paper.title}"`
                    );
                } else {
                    // Use real API for production
                    const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
                        const requestBody = {
                            pdfUrl: paper.pdfUrl,
                            scoringCriteria: config.scoringCriteria,
                            originalScore: paper.relevanceScore,
                            originalJustification: paper.scoreJustification,
                            password: password,
                            model: config.deepAnalysisModel
                        };

                        if (isCorrection && correctionPrompt) {
                            requestBody.correctionPrompt = correctionPrompt;
                        }

                        const response = await fetch('/api/analyze-pdf', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody)
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `API error: ${response.status}`);
                        }

                        const data = await response.json();
                        return data.rawResponse || JSON.stringify(data.analysis || data);
                    };

                    const parseResponse = (responseText) => {
                        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const analysis = JSON.parse(cleanedText);

                        if (!analysis.summary || typeof analysis.updatedScore === 'undefined') {
                            throw new Error("Missing required fields (summary or updatedScore) in analysis response");
                        }

                        if (typeof analysis.summary !== 'string') {
                            throw new Error("Summary field must be a string");
                        }
                        if (typeof analysis.updatedScore !== 'number') {
                            throw new Error("UpdatedScore field must be a number");
                        }

                        return analysis;
                    };

                    analysis = await makeRobustAPICall(
                        makeAPICall,
                        parseResponse,
                        `Analyzing paper "${paper.title}"`,
                        `Analyze PDF content and provide updated relevance score with detailed summary`
                    );
                }

                analyzedPapers.push({
                    ...paper,
                    deepAnalysis: analysis,
                    finalScore: analysis.updatedScore
                });

                setProcessing(prev => ({
                    ...prev,
                    progress: { current: i + 1, total: papers.length }
                }));

                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                addError(`Failed to analyze paper "${paper.title}" after all retries: ${error.message}`);
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
    const startProcessing = async (isDryRun = false, useTestPapers = false) => {
        const startTime = new Date();
        setProcessingTiming({ startTime, endTime: null, duration: null });
        setProcessing(prev => ({ ...prev, isRunning: true, isPaused: false, errors: [] }));
        pauseRef.current = false;
        abortControllerRef.current = new AbortController();

        try {
            let papers;

            if (useTestPapers) {
                // Use hardcoded test papers for minimal test
                setProcessing(prev => ({ ...prev, stage: 'fetching' }));
                papers = TEST_PAPERS;
                setResults(prev => ({ ...prev, allPapers: papers }));
            } else {
                // Stage 1: Fetch papers from arXiv
                papers = await fetchPapers();
                if (papers.length === 0) {
                    addError('No papers found for specified categories');
                    return;
                }
            }

            // Stage 2: Score abstracts
            const scoredPapers = await scoreAbstracts(papers, isDryRun);

            // Stage 3: Select top papers for deep analysis
            setProcessing(prev => ({ ...prev, stage: 'selecting' }));
            const topPapers = scoredPapers.slice(0, config.maxDeepAnalysis);

            // Stage 4: Deep analysis
            const analyzedPapers = await analyzePDFs(topPapers, isDryRun);

            // Stage 5: Final ranking and output
            setProcessing(prev => ({ ...prev, stage: 'complete' }));

            analyzedPapers.sort((a, b) => b.finalScore - a.finalScore);
            const finalPapers = analyzedPapers.slice(0, config.finalOutputCount);

            setResults(prev => ({ ...prev, finalRanking: finalPapers }));

        } catch (error) {
            if (error.name !== 'AbortError') {
                addError(`Processing failed: ${error.message}`);
            }
        } finally {
            const endTime = new Date();
            const duration = processingTiming.startTime ? endTime - processingTiming.startTime : 0;
            setProcessingTiming(prev => ({ ...prev, endTime, duration }));

            setProcessing(prev => ({
                ...prev,
                isRunning: false,
                isPaused: false,
                stage: results.finalRanking.length > 0 ? 'complete' : 'idle'
            }));
        }
    };

    // Test functions
    const runDryRunTest = async () => {
        setTestState(prev => ({ ...prev, dryRunInProgress: true }));

        try {
            // Reset mock API tester
            mockAPITesterRef.current = new MockAPITester();
            addError('Starting dry run test - no API costs incurred');

            await startProcessing(true, false); // isDryRun = true, useTestPapers = false

            // Generate and download test report
            const testReport = generateTestReport(results.finalRanking, 'dry-run');
            const blob = new Blob([testReport], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aparture_dry_run_test_${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);

            setTestState(prev => ({
                ...prev,
                dryRunCompleted: true,
                lastDryRunTime: new Date(),
                dryRunInProgress: false
            }));

            addError('Dry run test completed successfully');

        } catch (error) {
            addError(`Dry run test failed: ${error.message}`);
            setTestState(prev => ({ ...prev, dryRunInProgress: false }));
        }
    };

    const runMinimalTest = async () => {
        setTestState(prev => ({ ...prev, minimalTestInProgress: true }));

        try {
            addError('Starting minimal test with real API calls');

            await startProcessing(false, true); // isDryRun = false, useTestPapers = true

            // Generate and download test report
            const testReport = generateTestReport(results.finalRanking, 'minimal');
            const blob = new Blob([testReport], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aparture_minimal_test_${new Date().toISOString().split('T')[0]}.txt`;
            a.click();
            URL.revokeObjectURL(url);

            setTestState(prev => ({
                ...prev,
                lastMinimalTestTime: new Date(),
                minimalTestInProgress: false
            }));

            addError('Minimal test completed successfully');

        } catch (error) {
            addError(`Minimal test failed: ${error.message}`);
            setTestState(prev => ({ ...prev, minimalTestInProgress: false }));
        }
    };

    // Control functions
    const handleStart = () => {
        startProcessing(false, false);
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
        setProcessingTiming({ startTime: null, endTime: null, duration: null });
        localStorage.removeItem('arxivAnalyzerState');
    };

    // Export results in a standardized format
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

        // Generate filename with timing info
        const timestamp = processingTiming.startTime ?
            processingTiming.startTime.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
            processingTiming.startTime.toTimeString().split(' ')[0].replace(/:/g, '-') :
            new Date().toISOString().split('T')[0];

        const durationStr = processingTiming.duration ?
            `_${Math.round(processingTiming.duration / 60000)}min` : '';

        a.download = `arxiv_analysis_${timestamp}${durationStr}.txt`;
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
                                ArXiv Categories
                            </label>

                            {/* Selected Categories Display */}
                            <div className="min-h-[2.5rem] p-3 bg-slate-800 border border-slate-700 rounded-lg mb-2">
                                {config.selectedCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {config.selectedCategories.map(category => (
                                            <span
                                                key={category}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs border border-blue-500/30"
                                            >
                                                {category}
                                                <button
                                                    onClick={() => removeCategory(category)}
                                                    className="hover:text-red-300 transition-colors"
                                                    disabled={processing.isRunning}
                                                    title={getCategoryDisplayName(category)}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-500 text-sm">No categories selected</span>
                                )}
                            </div>

                            {/* Category Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-left text-white hover:bg-slate-600 transition-colors flex items-center justify-between"
                                    disabled={processing.isRunning}
                                >
                                    <span>Add Categories</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {showCategoryDropdown && (
                                    <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                                        {Object.entries(ARXIV_CATEGORIES).map(([mainCategory, data]) => (
                                            <div key={mainCategory} className="border-b border-slate-700 last:border-b-0">
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={() => setExpandedCategory(expandedCategory === mainCategory ? null : mainCategory)}
                                                        className="flex-1 px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-2"
                                                    >
                                                        {expandedCategory === mainCategory ?
                                                            <ChevronDown className="w-4 h-4" /> :
                                                            <ChevronRight className="w-4 h-4" />
                                                        }
                                                        <span className="font-medium text-gray-200">{mainCategory}</span>
                                                        <span className="text-xs text-gray-400">
                                                            ({Object.keys(data.subcategories).length} categories)
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => addMainCategory(mainCategory)}
                                                        className="px-3 py-1 mr-2 text-xs bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors"
                                                        title={`Add all ${mainCategory} categories`}
                                                    >
                                                        Add All
                                                    </button>
                                                </div>

                                                {expandedCategory === mainCategory && (
                                                    <div className="bg-slate-900/50">
                                                        {Object.entries(data.subcategories).map(([subKey, subData]) => (
                                                            <button
                                                                key={subData.code}
                                                                onClick={() => {
                                                                    addCategory(subData.code);
                                                                    setShowCategoryDropdown(false);
                                                                }}
                                                                className="w-full px-8 py-2 text-left hover:bg-slate-700/50 transition-colors text-sm flex items-center justify-between group"
                                                                disabled={config.selectedCategories.includes(subData.code)}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-200">{subData.code}</span>
                                                                    <span className="text-xs text-gray-400">{subData.name}</span>
                                                                </div>
                                                                {config.selectedCategories.includes(subData.code) && (
                                                                    <span className="text-green-400 text-xs">✓ Selected</span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-gray-400 mt-1">
                                Click categories to select them. Use "Add All" to select entire sections.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                AI Models
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Screening Model */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Abstract Screening Model
                                    </label>
                                    <select
                                        value={config.screeningModel}
                                        onChange={(e) => setConfig(prev => ({ ...prev, screeningModel: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                                        disabled={processing.isRunning}
                                    >
                                        {AVAILABLE_MODELS.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                                        <p className="text-xs text-gray-400 mb-1">
                                            <strong>Selected:</strong> {AVAILABLE_MODELS.find(m => m.id === config.screeningModel)?.name}
                                        </p>
                                        <p className="text-xs text-gray-300">
                                            {AVAILABLE_MODELS.find(m => m.id === config.screeningModel)?.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Deep Analysis Model */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Deep PDF Analysis Model
                                    </label>
                                    <select
                                        value={config.deepAnalysisModel}
                                        onChange={(e) => setConfig(prev => ({ ...prev, deepAnalysisModel: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                                        disabled={processing.isRunning}
                                    >
                                        {AVAILABLE_MODELS.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                                        <p className="text-xs text-gray-400 mb-1">
                                            <strong>Selected:</strong> {AVAILABLE_MODELS.find(m => m.id === config.deepAnalysisModel)?.name}
                                        </p>
                                        <p className="text-xs text-gray-300">
                                            {AVAILABLE_MODELS.find(m => m.id === config.deepAnalysisModel)?.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                                <p className="text-xs text-blue-300">
                                    <strong>Strategy:</strong> Use a cost-effective model for screening abstracts, then a more powerful model for detailed PDF analysis of top papers.
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
                                                Abstract Batch Size
                                            </label>
                                            <input
                                                type="number"
                                                value={config.batchSize}
                                                onChange={(e) => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 5 }))}
                                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                min="1"
                                                max="20"
                                                disabled={processing.isRunning}
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Papers per API call</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
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
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                                Max Corrections
                                            </label>
                                            <input
                                                type="number"
                                                value={config.maxCorrections}
                                                onChange={(e) => setConfig(prev => ({ ...prev, maxCorrections: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                min="0"
                                                max="5"
                                                disabled={processing.isRunning}
                                            />
                                            <p className="text-xs text-gray-400 mt-1">AI calls to fix malformed output</p>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                                Max Retries
                                            </label>
                                            <input
                                                type="number"
                                                value={config.maxRetries}
                                                onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                min="0"
                                                max="5"
                                                disabled={processing.isRunning}
                                            />
                                            <p className="text-xs text-gray-400 mt-1">Full API call re-attempts</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Control Panel */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
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
                    </div>

                    {/* System Tests - Collapsible Section */}
                    <div>
                        <button
                            onClick={() => setShowTestDropdown(!showTestDropdown)}
                            className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            {showTestDropdown ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                            System Tests
                        </button>

                        {showTestDropdown && (
                            <div className="mt-3 space-y-3 pl-5 border-l-2 border-slate-700">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Dry Run Test */}
                                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                        <div className="flex items-center mb-2">
                                            <div className={`w-3 h-3 rounded-full mr-2 ${testState.dryRunCompleted ? 'bg-green-400' : 'bg-slate-500'}`} />
                                            <h3 className="font-medium">Dry Run Test</h3>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-3">
                                            Tests all components with mock APIs. No API costs incurred.
                                        </p>

                                        {testState.lastDryRunTime && (
                                            <p className="text-xs text-gray-500 mb-3">
                                                Last run: {testState.lastDryRunTime.toLocaleString()}
                                            </p>
                                        )}

                                        <button
                                            onClick={runDryRunTest}
                                            disabled={testState.dryRunInProgress || processing.isRunning}
                                            className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${testState.dryRunInProgress || processing.isRunning
                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                                                }`}
                                        >
                                            {testState.dryRunInProgress ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Testing...
                                                </>
                                            ) : testState.dryRunCompleted ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    Run Again
                                                </>
                                            ) : (
                                                <>
                                                    <TestTube className="w-4 h-4" />
                                                    Run Dry Test
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Minimal Test */}
                                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                                        <div className="flex items-center mb-2">
                                            <div className={`w-3 h-3 rounded-full mr-2 ${testState.lastMinimalTestTime ? 'bg-green-400' : 'bg-slate-500'}`} />
                                            <h3 className="font-medium">Minimal API Test</h3>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-3">
                                            Tests with 5 hardcoded papers using real APIs. Incurs costs.
                                        </p>

                                        {testState.lastMinimalTestTime && (
                                            <p className="text-xs text-gray-500 mb-3">
                                                Last run: {testState.lastMinimalTestTime.toLocaleString()}
                                            </p>
                                        )}

                                        <button
                                            onClick={runMinimalTest}
                                            disabled={!testState.dryRunCompleted || testState.minimalTestInProgress || processing.isRunning}
                                            className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${!testState.dryRunCompleted || testState.minimalTestInProgress || processing.isRunning
                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                : 'bg-orange-500 hover:bg-orange-600 text-white'
                                                }`}
                                        >
                                            {testState.minimalTestInProgress ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Testing...
                                                </>
                                            ) : !testState.dryRunCompleted ? (
                                                <>
                                                    <XCircle className="w-4 h-4" />
                                                    Run Dry Test First
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-4 h-4" />
                                                    Run API Test
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400">
                                    <strong>Testing workflow:</strong> Run the dry test first to verify all components work correctly without API costs.
                                    Then run the minimal test to confirm real API integration with a small set of papers.
                                </div>
                            </div>
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
                                    {showErrors ? 'Hide' : 'Show'} Logs ({processing.errors.length})
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

                {/* Download Report Section */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center mb-2">
                                <Download className="w-5 h-5 mr-2 text-green-400" />
                                <h2 className="text-xl font-semibold">Download Report</h2>
                            </div>

                            {processingTiming.startTime && (
                                <div className="text-sm text-gray-400 mb-3">
                                    {processingTiming.endTime ? (
                                        <>
                                            Completed: {processingTiming.endTime.toLocaleString()}
                                            <span className="mx-2">•</span>
                                            Duration: {Math.round(processingTiming.duration / 60000)} minutes
                                            <span className="mx-2">•</span>
                                            {results.finalRanking.length} papers analyzed
                                        </>
                                    ) : processing.isRunning ? (
                                        <>
                                            Started: {processingTiming.startTime.toLocaleString()}
                                            <span className="mx-2">•</span>
                                            Analysis in progress...
                                        </>
                                    ) : (
                                        `Last started: ${processingTiming.startTime.toLocaleString()}`
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={exportResults}
                            disabled={results.finalRanking.length === 0}
                            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${results.finalRanking.length > 0
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            <Download className="w-4 h-4" />
                            {results.finalRanking.length > 0 ? 'Download Report' : 'No Report Available'}
                        </button>
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