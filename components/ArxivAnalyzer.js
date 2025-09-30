import { AlertCircle, CheckCircle, ChevronDown, ChevronRight, Download, FileText, Loader2, Lock, Pause, Play, RotateCcw, Settings, Square, TestTube, Unlock, XCircle, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AVAILABLE_MODELS } from '../utils/models';
import { generateTestReport, TEST_PAPERS } from '../utils/testUtils';

// Distribution that uses the full 0-10 range with decimals
const generateRealisticScore = () => {
    // Generate uniform distribution between 0 and 10 (exclusive)
    const score = Math.random() * 10;
    return Math.round(score * 10) / 10; // Round to 1 decimal place
};

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
    scoringCriteria: `**Core Methodological Interests:**
**Statistical Learning:** Deep learning advances, general ML methods, novel architectures and training techniques with practical applications
**Uncertainty Quantification & Robustness:** Principled approaches to model uncertainty, calibration, conformal prediction, robustness evaluation, out-of-distribution detection, Bayesian deep learning
**Mechanistic Interpretability:** Understanding how models work internally, feature attribution, causal discovery in neural networks—not just making them "more honest" through prompting
**Advanced Statistical Methods:** Novel sampling/inference techniques, variational inference, hierarchical modeling, state space models, time series analysis, probabilistic programming innovations
**AI for Scientific Discovery:** Methods specifically designed to accelerate scientific understanding, not just routine applications of existing ML to new domains. Be highly selective with LLM papers—only major architectural innovations or fundamental breakthroughs, not incremental applications or fine-tuning studies.

**Astrophysics Domain Interests:**
**Galaxy Formation & Evolution:** Observational studies of galaxy assembly, galaxy populations, high-redshift galaxies, environmental effects, chemical evolution, quenching, morphological evolution
**Stellar Populations & Evolution:** Stellar activity, stellar populations as galactic tracers, stellar physics and evolution, star clusters, star formation processes
**Milky Way Structure & Dynamics:** Galactic structure, stellar kinematics, dark matter distribution, Galactic archaeology, stellar streams, near-field cosmology
**Large Survey Science:** Multi-wavelength surveys, time-domain astronomy, statistical methods for large astronomical datasets, survey strategy and design

**Research Philosophy:** Values EITHER (1) fundamental methodological advances in general OR (2) significant observational/data-driven astrophysical insights. Papers excelling in ANY category above should score highly - they do NOT need to match multiple domains. A landmark ML paper should score as highly as a landmark astrophysics paper. Focus on work that advances understanding through empirical analysis rather than purely theoretical frameworks.`,
    maxDeepAnalysis: 30,
    finalOutputCount: 30,
    daysBack: 1,
    batchSize: 3,
    maxCorrections: 1,
    maxRetries: 1,
    // Three-stage model configuration
    useQuickFilter: true,  // NEW: Enable quick filtering stage (enabled by default)
    filterModel: 'gemini-2.5-flash-lite',  // NEW: Model for quick YES/NO/MAYBE filtering
    filterBatchSize: 10,  // NEW: Batch size for filtering
    categoriesToScore: ['YES', 'MAYBE'],  // NEW: Which filter categories proceed to scoring
    scoringModel: 'gemini-2.5-flash',  // RENAMED from screeningModel
    scoringBatchSize: 3,  // RENAMED from batchSize
    // Post-processing configuration
    enableScorePostProcessing: true,  // Enable score post-processing
    postProcessingCount: 50,  // Number of top papers to post-process
    postProcessingBatchSize: 5,  // Batch size for post-processing
    postProcessingModel: 'gemini-2.5-flash',  // Model for post-processing (defaults to scoringModel)
    pdfModel: 'gemini-2.5-pro',  // RENAMED from deepAnalysisModel
    maxAbstractDisplay: 500
};

