import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ARXIV_CATEGORIES, getCategoryDisplayName } from '../../utils/arxivCategories.js';
import { AVAILABLE_MODELS } from '../../utils/models.js';

export default function SettingsPanel({ config, setConfig, processing }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showCategoryDropdown) return undefined;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
        setExpandedCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown]);

  const addCategory = (categoryCode) => {
    setConfig((prev) => ({
      ...prev,
      selectedCategories: [...new Set([...prev.selectedCategories, categoryCode])],
    }));
  };

  const removeCategory = (categoryCode) => {
    setConfig((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.filter((cat) => cat !== categoryCode),
    }));
  };

  const addMainCategory = (mainCategoryName) => {
    const categoryData = ARXIV_CATEGORIES[mainCategoryName];
    if (!categoryData) return;
    const newCategories = Object.values(categoryData.subcategories).map((subcat) => subcat.code);
    setConfig((prev) => ({
      ...prev,
      selectedCategories: [...new Set([...prev.selectedCategories, ...newCategories])],
    }));
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center mb-4">
        <Settings className="w-5 h-5 mr-2 text-blue-400" />
        <h2 className="text-xl font-semibold">Configuration</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">ArXiv Categories</label>

          <div className="min-h-[2.5rem] p-3 bg-slate-800 border border-slate-700 rounded-lg mb-2">
            {config.selectedCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {config.selectedCategories.map((category) => (
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

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-left text-white hover:bg-slate-600 transition-colors flex items-center justify-between"
              disabled={processing.isRunning}
            >
              <span>Add Categories</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showCategoryDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                {Object.entries(ARXIV_CATEGORIES).map(([mainCategory, data]) => (
                  <div key={mainCategory} className="border-b border-slate-700 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === mainCategory ? null : mainCategory
                          )
                        }
                        className="flex-1 px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-2"
                      >
                        {expandedCategory === mainCategory ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
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
                        {Object.entries(data.subcategories).map(([_subKey, subData]) => (
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
            Click categories to select them. Use &quot;Add All&quot; to select entire sections.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            AI Model Configuration
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Quick Filter Model (Stage 1)
              </label>
              <select
                value={config.filterModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, filterModel: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-gray-300">
                  {AVAILABLE_MODELS.find((m) => m.id === config.filterModel)?.description}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Abstract Scoring Model (Stage 2)
              </label>
              <select
                value={config.scoringModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, scoringModel: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-gray-300">
                  {AVAILABLE_MODELS.find((m) => m.id === config.scoringModel)?.description}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Deep PDF Analysis Model (Stage 3)
              </label>
              <select
                value={config.pdfModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, pdfModel: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.filter((m) => m.supportsPDF).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-gray-300">
                  {AVAILABLE_MODELS.find((m) => m.id === config.pdfModel)?.description}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Briefing Model (synthesis + suggest)
              </label>
              <select
                value={config.briefingModel ?? config.pdfModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, briefingModel: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm"
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.filter((m) => m.supportsPDF).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 p-2 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-gray-300">
                  {
                    AVAILABLE_MODELS.find((m) => m.id === (config.briefingModel ?? config.pdfModel))
                      ?.description
                  }
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
            <p className="text-xs text-blue-300">
              <strong>Tip:</strong> Use cheaper models for early filtering and scoring stages, and
              more expensive models for analyzing PDFs to optimize cost while maintaining accuracy.
            </p>
          </div>

          <div className="mt-4 p-3 bg-slate-800/40 border border-slate-700 rounded-lg">
            <p className="text-xs font-medium text-gray-300 mb-2">Briefing hallucination check</p>
            <p className="text-xs text-gray-500 mb-3">
              After a briefing is generated, a second model call audits it for unsupported claims.
              If the check flags problems, the briefing is regenerated up to one additional time
              based on the criteria below.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.briefingRetryOnYes ?? true}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, briefingRetryOnYes: e.target.checked }))
                  }
                  className="rounded border-gray-600 text-red-500 focus:ring-red-500"
                  disabled={processing.isRunning}
                />
                Retry briefing if the check returns{' '}
                <span className="text-red-400 font-medium">YES</span> (definite hallucination)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.briefingRetryOnMaybe ?? false}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, briefingRetryOnMaybe: e.target.checked }))
                  }
                  className="rounded border-gray-600 text-red-500 focus:ring-red-500"
                  disabled={processing.isRunning}
                />
                Retry briefing if the check returns{' '}
                <span className="text-yellow-400 font-medium">MAYBE</span> (possible hallucination)
              </label>
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showAdvanced ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            Advanced Options
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4 pl-5 border-l-2 border-slate-700">
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Query Options
                </p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Days to Look Back
                    </label>
                    <input
                      type="number"
                      value={config.daysBack}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          daysBack: parseInt(e.target.value) || 7,
                        }))
                      }
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
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxCorrections: parseInt(e.target.value) || 1,
                        }))
                      }
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
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxRetries: parseInt(e.target.value) || 3,
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      min="0"
                      max="10"
                      disabled={processing.isRunning}
                    />
                    <p className="text-xs text-gray-400 mt-1">Retry failed API calls</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Filter Options
                </p>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Filter Batch Size
                    </label>
                    <input
                      type="number"
                      value={config.filterBatchSize}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          filterBatchSize: parseInt(e.target.value) || 3,
                        }))
                      }
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      min="1"
                      max="20"
                      disabled={processing.isRunning}
                    />
                    <p className="text-xs text-gray-400 mt-1">Papers per API call</p>
                  </div>
                  <div className="flex-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Categories to Process
                    </label>
                    <div className="flex gap-4 py-1.5">
                      {['YES', 'MAYBE', 'NO'].map((category) => (
                        <label key={category} className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={config.categoriesToScore.includes(category)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfig((prev) => ({
                                  ...prev,
                                  categoriesToScore: [...prev.categoriesToScore, category],
                                }));
                              } else {
                                setConfig((prev) => ({
                                  ...prev,
                                  categoriesToScore: prev.categoriesToScore.filter(
                                    (c) => c !== category
                                  ),
                                }));
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

              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Abstract Scoring Options
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enableScorePostProcessing}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          enableScorePostProcessing: e.target.checked,
                        }))
                      }
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
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          scoringBatchSize: parseInt(e.target.value) || 3,
                        }))
                      }
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
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              postProcessingBatchSize: parseInt(e.target.value) || 5,
                            }))
                          }
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
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              postProcessingCount: parseInt(e.target.value) || 50,
                            }))
                          }
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
                      Post-processing reviews initial scores for consistency by comparing papers in
                      batches. This helps correct scoring errors from complex research criteria.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  PDF Analysis Options
                </p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Papers to Analyze
                    </label>
                    <input
                      type="number"
                      value={config.maxDeepAnalysis}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxDeepAnalysis: parseInt(e.target.value) || 30,
                        }))
                      }
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
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          finalOutputCount: parseInt(e.target.value) || 15,
                        }))
                      }
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
  );
}