// Available AI models
// AVAILABLE_MODELS is now imported from utils/models.js

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
    const [filterResults, setFilterResults] = useState({
        total: 0,
        yes: [],
        maybe: [],
        no: [],
        inProgress: false,
        currentBatch: 0,
        totalBatches: 0
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

    // NotebookLM states
    const [podcastDuration, setPodcastDuration] = useState(20); // Default to 20 minutes
    const [notebookLMModel, setNotebookLMModel] = useState('gemini-2.5-pro');
    const [notebookLMStatus, setNotebookLMStatus] = useState('');
    const [notebookLMContent, setNotebookLMContent] = useState(null);
    const [notebookLMGenerating, setNotebookLMGenerating] = useState(false);
    const [enableHallucinationCheck, setEnableHallucinationCheck] = useState(true);
    const [hallucinationWarning, setHallucinationWarning] = useState(null);

    const abortControllerRef = useRef(null);
    const pauseRef = useRef(false);
    const dropdownRef = useRef(null);
    const mockAPITesterRef = useRef(null);

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
                        // Handle migration from old model names to new three-model setup
                        if (parsed.config.screeningModel && !parsed.config.scoringModel) {
                            // Migrate from two-model to three-model structure
                            parsed.config.filterModel = 'gemini-2.5-flash-lite';
                            parsed.config.scoringModel = parsed.config.screeningModel;
                            parsed.config.pdfModel = parsed.config.deepAnalysisModel;
                            parsed.config.filterBatchSize = 10;
                            parsed.config.scoringBatchSize = parsed.config.batchSize || 3;
                            parsed.config.useQuickFilter = false;
                            parsed.config.categoriesToScore = ['YES', 'MAYBE'];
                            delete parsed.config.screeningModel;
                            delete parsed.config.deepAnalysisModel;
                        }
                        // Handle even older single model setup
                        if (parsed.config.selectedModel) {
                            parsed.config.filterModel = 'gemini-2.5-flash-lite';
                            parsed.config.scoringModel = 'gemini-2.5-flash';
                            parsed.config.pdfModel = parsed.config.selectedModel;
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
                if (parsed.processingTiming) {
                    const timing = { ...parsed.processingTiming };
                    // Convert date strings back to Date objects
                    if (timing.startTime) timing.startTime = new Date(timing.startTime);
                    if (timing.endTime) timing.endTime = new Date(timing.endTime);
                    setProcessingTiming(timing);
                }
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

    // Enhanced Mock API Tester with abort/pause support
    const MockAPITesterEnhanced = class {
        constructor() {
            this.callCount = 0;
            this.scenarios = [
                'valid',
                'malformed',
                'missing_field',
                'wrong_type',
                'retry_failure',
                'final_failure'
            ];
        }

        // Check for abort/pause before continuing
        async checkAbortAndPause() {
            if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
            }
            if (pauseRef.current) {
                await waitForResume();
            }
        }

        // Mock quick filter API with abort/pause support
        async mockQuickFilter(papers, isCorrection = false) {
            await this.checkAbortAndPause();

            this.callCount++;
            const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

            // Simulate API delay with abort checking
            await this.sleepWithAbortCheck(50 + Math.random() * 100);

            console.log(`Mock Quick Filter API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`);

            // Check again after delay
            await this.checkAbortAndPause();

            switch (scenario) {
                case 'valid':
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)]
                    })));

                case 'malformed':
                    if (isCorrection) {
                        return JSON.stringify(papers.map((_, idx) => ({
                            paperIndex: idx + 1,
                            verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)]
                        })));
                    }
                    return `{"invalid": "json" "missing_comma": true}`;

                case 'missing_field':
                    if (isCorrection) {
                        return JSON.stringify(papers.map((_, idx) => ({
                            paperIndex: idx + 1,
                            verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)]
                        })));
                    }
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1
                        // Missing verdict field
                    })));

                case 'wrong_type':
                    if (isCorrection) {
                        return JSON.stringify(papers.map((_, idx) => ({
                            paperIndex: idx + 1,
                            verdict: ['YES', 'NO', 'MAYBE'][Math.floor(Math.random() * 3)]
                        })));
                    }
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        verdict: 123 // Wrong type
                    })));

                case 'retry_failure':
                    throw new Error('Mock Filter API temporary failure - should trigger retry');

                case 'final_failure':
                    throw new Error('Mock Filter API permanent failure - should fail after all retries');

                default:
                    return JSON.stringify([]);
            }
        }

        // Mock abstract scoring API with abort/pause support
        async mockScoreAbstracts(papers, isCorrection = false) {
            await this.checkAbortAndPause();

            this.callCount++;
            const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

            // Simulate API delay with abort checking
            await this.sleepWithAbortCheck(50 + Math.random() * 100);

            console.log(`Mock Abstract API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`);

            // Check again after delay
            await this.checkAbortAndPause();

            switch (scenario) {
                case 'valid':
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: generateRealisticScore(),
                        justification: `Mock evaluation for test paper ${idx + 1}. This is a simulated relevance assessment.`
                    })));

                case 'malformed':
                    if (isCorrection) {
                        return JSON.stringify(papers.map((_, idx) => ({
                            paperIndex: idx + 1,
                            score: generateRealisticScore(),
                            justification: `Corrected mock evaluation for test paper ${idx + 1}.`
                        })));
                    }
                    return `{"invalid": "json" "missing_comma": true}`;

                case 'missing_field':
                    if (isCorrection) {
                        return JSON.stringify(papers.map((_, idx) => ({
                            paperIndex: idx + 1,
                            score: generateRealisticScore(),
                            justification: `Corrected mock evaluation for test paper ${idx + 1}.`
                        })));
                    }
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        justification: `Mock evaluation missing score field.`
                    })));

                case 'wrong_type':
                    if (isCorrection) {
                        return JSON.stringify(papers.map((_, idx) => ({
                            paperIndex: idx + 1,
                            score: generateRealisticScore(),
                            justification: `Corrected mock evaluation for test paper ${idx + 1}.`
                        })));
                    }
                    return JSON.stringify(papers.map((_, idx) => ({
                        paperIndex: idx + 1,
                        score: "not_a_number",
                        justification: `Mock evaluation with wrong score type.`
                    })));

                case 'retry_failure':
                    throw new Error('Mock API temporary failure - should trigger retry');

                case 'final_failure':
                    throw new Error('Mock API permanent failure - should fail after all retries');

                default:
                    return JSON.stringify([]);
            }
        }

        // Mock PDF analysis API with abort/pause support
        async mockAnalyzePDF(paper, isCorrection = false) {
            await this.checkAbortAndPause();

            this.callCount++;
            const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

            // Simulate longer PDF processing delay with abort checking
            await this.sleepWithAbortCheck(100 + Math.random() * 200);

            console.log(`Mock PDF API Call ${this.callCount}: Testing scenario '${scenario}' for paper "${paper.title}"${isCorrection ? ' (correction)' : ''}`);

            // Check again after delay
            await this.checkAbortAndPause();

            switch (scenario) {
                case 'valid':
                    return JSON.stringify({
                        summary: `Mock deep analysis of "${paper.title}". This simulated analysis would include detailed technical content, methodology discussion, and comprehensive evaluation of the paper's contributions.`,
                        keyFindings: `Key mock findings: Novel approach to ${Math.random() > 0.5 ? 'neural networks' : 'optimization'}, significant performance improvements, and potential applications in ${Math.random() > 0.5 ? 'computer vision' : 'natural language processing'}.`,
                        methodology: `Mock methodology analysis: The authors employed ${Math.random() > 0.5 ? 'experimental' : 'theoretical'} approaches with ${Math.random() > 0.5 ? 'empirical' : 'analytical'} validation.`,
                        limitations: `Mock limitations: Computational complexity, limited generalization, and potential scalability issues.`,
                        relevanceAssessment: `Mock relevance assessment: This work is highly relevant to current research trends. Updated from abstract-only analysis.`,
                        updatedScore: generateRealisticScore()
                    });

                case 'malformed':
                    if (isCorrection) {
                        return JSON.stringify({
                            summary: `Corrected mock analysis of "${paper.title}".`,
                            keyFindings: `Corrected key findings after initial formatting error.`,
                            methodology: `Corrected methodology analysis.`,
                            limitations: `Corrected limitations assessment.`,
                            relevanceAssessment: `Corrected relevance assessment.`,
                            updatedScore: generateRealisticScore()
                        });
                    }
                    return `{"summary": "Invalid JSON structure" missing_bracket: true`;

                case 'missing_field':
                    if (isCorrection) {
                        return JSON.stringify({
                            summary: `Corrected mock analysis of "${paper.title}".`,
                            keyFindings: `Corrected key findings.`,
                            methodology: `Corrected methodology.`,
                            limitations: `Corrected limitations.`,
                            relevanceAssessment: `Corrected relevance assessment.`,
                            updatedScore: generateRealisticScore()
                        });
                    }
                    return JSON.stringify({
                        summary: `Mock analysis missing updatedScore field.`,
                        keyFindings: `Mock findings.`,
                    });

                case 'wrong_type':
                    if (isCorrection) {
                        return JSON.stringify({
                            summary: `Corrected mock analysis of "${paper.title}".`,
                            keyFindings: `Corrected key findings.`,
                            methodology: `Corrected methodology.`,
                            limitations: `Corrected limitations.`,
                            relevanceAssessment: `Corrected relevance assessment.`,
                            updatedScore: generateRealisticScore()
                        });
                    }
                    return JSON.stringify({
                        summary: `Mock analysis with wrong type.`,
                        updatedScore: "not_a_number"
                    });

                case 'retry_failure':
                    throw new Error('Mock PDF API temporary failure - should trigger retry');

                case 'final_failure':
                    throw new Error('Mock PDF API permanent failure - should fail after all retries');

                default:
                    return JSON.stringify({});
            }
        }

        // Mock rescore abstracts API with abort/pause support
        async mockRescoreAbstracts(papers, isCorrection = false) {
            await this.checkAbortAndPause();

            this.callCount++;
            const scenario = this.scenarios[(this.callCount - 1) % this.scenarios.length];

            // Simulate API delay with abort checking
            await this.sleepWithAbortCheck(50 + Math.random() * 100);

            console.log(`Mock Rescore API Call ${this.callCount}: Testing scenario '${scenario}'${isCorrection ? ' (correction)' : ''}`);

            // Helper to generate realistic score adjustments
            const generateAdjustedScore = (initialScore) => {
                // Generate adjustment between -2.0 and +2.0, with bias toward small adjustments
                const adjustment = (Math.random() - 0.5) * 2 * (Math.random() > 0.7 ? 2.0 : 1.0);
                const adjusted = Math.max(0, Math.min(10, initialScore + adjustment));
                return Math.round(adjusted * 10) / 10;
            };

            const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];
            const adjustmentReasons = [
                'Initially over-scored compared to similar papers in batch',
                'Initially under-scored; stronger research alignment than first assessment',
                'Score maintained after comparative review',
                'Adjusted down due to less novel methodology than initially assessed',
                'Adjusted up based on stronger technical contribution',
                'Score confirmed as appropriate relative to other papers'
            ];

            if (scenario === 'valid' || isCorrection) {
                return JSON.stringify(papers.map((p, idx) => {
                    const adjusted = generateAdjustedScore(p.initialScore || p.relevanceScore);
                    const changed = Math.abs(adjusted - (p.initialScore || p.relevanceScore)) > 0.1;
                    return {
                        paperIndex: idx + 1,
                        adjustedScore: adjusted,
                        adjustmentReason: changed
                            ? adjustmentReasons[Math.floor(Math.random() * adjustmentReasons.length)]
                            : 'Score maintained after comparative review',
                        confidence: confidenceLevels[Math.floor(Math.random() * confidenceLevels.length)]
                    };
                }));
            }

            // Test error scenarios
            if (scenario === 'malformed') {
                if (isCorrection) {
                    // Provide valid response on correction
                    return JSON.stringify(papers.map((p, idx) => ({
                        paperIndex: idx + 1,
                        adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
                        adjustmentReason: 'Corrected assessment',
                        confidence: 'MEDIUM'
                    })));
                }
                return "Not valid JSON {broken";
            }

            if (scenario === 'missing_field') {
                if (isCorrection) {
                    return JSON.stringify(papers.map((p, idx) => ({
                        paperIndex: idx + 1,
                        adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
                        adjustmentReason: 'Corrected assessment with all fields',
                        confidence: 'HIGH'
                    })));
                }
                return JSON.stringify(papers.map((p, idx) => ({
                    paperIndex: idx + 1,
                    adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore)
                    // Missing adjustmentReason and confidence
                })));
            }

            if (scenario === 'wrong_type') {
                if (isCorrection) {
                    return JSON.stringify(papers.map((p, idx) => ({
                        paperIndex: idx + 1,
                        adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
                        adjustmentReason: 'Corrected type assessment',
                        confidence: 'LOW'
                    })));
                }
                return JSON.stringify(papers.map((p, idx) => ({
                    paperIndex: idx + 1,
                    adjustedScore: "not_a_number",
                    adjustmentReason: 'Test wrong type',
                    confidence: 'INVALID'
                })));
            }

            if (scenario === 'retry_failure') {
                throw new Error("Simulated API failure - should retry");
            }

            if (scenario === 'final_failure') {
                throw new Error("Simulated persistent failure");
            }

            // Default case
            return JSON.stringify(papers.map((p, idx) => ({
                paperIndex: idx + 1,
                adjustedScore: generateAdjustedScore(p.initialScore || p.relevanceScore),
                adjustmentReason: 'Default mock assessment',
                confidence: 'MEDIUM'
            })));
        }

        // Mock NotebookLM generation API with abort/pause support
        async mockGenerateNotebookLM(papers, targetDuration, model) {
            await this.checkAbortAndPause();

            this.callCount++;

            // Simulate API delay
            await this.sleepWithAbortCheck(100 + Math.random() * 200);

            console.log(`Mock NotebookLM API Call ${this.callCount}: Generating ${targetDuration}-minute document with ${model}`);

            // Check again after delay
            await this.checkAbortAndPause();

            const durationText = {
                5: "Quick Overview",
                10: "Standard Discussion",
                15: "Detailed Analysis",
                20: "In-depth Coverage",
                30: "Comprehensive Review"
            }[targetDuration] || "Custom Duration";

            const markdown = `# Research Analysis: Mock Test Papers for ${durationText}

## Executive Summary
This is a mock NotebookLM document generated for testing purposes. The analysis covers ${papers.length} papers with a target podcast duration of ${targetDuration} minutes using the ${model} model.

## Research Context and Methodology
This document was generated through the Aparture testing system to validate NotebookLM integration. The papers analyzed represent a diverse range of topics in computer science and related fields.

## Thematic Analysis

### Theme 1: Machine Learning Advances
Several papers in this collection focus on breakthrough ML techniques...

#### Key Papers in This Theme
${papers.slice(0, Math.min(3, papers.length)).map(p => `- **${p.title}** (Score: ${p.score || p.relevanceScore || 0}/10)
  - Core Contribution: Mock contribution for ${p.title}
  - Methodological Approach: Simulated methodology description
  - Principal Findings: Test findings placeholder`).join('\n')}

### Theme 2: System Architecture Innovations
Another significant theme involves novel system architectures...

## Comparative Insights
The papers demonstrate complementary approaches that could be synthesized for greater impact. Notable connections include shared methodological frameworks and overlapping application domains.

## Key Takeaways for Practitioners
- Method adoption recommendations based on analyzed papers
- Implementation considerations for production systems
- Future research directions suggested by the collective findings

## Discussion Prompts for Podcast
- What are the most surprising findings across these papers?
- How do these advances change current practice in the field?
- What technical challenges remain unsolved?
- Where might this research lead in the next 5 years?

---
*Document prepared for NotebookLM podcast generation. Target duration: ${targetDuration} minutes. Model: ${model}. Generated at: ${new Date().toISOString()}*`;

            return markdown;
        }

        // Sleep with periodic abort checking
        async sleepWithAbortCheck(ms) {
            const checkInterval = 100; // Check every 100ms
            const iterations = Math.ceil(ms / checkInterval);

            for (let i = 0; i < iterations; i++) {
                await this.checkAbortAndPause();
                await new Promise(resolve => setTimeout(resolve, Math.min(checkInterval, ms - (i * checkInterval))));
            }
        }
    };

    // Enhanced robust API call with better abort checking
    const makeRobustAPICall = useCallback(async (apiCallFunction, parseFunction, context = "", originalPromptInfo = "") => {
        let lastError = null;

        for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
            try {
                // Check for abort before each retry
                if (abortControllerRef.current?.signal.aborted) {
                    throw new Error('Operation aborted');
                }
                if (pauseRef.current) {
                    await waitForResume();
                }

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
                        // Check for abort before each correction
                        if (abortControllerRef.current?.signal.aborted) {
                            throw new Error('Operation aborted');
                        }
                        if (pauseRef.current) {
                            await waitForResume();
                        }

                        addError(`${context} - Frontend correction attempt ${correctionCount}/${config.maxCorrections} (backend already attempted validation)`);

                        const correctionPrompt = `The response still has issues after backend validation. Please provide a properly formatted response.

Previous response:
${responseText}

Error: ${lastError.message}

${originalPromptInfo ? `Original task: ${originalPromptInfo}` : ''}

Your entire response MUST ONLY be a single, valid JSON object/array. DO NOT respond with anything other than valid JSON.`;

                        responseText = await apiCallFunction(correctionPrompt, true);

                        const result = parseFunction(responseText);
                        addError(`${context} - Correction ${correctionCount} succeeded`);
                        return result;

                    } catch (correctionError) {
                        if (correctionError.message === 'Operation aborted') {
                            throw correctionError;
                        }
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
                if (apiError.message === 'Operation aborted') {
                    throw apiError;
                }
                lastError = apiError;
                if (retryCount < config.maxRetries) {
                    addError(`${context} - API call failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`);

                    // Sleep with abort checking
                    const delay = 1000;
                    for (let i = 0; i < delay; i += 50) {
                        if (abortControllerRef.current?.signal.aborted) {
                            throw new Error('Operation aborted');
                        }
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } else {
                    throw apiError;
                }
            }
        }

        throw lastError;
    }, [config.maxRetries, config.maxCorrections, addError]);

    // Enhanced mock robust API call with better abort checking
    const makeMockRobustAPICall = useCallback(async (mockApiFunction, parseFunction, context = "") => {
        let lastError = null;

        for (let retryCount = 0; retryCount <= config.maxRetries; retryCount++) {
            try {
                // Check for abort before each retry
                if (abortControllerRef.current?.signal.aborted) {
                    throw new Error('Operation aborted');
                }
                if (pauseRef.current) {
                    await waitForResume();
                }

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
                        // Check for abort before each correction
                        if (abortControllerRef.current?.signal.aborted) {
                            throw new Error('Operation aborted');
                        }
                        if (pauseRef.current) {
                            await waitForResume();
                        }

                        addError(`${context} - Mock correction ${correctionCount}/${config.maxCorrections}`);
                        responseText = await mockApiFunction(true); // Pass isCorrection = true
                        const result = parseFunction(responseText);
                        addError(`${context} - Mock correction ${correctionCount} succeeded`);
                        return result;
                    } catch (correctionError) {
                        if (correctionError.message === 'Operation aborted') {
                            throw correctionError;
                        }
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
                if (apiError.message === 'Operation aborted') {
                    throw apiError;
                }
                lastError = apiError;
                if (retryCount < config.maxRetries) {
                    addError(`${context} - Mock API failed, retrying ${retryCount + 1}/${config.maxRetries}: ${apiError.message}`);

                    // Sleep with abort checking
                    const delay = 500;
                    for (let i = 0; i < delay; i += 50) {
                        if (abortControllerRef.current?.signal.aborted) {
                            throw new Error('Operation aborted');
                        }
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
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
        setProcessing(prev => ({ ...prev, stage: 'fetching', progress: { current: 0, total: 0 } }));

        try {
            const categories = config.selectedCategories.filter(cat => cat.trim());
            if (categories.length === 0) {
                throw new Error('No categories selected');
            }

            console.log(`Fetching papers for ${categories.length} categories: ${categories.join(', ')}`);

            // Set initial progress with total categories
            setProcessing(prev => ({
                ...prev,
                stage: 'fetching',
                progress: { current: 0, total: categories.length }
            }));

            let allPapers = [];
            const requestDelay = 1000; // 1 second delay between requests

            // Process each category individually (like the Python version)
            for (let i = 0; i < categories.length; i++) {
                // Check for abort signal
                if (abortControllerRef.current?.signal.aborted) {
                    throw new Error('Operation aborted');
                }

                // Check for pause
                if (pauseRef.current) {
                    await waitForResume();
                }

                const category = categories[i];

                try {
                    console.log(`\nFetching category ${i + 1}/${categories.length}: ${category}`);

                    const categoryPapers = await fetchSingleCategory(category);
                    allPapers.push(...categoryPapers);

                    console.log(`Found ${categoryPapers.length} papers for ${category}`);

                    // Update progress after each category
                    setProcessing(prev => ({
                        ...prev,
                        stage: 'fetching',
                        progress: { current: i + 1, total: categories.length }
                    }));

                    // Delay between requests (except for the last one)
                    if (i < categories.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, requestDelay));
                    }

                } catch (error) {
                    // Check if this is an abort error
                    if (error.message === 'Operation aborted') {
                        throw error;
                    }

                    console.error(`Error fetching category ${category}:`, error);
                    addError(`Failed to fetch category ${category}: ${error.message}`);
                    // Continue with other categories
                }
            }

            // Remove duplicates based on paper ID
            const uniquePapers = removeDuplicatePapers(allPapers);

            // Sort by most recent submission date
            uniquePapers.sort((a, b) => new Date(b.published) - new Date(a.published));

            console.log(`\n=== FETCH SUMMARY ===`);
            console.log(`Total papers found: ${allPapers.length}`);
            console.log(`Unique papers: ${uniquePapers.length}`);
            console.log(`Duplicates removed: ${allPapers.length - uniquePapers.length}`);

            if (uniquePapers.length === 0) {
                addError(`No papers found for any category in the specified time range. Try increasing 'Days to Look Back' or check if categories are valid.`);
            }

            setResults(prev => ({ ...prev, allPapers: uniquePapers }));

            // Final progress update
            setProcessing(prev => ({
                ...prev,
                stage: 'fetching',
                progress: { current: categories.length, total: categories.length }
            }));

            return uniquePapers;

        } catch (error) {
            addError(`Failed to fetch papers: ${error.message}`);
            throw error;
        }
    };

    // Fetch papers for a single category with smart date range shifting
    const fetchSingleCategory = async (category) => {
        const maxResults = 200; // Increased from default
        const maxDateShiftDays = 14; // Maximum days to shift back

        // Try to find a date range that contains papers
        for (let daysShifted = 0; daysShifted <= maxDateShiftDays; daysShifted++) {
            // Check for abort/pause before each attempt
            if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
            }
            if (pauseRef.current) {
                await waitForResume();
            }

            const { startDate, endDate } = calculateDateRange(daysShifted);
            const query = buildArxivQuery(category, startDate, endDate);

            console.log(`  Trying date range: ${startDate} to ${endDate}${daysShifted > 0 ? ` (shifted back ${daysShifted} days)` : ''}`);

            try {
                const papers = await executeArxivQuery(query, maxResults, category);

                if (papers.length > 0) {
                    if (daysShifted > 0) {
                        console.log(`  ✓ Found ${papers.length} papers after shifting back ${daysShifted} days`);
                    }
                    return papers;
                } else if (daysShifted === 0) {
                    console.log(`  No papers found in original date range, trying with shifted dates...`);
                }

            } catch (error) {
                // Check if this is an abort error
                if (error.message === 'Operation aborted') {
                    throw error;
                }

                console.error(`  Error with query for ${category}:`, error.message);
                if (daysShifted === 0) {
                    throw error; // Fail fast on first attempt if it's a real API error
                }
            }
        }

        console.log(`  Warning: No papers found for ${category} even after shifting back ${maxDateShiftDays} days`);
        return [];
    };

    // Calculate date range for arXiv query
    const calculateDateRange = (daysShifted = 0) => {
        const endDate = new Date();
        endDate.setUTCDate(endDate.getUTCDate() - daysShifted);

        const startDate = new Date(endDate);
        startDate.setUTCDate(startDate.getUTCDate() - config.daysBack);

        // Format as YYYYMMDD for arXiv API
        const formatDate = (date) => {
            return date.toISOString().split('T')[0].replace(/-/g, '');
        };

        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate)
        };
    };

    // Build arXiv query string (following Python implementation pattern)
    const buildArxivQuery = (category, startDate, endDate) => {
        // Use submittedDate with wildcards like the Python version
        const dateQuery = `submittedDate:[${startDate}* TO ${endDate}*]`;
        const categoryQuery = `cat:${category}`;

        // Combine with proper parentheses like Python version
        return `(${categoryQuery}) AND ${dateQuery}`;
    };

    // Execute the actual arXiv API query
    const executeArxivQuery = async (query, maxResults, category) => {
        // Check for abort before making request
        if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Operation aborted');
        }

        // Build URL with proper encoding
        const params = new URLSearchParams({
            search_query: query,
            start: 0,
            max_results: maxResults,
            sortBy: 'submittedDate',
            sortOrder: 'descending'
        });

        const url = `https://export.arxiv.org/api/query?${params.toString()}`;

        console.log(`  Query: ${query}`);
        console.log(`  URL length: ${url.length} chars`);

        // Use abort controller signal in fetch
        const response = await fetch(url, {
            signal: abortControllerRef.current?.signal
        });

        if (!response.ok) {
            throw new Error(`arXiv API HTTP error: ${response.status}`);
        }

        const text = await response.text();
        console.log(`  Response length: ${text.length} chars`);

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');

        // Check for parsing errors
        const parseErrors = xml.getElementsByTagName('parsererror');
        if (parseErrors.length > 0) {
            throw new Error('XML parsing error in arXiv response');
        }

        // Check for arXiv API errors
        const errorElements = xml.getElementsByTagName('error');
        if (errorElements.length > 0) {
            const errorText = errorElements[0].textContent;
            throw new Error(`arXiv API error: ${errorText}`);
        }

        const entries = xml.getElementsByTagName('entry');
        const papers = [];

        for (let entry of entries) {
            // Check for abort during parsing
            if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
            }

            try {
                const paper = parseArxivEntry(entry, category);
                if (paper && paper.id) {
                    papers.push(paper);
                }
            } catch (error) {
                console.warn(`Error parsing entry:`, error);
                // Continue with other entries
            }
        }

        return papers;
    };

    // Parse a single arXiv entry from the XML
    const parseArxivEntry = (entry, fetchedCategory) => {
        const getId = (entry) => {
            const id = entry.getElementsByTagName('id')[0]?.textContent;
            return id ? id.split('/abs/')[1] : '';
        };

        const getAuthors = (entry) => {
            const authors = entry.getElementsByTagName('author');
            return Array.from(authors).map(a =>
                a.getElementsByTagName('name')[0]?.textContent || ''
            ).filter(name => name.length > 0);
        };

        const getCategories = (entry) => {
            const categories = entry.getElementsByTagName('category');
            return Array.from(categories)
                .map(c => c.getAttribute('term'))
                .filter(term => term && term.length > 0);
        };

        const cleanText = (text) => {
            return text ? text.replace(/\s+/g, ' ').trim() : '';
        };

        return {
            id: getId(entry),
            title: cleanText(entry.getElementsByTagName('title')[0]?.textContent || ''),
            abstract: cleanText(entry.getElementsByTagName('summary')[0]?.textContent || ''),
            authors: getAuthors(entry),
            published: entry.getElementsByTagName('published')[0]?.textContent || '',
            updated: entry.getElementsByTagName('updated')[0]?.textContent || '',
            categories: getCategories(entry),
            pdfUrl: `https://arxiv.org/pdf/${getId(entry)}.pdf`,
            fetchedCategory: fetchedCategory
        };
    };

    // Remove duplicate papers based on arXiv ID
    const removeDuplicatePapers = (papers) => {
        const seen = new Set();
        return papers.filter(paper => {
            if (seen.has(paper.id)) {
                return false;
            }
            seen.add(paper.id);
            return true;
        });
    };

    // Quick filter papers using YES/NO/MAYBE verdicts
    const performQuickFilter = async (papers, isDryRun = false) => {
        if (!config.useQuickFilter) {
            return papers;  // Skip filtering if disabled
        }

        setProcessing(prev => ({ ...prev, stage: 'Filtering', progress: { current: 0, total: papers.length } }));

        const batchSize = config.filterBatchSize || 10;
        const totalBatches = Math.ceil(papers.length / batchSize);

        // Initialize filter results
        setFilterResults({
            total: papers.length,
            yes: [],
            maybe: [],
            no: [],
            inProgress: true,
            currentBatch: 0,
            totalBatches
        });

        const filteredPapers = [];
        const allVerdicts = [];

        for (let i = 0; i < papers.length; i += batchSize) {
            if (pauseRef.current) {
                await waitForResume();
            }

            if (abortControllerRef.current?.signal.aborted) {
                throw new Error('Operation aborted');
            }

            const batch = papers.slice(i, Math.min(i + batchSize, papers.length));
            const batchIndex = Math.floor(i / batchSize);

            setFilterResults(prev => ({ ...prev, currentBatch: batchIndex + 1 }));

            try {
                let verdicts;

                if (isDryRun) {
                    // Mock filter for dry run using the mock API tester
                    const mockApiCall = async (isCorrection = false) => {
                        if (!mockAPITesterRef.current) {
                            mockAPITesterRef.current = new MockAPITesterEnhanced();
                        }
                        return await mockAPITesterRef.current.mockQuickFilter(batch, isCorrection);
                    };

                    const parseResponse = (text) => {
                        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const parsed = JSON.parse(cleaned);
                        // Ensure we return an array format
                        return Array.isArray(parsed) ? parsed : (parsed.verdicts || []);
                    };

                    verdicts = await makeMockRobustAPICall(
                        mockApiCall,
                        parseResponse,
                        `Mock filter batch ${batchIndex + 1}/${totalBatches}`
                    );
                } else {
                    // Real API call
                    const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
                        const requestBody = {
                            papers: batch.map(p => ({ title: p.title, id: p.id, abstract: p.abstract })),
                            scoringCriteria: config.scoringCriteria,
                            password: password,
                            model: config.filterModel
                        };

                        if (isCorrection && correctionPrompt) {
                            requestBody.correctionPrompt = correctionPrompt;
                        }

                        const response = await fetch('/api/quick-filter', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody),
                            signal: abortControllerRef.current?.signal
                        });

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Filter API error: ${response.status} - ${errorText}`);
                        }

                        const data = await response.json();
                        if (data.error) {
                            throw new Error(data.error);
                        }

                        return data.rawResponse || JSON.stringify(data.verdicts);
                    };

                    const parseResponse = (text) => {
                        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const parsed = JSON.parse(cleaned);
                        if (!parsed.verdicts && Array.isArray(parsed)) {
                            return { verdicts: parsed };
                        }
                        return parsed;
                    };

                    const result = await makeRobustAPICall(
                        makeAPICall,
                        parseResponse,
                        `Filter batch ${batchIndex + 1}/${totalBatches}`
                    );

                    verdicts = result.verdicts || result;
                }

                // Apply verdicts to papers
                // Handle both array format (real API) and paperIndex format (mock API)
                const verdictsArray = Array.isArray(verdicts) ? verdicts : [];

                verdictsArray.forEach((verdict) => {
                    // Get the paper based on paperIndex (1-indexed) or by order
                    const paperIdx = verdict.paperIndex ? verdict.paperIndex - 1 : verdictsArray.indexOf(verdict);

                    if (paperIdx >= 0 && paperIdx < batch.length) {
                        const paper = batch[paperIdx];
                        paper.filterVerdict = verdict.verdict;

                        // Update live results
                        if (verdict.verdict === 'YES') {
                            setFilterResults(prev => ({ ...prev, yes: [...prev.yes, paper] }));
                        } else if (verdict.verdict === 'MAYBE') {
                            setFilterResults(prev => ({ ...prev, maybe: [...prev.maybe, paper] }));
                        } else {
                            setFilterResults(prev => ({ ...prev, no: [...prev.no, paper] }));
                        }

                        // Add to filtered list if in selected categories
                        if (config.categoriesToScore.includes(verdict.verdict)) {
                            filteredPapers.push(paper);
                        }
                    }
                });

                allVerdicts.push(...verdictsArray);

                setProcessing(prev => ({
                    ...prev,
                    progress: { current: Math.min(i + batchSize, papers.length), total: papers.length }
                }));

            } catch (error) {
                if (error.message === 'Operation aborted') {
                    throw error;
                }
                addError(`Filter batch ${batchIndex + 1} failed: ${error.message}`);
                // On failure, include all papers in batch as MAYBE (safe default)
                batch.forEach(paper => {
                    paper.filterVerdict = 'MAYBE';
                    if (config.categoriesToScore.includes('MAYBE')) {
                        filteredPapers.push(paper);
                    }
                });
            }
        }

        setFilterResults(prev => ({ ...prev, inProgress: false }));

        console.log(`\n=== FILTER SUMMARY ===`);
        console.log(`Total papers: ${papers.length}`);
        console.log(`YES: ${filterResults.yes.length} (${Math.round(filterResults.yes.length / papers.length * 100)}%)`);
        console.log(`MAYBE: ${filterResults.maybe.length} (${Math.round(filterResults.maybe.length / papers.length * 100)}%)`);
        console.log(`NO: ${filterResults.no.length} (${Math.round(filterResults.no.length / papers.length * 100)}%)`);
        console.log(`Papers proceeding to scoring: ${filteredPapers.length}`);

        return filteredPapers;
    };

    // Score abstracts using chosen API (or mock for dry run)
    const scoreAbstracts = async (papers, isDryRun = false) => {
        setProcessing(prev => ({ ...prev, stage: 'initial-scoring', progress: { current: 0, total: papers.length } }));

        const scoredPapers = [];
        const failedPapers = []; // Track failed papers separately
        const batchSize = config.scoringBatchSize || config.batchSize || 3;  // Use scoringBatchSize, fallback to old batchSize

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
                            // Validate score range (allow 0-10 inclusive)
                            if (score.score < 0 || score.score > 10) {
                                throw new Error(`Score object ${idx} score must be between 0.0 and 10.0, got ${score.score}`);
                            }
                            // Round to one decimal place to handle floating point precision issues
                            score.score = Math.round(score.score * 10) / 10;
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
                            model: config.scoringModel
                        };

                        if (isCorrection && correctionPrompt) {
                            requestBody.correctionPrompt = correctionPrompt;
                        }

                        const response = await fetch('/api/score-abstracts', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody),
                            signal: abortControllerRef.current?.signal
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `API error: ${response.status}`);
                        }

                        const data = await response.json();
                        // If scores are already parsed, return them directly; otherwise return rawResponse for parsing
                        if (data.scores && Array.isArray(data.scores)) {
                            return JSON.stringify(data.scores);
                        }
                        return data.rawResponse;
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
                            // Validate score range - allow decimals
                            if (score.score < 0 || score.score > 10) {
                                throw new Error(`Score object ${idx} score must be between 0.0 and 10.0, got ${score.score}`);
                            }
                            // Round to one decimal place to handle floating point precision issues
                            score.score = Math.round(score.score * 10) / 10;
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

                // Process successful scores
                scores.forEach((scoreData) => {
                    const paperIdx = scoreData.paperIndex - 1;
                    if (paperIdx >= 0 && paperIdx < batch.length) {
                        const scoredPaper = {
                            ...batch[paperIdx],
                            relevanceScore: scoreData.score,
                            scoreJustification: scoreData.justification,
                            // Store initial scores for post-processing
                            initialScore: scoreData.score,
                            initialJustification: scoreData.justification
                        };

                        // Only add papers with valid scores (> 0) to the main results
                        if (scoreData.score > 0) {
                            scoredPapers.push(scoredPaper);
                        } else {
                            // Track papers with score 0 separately
                            failedPapers.push({
                                ...scoredPaper,
                                failureReason: 'Scored as 0 relevance'
                            });
                        }
                    }
                });

            } catch (error) {
                // Check if this is an abort error
                if (error.message === 'Operation aborted') {
                    throw error;
                }

                addError(`Failed to score batch starting at paper ${i + 1} after all retries: ${error.message}`);

                // Add failed papers to the failed list, not the main results
                batch.forEach(p => {
                    failedPapers.push({
                        ...p,
                        relevanceScore: 0,
                        scoreJustification: 'Failed to score after retries',
                        failureReason: error.message
                    });
                });
            }

            // Update progress AND results after each batch
            setProcessing(prev => ({
                ...prev,
                progress: { current: Math.min(i + batchSize, papers.length), total: papers.length }
            }));

            // Update results with current scored papers (sorted by score, only successful ones)
            const currentSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
            setResults(prev => ({
                ...prev,
                scoredPapers: currentSorted,
                failedPapers: failedPapers // Store failed papers separately
            }));

            await new Promise(resolve => setTimeout(resolve, isDryRun ? 100 : 1500));
        }

        // Log summary of results
        console.log(`\n=== SCORING SUMMARY ===`);
        console.log(`Successfully scored papers: ${scoredPapers.length}`);
        console.log(`Failed papers: ${failedPapers.length}`);
        if (failedPapers.length > 0) {
            addError(`Warning: ${failedPapers.length} papers failed to score and will be excluded from deep analysis`);
        }

        const finalSorted = [...scoredPapers].sort((a, b) => b.relevanceScore - a.relevanceScore);
        return finalSorted;
    };

    // Post-process scores for consistency and accuracy
    const postProcessScores = async (papers, isDryRun = false) => {
        // Skip if disabled or no papers to process
        if (!config.enableScorePostProcessing || papers.length === 0) {
            return papers;
        }

        setProcessing(prev => ({
            ...prev,
            stage: 'post-processing',
            progress: { current: 0, total: Math.min(config.postProcessingCount, papers.length) }
        }));

        // Select papers for post-processing (simply take the top N papers)
        const selectedPapers = papers.slice(0, config.postProcessingCount);

        if (selectedPapers.length === 0) {
            console.log('No papers to post-process');
            return papers;
        }

        // Randomize the selected papers to prevent bias in batch comparisons
        // Fisher-Yates shuffle to ensure uniform distribution
        const papersToProcess = [...selectedPapers];
        for (let i = papersToProcess.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [papersToProcess[i], papersToProcess[j]] = [papersToProcess[j], papersToProcess[i]];
        }

        console.log(`\n=== POST-PROCESSING ${papersToProcess.length} PAPERS ===`);
        console.log(`Papers shuffled for unbiased batch comparisons`);

        const processedPapers = [];
        const batchSize = config.postProcessingBatchSize || 5;

        for (let i = 0; i < papersToProcess.length; i += batchSize) {
            if (pauseRef.current) {
                await waitForResume();
            }

            const batch = papersToProcess.slice(i, Math.min(i + batchSize, papersToProcess.length));

            try {
                let rescores;

                if (isDryRun) {
                    // Use mock API for dry run
                    const mockApiCall = async (isCorrection = false) => {
                        return await mockAPITesterRef.current.mockRescoreAbstracts(batch, isCorrection);
                    };

                    const parseResponse = (responseText) => {
                        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const rescores = JSON.parse(cleanedText);

                        if (!Array.isArray(rescores)) {
                            throw new Error("Response is not an array");
                        }

                        rescores.forEach((rescore, idx) => {
                            if (!rescore.hasOwnProperty('paperIndex') || !rescore.hasOwnProperty('adjustedScore') ||
                                !rescore.hasOwnProperty('adjustmentReason') || !rescore.hasOwnProperty('confidence')) {
                                throw new Error(`Rescore object ${idx} missing required fields`);
                            }
                            if (typeof rescore.paperIndex !== 'number' || typeof rescore.adjustedScore !== 'number' ||
                                typeof rescore.adjustmentReason !== 'string' || typeof rescore.confidence !== 'string') {
                                throw new Error(`Rescore object ${idx} has invalid field types`);
                            }
                            if (rescore.adjustedScore < 0 || rescore.adjustedScore > 10) {
                                throw new Error(`Rescore object ${idx} adjustedScore must be between 0.0 and 10.0`);
                            }
                            if (!['HIGH', 'MEDIUM', 'LOW'].includes(rescore.confidence)) {
                                throw new Error(`Rescore object ${idx} confidence must be HIGH, MEDIUM, or LOW`);
                            }
                            // Round to one decimal place
                            rescore.adjustedScore = Math.round(rescore.adjustedScore * 10) / 10;
                        });

                        return rescores;
                    };

                    rescores = await makeMockRobustAPICall(
                        mockApiCall,
                        parseResponse,
                        `Mock rescoring batch ${Math.floor(i / batchSize) + 1}`
                    );
                } else {
                    // Use real API for production
                    const makeAPICall = async (correctionPrompt = null, isCorrection = false) => {
                        const requestBody = {
                            papers: batch.map(p => ({
                                title: p.title,
                                abstract: p.abstract,
                                initialScore: p.initialScore,
                                initialJustification: p.initialJustification
                            })),
                            scoringCriteria: config.scoringCriteria,
                            password: password,
                            model: config.postProcessingModel || config.scoringModel
                        };

                        if (isCorrection && correctionPrompt) {
                            requestBody.correctionPrompt = correctionPrompt;
                        }

                        const response = await fetch('/api/rescore-abstracts', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody),
                            signal: abortControllerRef.current?.signal
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `API error: ${response.status}`);
                        }

                        const data = await response.json();
                        if (data.rescores && Array.isArray(data.rescores)) {
                            return JSON.stringify(data.rescores);
                        }
                        return data.rawResponse;
                    };

                    const parseResponse = (responseText) => {
                        let cleanedText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                        const rescores = JSON.parse(cleanedText);

                        if (!Array.isArray(rescores)) {
                            throw new Error("Response is not an array");
                        }

                        // Validate each rescore
                        rescores.forEach((rescore, idx) => {
                            if (rescore.adjustedScore < 0 || rescore.adjustedScore > 10) {
                                throw new Error(`Adjusted score must be between 0.0 and 10.0`);
                            }
                            // Round to one decimal place
                            rescore.adjustedScore = Math.round(rescore.adjustedScore * 10) / 10;
                        });

                        return rescores;
                    };

                    rescores = await makeRobustAPICall(
                        makeAPICall,
                        parseResponse,
                        `Rescoring batch ${Math.floor(i / batchSize) + 1}`,
                        `Rescore ${batch.length} paper abstracts for consistency`
                    );
                }

                // Apply rescores to papers
                rescores.forEach((rescoreData) => {
                    const paperIdx = rescoreData.paperIndex - 1;
                    if (paperIdx >= 0 && paperIdx < batch.length) {
                        const processedPaper = {
                            ...batch[paperIdx],
                            relevanceScore: rescoreData.adjustedScore,  // Update current score
                            adjustedScore: rescoreData.adjustedScore,    // Store adjusted score
                            adjustmentReason: rescoreData.adjustmentReason,
                            adjustmentConfidence: rescoreData.confidence,
                            scoreAdjustment: rescoreData.adjustedScore - batch[paperIdx].initialScore
                        };
                        processedPapers.push(processedPaper);
                    }
                });

            } catch (error) {
                // Check if this is an abort error
                if (error.message === 'Operation aborted') {
                    throw error;
                }

                addError(`Failed to rescore batch starting at paper ${i + 1}: ${error.message}`);

                // Keep original scores for failed batch
                batch.forEach(p => {
                    processedPapers.push(p);
                });
            }

            // Update progress
            setProcessing(prev => ({
                ...prev,
                progress: { current: Math.min(i + batchSize, papersToProcess.length), total: papersToProcess.length }
            }));
        }

        // Merge processed papers back with unprocessed ones
        const processedIds = new Set(processedPapers.map(p => p.id));
        const unchangedPapers = papers.filter(p => !processedIds.has(p.id));
        const allPapers = [...processedPapers, ...unchangedPapers];

        console.log(`\n=== POST-PROCESSING SUMMARY ===`);
        console.log(`Papers post-processed: ${processedPapers.length}`);
        const adjustedCount = processedPapers.filter(p => p.scoreAdjustment && Math.abs(p.scoreAdjustment) > 0.1).length;
        console.log(`Papers with adjusted scores: ${adjustedCount}`);

        // Re-sort by updated scores
        return allPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);
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
                        // Validate score range (allow 0-10 inclusive)
                        if (analysis.updatedScore < 0 || analysis.updatedScore > 10) {
                            throw new Error(`UpdatedScore must be between 0.0 and 10.0, got ${analysis.updatedScore}`);
                        }
                        // Round to one decimal place to handle floating point precision issues
                        analysis.updatedScore = Math.round(analysis.updatedScore * 10) / 10;

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
                            model: config.pdfModel
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
                        // If analysis is already parsed, return it directly; otherwise return rawResponse for parsing
                        if (data.analysis && typeof data.analysis === 'object') {
                            return JSON.stringify(data.analysis);
                        }
                        return data.rawResponse;
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
                        // Validate score range - allow decimals
                        if (analysis.updatedScore < 0 || analysis.updatedScore > 10) {
                            throw new Error(`UpdatedScore must be between 0.0 and 10.0, got ${analysis.updatedScore}`);
                        }
                        // Round to one decimal place to handle floating point precision issues
                        analysis.updatedScore = Math.round(analysis.updatedScore * 10) / 10;

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

                // Update finalRanking by replacing the analyzed paper in the existing list
                setResults(prev => {
                    const updatedRanking = [...prev.finalRanking];
                    const paperIndex = updatedRanking.findIndex(p => p.id === paper.id);
                    if (paperIndex !== -1) {
                        updatedRanking[paperIndex] = {
                            ...paper,
                            deepAnalysis: analysis,
                            finalScore: analysis.updatedScore
                        };
                    }
                    // Always re-sort the entire array by the highest available score
                    updatedRanking.sort((a, b) => {
                        const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
                        const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
                        return scoreB - scoreA;
                    });

                    return { ...prev, finalRanking: updatedRanking };
                });

                await new Promise(resolve => setTimeout(resolve, isDryRun ? 100 : 2000));

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

        // Reset filter results for new processing
        setFilterResults({
            total: 0,
            yes: [],
            maybe: [],
            no: [],
            inProgress: false,
            currentBatch: 0,
            totalBatches: 0
        });

        pauseRef.current = false;
        abortControllerRef.current = new AbortController();

        let finalPapers = []; // Track final papers locally

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

            // Stage 2: Quick filter (if enabled)
            let papersToScore = papers;
            if (config.useQuickFilter) {
                papersToScore = await performQuickFilter(papers, isDryRun);

                if (papersToScore.length === 0) {
                    addError('No papers passed the initial filter. Consider adjusting filter criteria or categories.');
                    return;
                }

                console.log(`\n=== FILTER COMPLETE ===`);
                console.log(`Papers proceeding to scoring: ${papersToScore.length} of ${papers.length} (${Math.round(papersToScore.length / papers.length * 100)}%)`);
            }

            // Stage 3: Score abstracts (now returns only successfully scored papers)
            const scoredPapers = await scoreAbstracts(papersToScore, isDryRun);

            if (scoredPapers.length === 0) {
                addError('No papers could be scored successfully. Check your API configuration and try again.');
                return;
            }

            // Stage 3.5: Post-process scores for consistency (optional)
            let postProcessedPapers = scoredPapers;
            if (config.enableScorePostProcessing) {
                postProcessedPapers = await postProcessScores(scoredPapers, isDryRun);
            }

            // Stage 4: Select top papers for deep analysis (now working with filtered, sorted, and optionally post-processed papers)
            setProcessing(prev => ({ ...prev, stage: 'selecting' }));

            // Use the sorted postProcessedPapers from results, and ensure minimum score threshold
            // Use the local postProcessedPapers variable (not results.scoredPapers which may not be updated yet)
            const availablePapers = postProcessedPapers.filter(paper =>
                paper.relevanceScore > 0 && paper.scoreJustification !== 'Failed to score after retries'
            );

            const topPapers = availablePapers.slice(0, config.maxDeepAnalysis);

            console.log(`\n=== SELECTION SUMMARY ===`);
            console.log(`Available papers for deep analysis: ${availablePapers.length}`);
            console.log(`Selected for deep analysis: ${topPapers.length}`);

            if (topPapers.length === 0) {
                addError('No papers qualified for deep analysis. All papers either failed to score or had zero relevance.');
                return;
            }

            // Pre-populate finalRanking to prevent empty state during PDF analysis
            setResults(prev => ({ ...prev, finalRanking: topPapers }));

            // Stage 5: Deep analysis
            const analyzedPapers = await analyzePDFs(topPapers, isDryRun);

            // Stage 6: Final ranking and output
            setProcessing(prev => ({ ...prev, stage: 'complete' }));

            // Sort by final score (or relevance score as fallback)
            analyzedPapers.sort((a, b) => {
                const scoreA = a.finalScore ?? a.relevanceScore ?? 0;
                const scoreB = b.finalScore ?? b.relevanceScore ?? 0;
                return scoreB - scoreA;
            });

            finalPapers = analyzedPapers.slice(0, config.finalOutputCount);

            setResults(prev => ({ ...prev, finalRanking: finalPapers }));

        } catch (error) {
            if (error.name !== 'AbortError' && error.message !== 'Operation aborted') {
                addError(`Processing failed: ${error.message}`);
            }
        } finally {
            const endTime = new Date();
            const duration = startTime ? endTime - startTime : 0;
            setProcessingTiming(prev => ({
                ...prev,
                startTime: prev.startTime || startTime,
                endTime,
                duration
            }));

            setProcessing(prev => ({
                ...prev,
                isRunning: false,
                isPaused: false,
                // Use local finalPapers array instead of results.finalRanking
                stage: finalPapers.length > 0 ? 'complete' : 'idle'
            }));
        }
    };

    // Enhanced test functions with proper abort controller setup
    const runDryRunTest = async () => {
        setTestState(prev => ({ ...prev, dryRunInProgress: true }));

        try {
            // Create new abort controller for this test
            const oldAbortController = abortControllerRef.current;
            abortControllerRef.current = new AbortController();

            // Reset mock API tester to enhanced version
            mockAPITesterRef.current = new MockAPITesterEnhanced();
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

            // Restore previous abort controller
            abortControllerRef.current = oldAbortController;

        } catch (error) {
            if (error.message === 'Operation aborted') {
                addError('Dry run test was cancelled');
            } else {
                addError(`Dry run test failed: ${error.message}`);
            }
            setTestState(prev => ({ ...prev, dryRunInProgress: false }));
        }
    };

    const runMinimalTest = async () => {
        setTestState(prev => ({ ...prev, minimalTestInProgress: true }));

        try {
            // Create new abort controller for this test
            const oldAbortController = abortControllerRef.current;
            abortControllerRef.current = new AbortController();

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

            // Restore previous abort controller
            abortControllerRef.current = oldAbortController;

        } catch (error) {
            if (error.message === 'Operation aborted') {
                addError('Minimal test was cancelled');
            } else {
                addError(`Minimal test failed: ${error.message}`);
            }
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

    // Enhanced handleStop function
    const handleStop = () => {
        console.log('Stop button clicked - aborting all operations');

        // Abort current operations
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            console.log('Abort signal sent');
        }

        // Reset pause state
        pauseRef.current = false;

        // Update UI state immediately
        setProcessing(prev => ({
            ...prev,
            isRunning: false,
            isPaused: false,
            stage: 'idle'
        }));

        // Reset test states
        setTestState(prev => ({
            ...prev,
            dryRunInProgress: false,
            minimalTestInProgress: false
        }));

        addError('Operation stopped by user');
    };

    const handleReset = () => {
        handleStop();
        setResults({ allPapers: [], scoredPapers: [], finalRanking: [] });
        setFilterResults({
            total: 0,
            yes: [],
            maybe: [],
            no: [],
            inProgress: false,
            currentBatch: 0,
            totalBatches: 0
        });
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
        const timestamp = new Date().toLocaleString();
        const duration = processingTiming.duration ? Math.round(processingTiming.duration / 60000) : 0;

        const header = `# Aparture Analysis Report

**Generated:** ${timestamp}  
**Duration:** ${duration} minutes  
**Abstracts Screened:** ${results.scoredPapers.length}  
**Papers Analyzed:** ${Math.min(results.scoredPapers.length, config.maxDeepAnalysis)}
**Final Report:** ${results.finalRanking.length}
**Categories:** ${config.selectedCategories.join(', ')}  
**Models Used:** ${config.useQuickFilter ? config.filterModel + ' (filter), ' : ''}${config.scoringModel} (scoring), ${config.pdfModel} (PDF analysis)

---

`;

        const papers = results.finalRanking.map((paper, idx) => {
            const authorTag = paper.authors.length > 0 ?
                (paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(' & ')) :
                'Unknown';

            return `## ${idx + 1}. ${paper.title}

**Score:** ${(paper.finalScore || paper.relevanceScore).toFixed(1)}/10
**arXiv ID:** [${paper.id}](https://arxiv.org/abs/${paper.id})  
**Authors:** ${authorTag}  

### Relevance Assessment
${paper.deepAnalysis?.relevanceAssessment || paper.scoreJustification}

### Key Findings
${paper.deepAnalysis?.keyFindings || 'N/A'}

### Methodology
${paper.deepAnalysis?.methodology || 'N/A'}

### Limitations
${paper.deepAnalysis?.limitations || 'N/A'}

### Detailed Technical Summary
${paper.deepAnalysis?.summary || 'No deep analysis available'}

---`;
        }).join('\n\n');

        const output = header + papers;

        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Generate filename with timing info
        const fileTimestamp = processingTiming.startTime ?
            processingTiming.startTime.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
            processingTiming.startTime.toTimeString().split(' ')[0].replace(/:/g, '-') :
            new Date().toISOString().split('T')[0];

        const durationStr = processingTiming.duration ?
            `_${Math.round(processingTiming.duration / 60000)}min` : '';

        a.download = `arxiv_analysis_${fileTimestamp}${durationStr}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Generate NotebookLM document
    const generateNotebookLM = async () => {
        try {
            setNotebookLMGenerating(true);
            setNotebookLMStatus('Generating NotebookLM document...');
            setNotebookLMContent(null);
            setHallucinationWarning(null); // Reset previous warning

            // Combine scored papers and final ranking
            const allPapers = results.finalRanking && results.finalRanking.length > 0 ?
                results.finalRanking :
                results.scoredPapers.filter(p => (p.score > 0 || p.relevanceScore > 0));

            if (allPapers.length === 0) {
                setNotebookLMStatus('No papers available for NotebookLM generation');
                setNotebookLMGenerating(false);
                return;
            }

            let markdown;

            // Use mock API if in test mode
            if (testState.dryRunInProgress && mockAPITesterRef.current) {
                console.log('Using mock NotebookLM generation API...');
                markdown = await mockAPITesterRef.current.mockGenerateNotebookLM(
                    allPapers,
                    podcastDuration,
                    notebookLMModel
                );
            } else {
                const response = await fetch('/api/generate-notebooklm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        papers: allPapers.map(paper => ({
                            ...paper,
                            pdfAnalysis: paper.pdfAnalysis || null
                        })),
                        scoringCriteria: config.scoringCriteria,
                        targetDuration: podcastDuration,
                        model: notebookLMModel,
                        password,
                        enableHallucinationCheck
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to generate NotebookLM document');
                }

                markdown = data.markdown;

                // Handle hallucination warning
                if (data.metadata?.hallucinationDetected) {
                    const issueCount = data.metadata.hallucinationIssues?.length || 0;
                    const fictionalPapers = data.metadata.hallucinationIssues?.filter(i => i.includes('HALLUCINATED PAPER')).length || 0;

                    setHallucinationWarning({
                        detected: true,
                        issues: data.metadata.hallucinationIssues || [],
                        summary: `Found ${fictionalPapers} fictional papers and ${issueCount - fictionalPapers} other issues`,
                        resolved: data.metadata.strictModeSuccessful !== false
                    });

                    addError(`Hallucination detected: ${issueCount} issues found - automatically corrected with strict mode`);
                    if (data.metadata.strictModeSuccessful !== false) {
                        addError('✓ Strict mode successfully prevented hallucinations');
                    }
                } else if (data.metadata?.warnings?.length > 0) {
                    console.log('Minor warnings:', data.metadata.warnings);
                } else {
                    setHallucinationWarning(null);
                }
            }

            setNotebookLMContent(markdown);
            setNotebookLMStatus('NotebookLM document generated successfully');
        } catch (error) {
            console.error('NotebookLM generation error:', error);
            setNotebookLMStatus(`Error: ${error.message}`);
        } finally {
            setNotebookLMGenerating(false);
        }
    };

    // Download NotebookLM document
    const downloadNotebookLM = () => {
        if (!notebookLMContent) return;

        const blob = new Blob([notebookLMContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `notebooklm_${timestamp}_${podcastDuration}min.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Get stage display name
    const getStageDisplay = () => {
        const stages = {
            'idle': 'Ready',
            'fetching': 'Fetching Categories',
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

    // Paper Card Component
    const PaperCard = ({ paper, idx, showDeepAnalysis }) => (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            #{idx + 1}
                        </span>
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                            Score: {(paper.finalScore || paper.relevanceScore).toFixed(1)}/10
                        </span>
                        {paper.scoreAdjustment && Math.abs(paper.scoreAdjustment) > 0.1 && (
                            <span
                                className={`text-xs px-2 py-1 rounded ${paper.scoreAdjustment > 0
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-orange-500/20 text-orange-400'
                                    }`}
                                title={paper.adjustmentReason}
                            >
                                {paper.scoreAdjustment > 0 ? '↑' : '↓'} {Math.abs(paper.scoreAdjustment).toFixed(1)}
                            </span>
                        )}
                        {showDeepAnalysis && paper.deepAnalysis && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                📄 PDF Analyzed
                            </span>
                        )}

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
                    {showDeepAnalysis && paper.deepAnalysis && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                                {paper.deepAnalysis.summary}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

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
                                AI Model Configuration
                            </label>


                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Quick Filter Model */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Quick Filter Model (Stage 1)
                                    </label>
                                    <select
                                        value={config.filterModel}
                                        onChange={(e) => setConfig(prev => ({ ...prev, filterModel: e.target.value }))}
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
                                        <p className="text-xs text-gray-300">
                                            {AVAILABLE_MODELS.find(m => m.id === config.filterModel)?.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Abstract Scoring Model */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Abstract Scoring Model (Stage 2)
                                    </label>
                                    <select
                                        value={config.scoringModel}
                                        onChange={(e) => setConfig(prev => ({ ...prev, scoringModel: e.target.value }))}
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
                                        <p className="text-xs text-gray-300">
                                            {AVAILABLE_MODELS.find(m => m.id === config.scoringModel)?.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Deep PDF Analysis Model */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Deep PDF Analysis Model (Stage 3)
                                    </label>
                                    <select
                                        value={config.pdfModel}
                                        onChange={(e) => setConfig(prev => ({ ...prev, pdfModel: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                                        disabled={processing.isRunning}
                                    >
                                        {AVAILABLE_MODELS.filter(m => m.supportsPDF).map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                                        <p className="text-xs text-gray-300">
                                            {AVAILABLE_MODELS.find(m => m.id === config.pdfModel)?.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                                <p className="text-xs text-blue-300">
                                    <strong>Tip:</strong> Use cheaper models for early filtering and scoring stages, and more expensive models for analyzing PDFs to optimize cost while maintaining accuracy.
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
                                <div className="mt-3 space-y-4 pl-5 border-l-2 border-slate-700">
                                    {/* Query Options */}
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Query Options</p>
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
                                                <p className="text-xs text-gray-400 mt-1">ArXiv search range</p>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Correction Attempts
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
                                                <p className="text-xs text-gray-400 mt-1">Fix malformed responses</p>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Retry Attempts
                                                </label>
                                                <input
                                                    type="number"
                                                    value={config.maxRetries}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) || 3 }))}
                                                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                    min="0"
                                                    max="10"
                                                    disabled={processing.isRunning}
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Retry failed API calls</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filter Options */}
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Filter Options</p>
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Filter Batch Size
                                                </label>
                                                <input
                                                    type="number"
                                                    value={config.filterBatchSize}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, filterBatchSize: parseInt(e.target.value) || 10 }))}
                                                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                    min="1"
                                                    max="20"
                                                    disabled={processing.isRunning}
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Papers per API call</p>
                                            </div>
                                            <div className="flex-2">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">Categories to Process</label>
                                                <div className="flex gap-4 py-1.5">
                                                    {['YES', 'MAYBE', 'NO'].map(category => (
                                                        <label key={category} className="flex items-center text-sm text-gray-300">
                                                            <input
                                                                type="checkbox"
                                                                checked={config.categoriesToScore.includes(category)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setConfig(prev => ({ ...prev, categoriesToScore: [...prev.categoriesToScore, category] }));
                                                                    } else {
                                                                        setConfig(prev => ({ ...prev, categoriesToScore: prev.categoriesToScore.filter(c => c !== category) }));
                                                                    }
                                                                }}
                                                                className="mr-2 h-4 w-4"
                                                                disabled={processing.isRunning}
                                                            />
                                                            {category}
                                                        </label>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">Filter results to score</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Abstract Scoring Options */}
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Abstract Scoring Options</p>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={config.enableScorePostProcessing}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, enableScorePostProcessing: e.target.checked }))}
                                                    disabled={processing.isRunning}
                                                    className="rounded border-slate-600 text-blue-500 focus:ring-blue-500"
                                                />
                                                <span className="text-xs text-gray-300">Enable Post-Processing</span>
                                            </label>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Scoring Batch Size
                                                </label>
                                                <input
                                                    type="number"
                                                    value={config.scoringBatchSize}
                                                    onChange={(e) => setConfig(prev => ({ ...prev, scoringBatchSize: parseInt(e.target.value) || 3 }))}
                                                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                    min="1"
                                                    max="10"
                                                    disabled={processing.isRunning}
                                                />
                                                <p className="text-xs text-gray-400 mt-1">Papers per API call</p>
                                            </div>
                                            {config.enableScorePostProcessing && (
                                                <>
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                                            Review Batch Size
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={config.postProcessingBatchSize}
                                                            onChange={(e) => setConfig(prev => ({ ...prev, postProcessingBatchSize: parseInt(e.target.value) || 5 }))}
                                                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                            min="3"
                                                            max="10"
                                                            disabled={processing.isRunning}
                                                        />
                                                        <p className="text-xs text-gray-400 mt-1">Papers per comparison</p>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                                            Papers to Review
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={config.postProcessingCount}
                                                            onChange={(e) => setConfig(prev => ({ ...prev, postProcessingCount: parseInt(e.target.value) || 50 }))}
                                                            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                                                            min="5"
                                                            max="200"
                                                            disabled={processing.isRunning}
                                                        />
                                                        <p className="text-xs text-gray-400 mt-1">Top papers to post-process</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {config.enableScorePostProcessing && (
                                            <div className="bg-slate-800/50 rounded-lg p-2 mt-2">
                                                <p className="text-xs text-gray-400">
                                                    Post-processing reviews initial scores for consistency by comparing papers in batches.
                                                    This helps correct scoring errors from complex research criteria.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* PDF Analysis Options */}
                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">PDF Analysis Options</p>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Papers to Analyze
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
                                                <p className="text-xs text-gray-400 mt-1">Number of PDFs to analyze</p>
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                                    Summaries to Output
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
                                                <p className="text-xs text-gray-400 mt-1">Final papers to display</p>
                                            </div>
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
                        {testState.dryRunInProgress && (
                            <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                <TestTube className="w-3 h-3" />
                                DRY RUN MODE
                            </span>
                        )}
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
                                        <span>
                                            {processing.progress.current} / {processing.progress.total} {
                                                processing.stage === 'fetching' ? 'categories' : 'papers'
                                            }
                                        </span>
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
                                {testState.dryRunInProgress && (
                                    <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                        <TestTube className="w-3 h-3" />
                                        TEST DATA
                                    </span>
                                )}
                            </div>

                            {processingTiming.startTime && (
                                <div className="text-sm text-gray-400 mb-3">
                                    {processingTiming.endTime ? (
                                        <>
                                            Completed: {processingTiming.endTime.toLocaleString()}
                                            <span className="mx-2">•</span>
                                            Duration: {processingTiming.duration ? Math.round(processingTiming.duration / 60000) : 0} minutes
                                            <span className="mx-2">•</span>
                                            {results.scoredPapers.length} abstracts screened
                                            <span className="mx-2">•</span>
                                            {Math.min(results.scoredPapers.length, config.maxDeepAnalysis)} papers analyzed
                                            <span className="mx-2">•</span>
                                            {results.finalRanking.length} papers summarized
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

                {/* NotebookLM Podcast Generation Section */}
                {(results.scoredPapers.length > 0 || results.finalRanking.length > 0) && (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-purple-400" />
                                <h2 className="text-xl font-semibold">NotebookLM Podcast Generation</h2>
                                {testState.dryRunInProgress && (
                                    <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                        <TestTube className="w-3 h-3" />
                                        TEST MODE
                                    </span>
                                )}
                            </div>

                            {/* Hallucination Check Control */}
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={enableHallucinationCheck}
                                    onChange={(e) => setEnableHallucinationCheck(e.target.checked)}
                                    className="rounded border-gray-600 text-purple-500 focus:ring-purple-500"
                                />
                                Enable hallucination check & retry
                            </label>
                        </div>

                        <p className="text-sm text-gray-400 mb-4">
                            Generate a structured document optimized for NotebookLM to create an expert-level podcast discussion
                        </p>

                        {/* Hallucination Warning */}
                        {hallucinationWarning && (
                            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                                <p className="text-yellow-400 text-sm font-medium mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Hallucination detected and corrected
                                </p>
                                {hallucinationWarning.issues && hallucinationWarning.issues.length > 0 && (
                                    <>
                                        <p className="text-yellow-300 text-xs mb-2">{hallucinationWarning.summary}</p>
                                        <details className="text-yellow-300 text-xs">
                                            <summary className="cursor-pointer hover:text-yellow-200">View details</summary>
                                            <ul className="mt-2 space-y-1 pl-4">
                                                {hallucinationWarning.issues.map((issue, i) => (
                                                    <li key={i} className="list-disc">{issue}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    </>
                                )}
                                {hallucinationWarning.resolved ? (
                                    <p className="text-green-400 text-xs mt-2">✓ Successfully corrected with strict generation mode</p>
                                ) : (
                                    <p className="text-orange-400 text-xs mt-2">⚠️ Some issues may persist - please review carefully</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Duration and Model Selection on same line */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Duration Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Target Podcast Duration
                                    </label>
                                    <select
                                        value={podcastDuration}
                                        onChange={(e) => setPodcastDuration(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm"
                                        disabled={notebookLMGenerating}
                                    >
                                        <option value="5">5 minutes - Quick Overview</option>
                                        <option value="10">10 minutes - Standard Discussion</option>
                                        <option value="15">15 minutes - Detailed Analysis</option>
                                        <option value="20">20 minutes - In-depth Coverage (Recommended)</option>
                                        <option value="30">30 minutes - Comprehensive Review</option>
                                    </select>
                                </div>

                                {/* Model Selection */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2">
                                        Generation Model
                                    </label>
                                    <select
                                        value={notebookLMModel}
                                        onChange={(e) => setNotebookLMModel(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm"
                                        disabled={notebookLMGenerating}
                                    >
                                        {AVAILABLE_MODELS.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Model description below both dropdowns */}
                            <div className="p-2 bg-slate-800/50 rounded-lg">
                                <p className="text-xs text-gray-300">
                                    <span className="text-gray-400">Model: </span>
                                    {AVAILABLE_MODELS.find(m => m.id === notebookLMModel)?.description}
                                </p>
                            </div>

                            {/* Status Display */}
                            {notebookLMStatus && (
                                <div className={`p-3 rounded-lg text-sm ${notebookLMStatus.includes('Error')
                                    ? 'bg-red-900/20 text-red-400 border border-red-800'
                                    : notebookLMStatus.includes('successfully')
                                        ? 'bg-green-900/20 text-green-400 border border-green-800'
                                        : 'bg-blue-900/20 text-blue-400 border border-blue-800'
                                    }`}>
                                    {notebookLMStatus}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={generateNotebookLM}
                                    disabled={notebookLMGenerating || results.scoredPapers.length === 0}
                                    className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${notebookLMGenerating || results.scoredPapers.length === 0
                                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                                        }`}
                                >
                                    {notebookLMGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-4 h-4" />
                                            Generate NotebookLM File
                                        </>
                                    )}
                                </button>

                                {notebookLMContent && (
                                    <button
                                        onClick={downloadNotebookLM}
                                        className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download NotebookLM Document
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Scored Papers Display - Show papers that have been scored */}
                {(results.scoredPapers.length > 0 || results.finalRanking.length > 0) && (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                        <div className="flex items-center mb-4">
                            <FileText className="w-5 h-5 mr-2 text-green-400" />
                            <h2 className="text-xl font-semibold">
                                {results.finalRanking.length > 0 ? 'Analysis Results' : 'Scored Papers'}
                            </h2>
                            {testState.dryRunInProgress && (
                                <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                    <TestTube className="w-3 h-3" />
                                    TEST DATA
                                </span>
                            )}
                        </div>

                        {(() => {
                            // During/after deep analysis: show two sections
                            if (results.finalRanking.length > 0 && (processing.stage === 'deep-analysis' || processing.stage === 'complete')) {
                                const deepAnalyzedIds = new Set(results.finalRanking.map(p => p.id));
                                const abstractOnlyPapers = results.scoredPapers.filter(p => !deepAnalyzedIds.has(p.id));

                                return (
                                    <div className="space-y-6">
                                        {/* Deep Analysis Section */}
                                        <div>
                                            <h3 className="text-lg font-medium mb-3 text-blue-400">
                                                📄 Papers with Deep PDF Analysis ({results.finalRanking.length})
                                            </h3>
                                            <div className="space-y-2 max-h-[1000px] overflow-y-auto pr-2">
                                                {results.finalRanking.map((paper, idx) => (
                                                    <PaperCard key={paper.id} paper={paper} idx={idx} showDeepAnalysis={true} />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Abstract Only Section */}
                                        {abstractOnlyPapers.length > 0 && (
                                            <div>
                                                <h3 className="text-lg font-medium mb-3 text-gray-400">
                                                    📋 Abstract-Only Scores ({abstractOnlyPapers.length})
                                                </h3>
                                                <div className="space-y-2 max-h-[750px] overflow-y-auto pr-2">
                                                    {abstractOnlyPapers.map((paper, idx) => (
                                                        <PaperCard key={paper.id} paper={paper} idx={results.finalRanking.length + idx} showDeepAnalysis={false} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // During abstract scoring: show all scored papers with scroll
                            return (
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                    {results.scoredPapers.map((paper, idx) => (
                                        <PaperCard key={paper.id} paper={paper} idx={idx} showDeepAnalysis={false} />
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Filtered Papers Display - Persistent display that shows all papers */}
                {(filterResults.yes.length > 0 || filterResults.maybe.length > 0 || filterResults.no.length > 0) && (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
                        <div className="flex items-center mb-4">
                            <FileText className="w-5 h-5 mr-2 text-yellow-400" />
                            <h2 className="text-xl font-semibold">
                                Filtered Papers
                                {filterResults.inProgress && (
                                    <span className="text-sm text-gray-400 ml-2">
                                        (Processing batch {filterResults.currentBatch || 0} of {filterResults.totalBatches || 0})
                                    </span>
                                )}
                            </h2>
                            {testState.dryRunInProgress && (
                                <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                                    <TestTube className="w-3 h-3" />
                                    TEST DATA
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Get scored paper IDs to exclude them from filtered display */}
                            {(() => {
                                // Include all scored papers from results
                                const scoredPaperIds = new Set([
                                    ...results.scoredPapers.map(p => p.id),
                                    ...(results.failedPapers || []).map(p => p.id)
                                ]);

                                const unscoredYes = filterResults.yes.filter(p => !scoredPaperIds.has(p.id));
                                const unscoredMaybe = filterResults.maybe.filter(p => !scoredPaperIds.has(p.id));
                                const unscoredNo = filterResults.no.filter(p => !scoredPaperIds.has(p.id));

                                // Count how many were actually scored from each category
                                const scoredYesCount = filterResults.yes.filter(p => scoredPaperIds.has(p.id)).length;
                                const scoredMaybeCount = filterResults.maybe.filter(p => scoredPaperIds.has(p.id)).length;

                                return (
                                    <>
                                        {/* YES papers (excluding scored ones) */}
                                        {unscoredYes.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-medium mb-2 text-green-400">
                                                    ✓ YES ({unscoredYes.length})
                                                    {scoredYesCount > 0 && (
                                                        <span className="text-xs text-gray-400 ml-2">
                                                            ({scoredYesCount} scored)
                                                        </span>
                                                    )}
                                                </h3>
                                                <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2">
                                                    {unscoredYes.map((paper) => (
                                                        <div key={paper.id} className="bg-slate-800/50 rounded-lg p-3 border border-green-900/50">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <h4 className="text-sm font-medium text-white">{paper.title}</h4>
                                                                    <p className="text-xs text-gray-400 mt-1">
                                                                        {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* MAYBE papers (excluding scored ones) */}
                                        {unscoredMaybe.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-medium mb-2 text-yellow-400">
                                                    ? MAYBE ({unscoredMaybe.length})
                                                    {scoredMaybeCount > 0 && (
                                                        <span className="text-xs text-gray-400 ml-2">
                                                            ({scoredMaybeCount} scored)
                                                        </span>
                                                    )}
                                                </h3>
                                                <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2">
                                                    {unscoredMaybe.map((paper) => (
                                                        <div key={paper.id} className="bg-slate-800/50 rounded-lg p-3 border border-yellow-900/50">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <h4 className="text-sm font-medium text-white">{paper.title}</h4>
                                                                    <p className="text-xs text-gray-400 mt-1">
                                                                        {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* NO papers (not being scored, so show all) */}
                                        {unscoredNo.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-medium mb-2 text-red-400">
                                                    ✗ NO ({unscoredNo.length} filtered out)
                                                </h3>
                                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                                                    {unscoredNo.map((paper) => (
                                                        <div key={paper.id} className="bg-slate-800/50 rounded-lg p-3 border border-red-900/50">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <h4 className="text-sm font-medium text-white">{paper.title}</h4>
                                                                    <p className="text-xs text-gray-400 mt-1">
                                                                        {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Summary stats */}
                                        {(unscoredYes.length > 0 || unscoredMaybe.length > 0 || unscoredNo.length > 0) && (
                                            <div className="pt-3 border-t border-slate-700 text-xs text-gray-400">
                                                <div className="flex justify-between">
                                                    <span>
                                                        Filtered: {filterResults.yes.length + filterResults.maybe.length + filterResults.no.length} papers
                                                    </span>
                                                    <span>
                                                        Remaining to score: {unscoredYes.length + unscoredMaybe.length}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ArxivAnalyzer;