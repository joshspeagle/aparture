import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ARXIV_CATEGORIES, getCategoryDisplayName } from '../../utils/arxivCategories.js';
import { AVAILABLE_MODELS } from '../../utils/models.js';
import Button from '../ui/Button.jsx';
import Checkbox from '../ui/Checkbox.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';

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
    <div
      style={{
        background: 'var(--aparture-surface)',
        borderRadius: '8px',
        padding: 'var(--aparture-space-6)',
        marginBottom: 'var(--aparture-space-6)',
        border: '1px solid var(--aparture-hairline)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        <Settings
          style={{
            width: '20px',
            height: '20px',
            marginRight: 'var(--aparture-space-2)',
            color: 'var(--aparture-accent)',
          }}
        />
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            margin: 0,
          }}
        >
          Configuration
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            ArXiv Categories
          </label>

          <div
            style={{
              minHeight: '2.5rem',
              padding: 'var(--aparture-space-3)',
              background: 'var(--aparture-bg)',
              border: '1px solid var(--aparture-hairline)',
              borderRadius: '4px',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            {config.selectedCategories.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--aparture-space-2)' }}>
                {config.selectedCategories.map((category) => (
                  <span
                    key={category}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      background: 'color-mix(in srgb, var(--aparture-accent) 15%, transparent)',
                      color: 'var(--aparture-accent)',
                      borderRadius: '4px',
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      border:
                        '1px solid color-mix(in srgb, var(--aparture-accent) 25%, transparent)',
                    }}
                  >
                    {category}
                    <button
                      onClick={() => removeCategory(category)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 'inherit',
                        lineHeight: 1,
                      }}
                      disabled={processing.isRunning}
                      title={getCategoryDisplayName(category)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-sm)',
                  color: 'var(--aparture-mute)',
                }}
              >
                No categories selected
              </span>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <Button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={processing.isRunning}
              style={{
                width: '100%',
                justifyContent: 'space-between',
                textAlign: 'left',
              }}
            >
              <span>Add Categories</span>
              <ChevronDown
                style={{
                  width: '16px',
                  height: '16px',
                  transition: 'transform 150ms ease',
                  transform: showCategoryDropdown ? 'rotate(180deg)' : 'none',
                }}
              />
            </Button>

            {showCategoryDropdown && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 50,
                  width: '100%',
                  marginTop: '4px',
                  background: 'var(--aparture-surface)',
                  border: '1px solid var(--aparture-hairline)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  maxHeight: '384px',
                  overflowY: 'auto',
                }}
              >
                {Object.entries(ARXIV_CATEGORIES).map(([mainCategory, data]) => (
                  <div
                    key={mainCategory}
                    style={{
                      borderBottom: '1px solid var(--aparture-hairline)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedCategory(
                            expandedCategory === mainCategory ? null : mainCategory
                          )
                        }
                        style={{
                          flex: 1,
                          padding: 'var(--aparture-space-3) var(--aparture-space-4)',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--aparture-space-2)',
                          color: 'var(--aparture-ink)',
                          fontFamily: 'var(--aparture-font-sans)',
                          fontSize: 'var(--aparture-text-sm)',
                        }}
                      >
                        {expandedCategory === mainCategory ? (
                          <ChevronDown style={{ width: '16px', height: '16px' }} />
                        ) : (
                          <ChevronRight style={{ width: '16px', height: '16px' }} />
                        )}
                        <span style={{ fontWeight: 500, color: 'var(--aparture-ink)' }}>
                          {mainCategory}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-xs)',
                            color: 'var(--aparture-mute)',
                          }}
                        >
                          ({Object.keys(data.subcategories).length} categories)
                        </span>
                      </button>
                      <Button
                        onClick={() => addMainCategory(mainCategory)}
                        variant="ghost"
                        style={{
                          marginRight: 'var(--aparture-space-2)',
                          fontSize: 'var(--aparture-text-xs)',
                          padding: '4px 12px',
                          color: 'var(--aparture-accent)',
                        }}
                        title={`Add all ${mainCategory} categories`}
                      >
                        Add All
                      </Button>
                    </div>

                    {expandedCategory === mainCategory && (
                      <div style={{ background: 'var(--aparture-bg)' }}>
                        {Object.entries(data.subcategories).map(([_subKey, subData]) => (
                          <button
                            key={subData.code}
                            onClick={() => {
                              addCategory(subData.code);
                              setShowCategoryDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: 'var(--aparture-space-2) var(--aparture-space-8)',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontFamily: 'var(--aparture-font-sans)',
                              fontSize: 'var(--aparture-text-sm)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              color: 'var(--aparture-ink)',
                              opacity: config.selectedCategories.includes(subData.code) ? 0.5 : 1,
                            }}
                            disabled={config.selectedCategories.includes(subData.code)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: 'var(--aparture-ink)' }}>{subData.code}</span>
                              <span
                                style={{
                                  fontSize: 'var(--aparture-text-xs)',
                                  color: 'var(--aparture-mute)',
                                }}
                              >
                                {subData.name}
                              </span>
                            </div>
                            {config.selectedCategories.includes(subData.code) && (
                              <span
                                style={{
                                  fontSize: 'var(--aparture-text-xs)',
                                  color: 'var(--aparture-accent)',
                                }}
                              >
                                ✓ Selected
                              </span>
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

          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-mute)',
              marginTop: '4px',
            }}
          >
            Click categories to select them. Use &quot;Add All&quot; to select entire sections.
          </p>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              color: 'var(--aparture-mute)',
              marginBottom: 'var(--aparture-space-2)',
            }}
          >
            AI Model Configuration
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(1, 1fr)',
              gap: 'var(--aparture-space-4)',
            }}
            className="md:grid-cols-3"
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  fontWeight: 500,
                  color: 'var(--aparture-mute)',
                  marginBottom: 'var(--aparture-space-2)',
                }}
              >
                Quick Filter Model (Stage 1)
              </label>
              <Select
                value={config.filterModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, filterModel: e.target.value }))}
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </Select>
              <div
                style={{
                  marginTop: 'var(--aparture-space-2)',
                  padding: 'var(--aparture-space-2)',
                  background: 'var(--aparture-bg)',
                  borderRadius: '4px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                    margin: 0,
                  }}
                >
                  {AVAILABLE_MODELS.find((m) => m.id === config.filterModel)?.description}
                </p>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  fontWeight: 500,
                  color: 'var(--aparture-mute)',
                  marginBottom: 'var(--aparture-space-2)',
                }}
              >
                Abstract Scoring Model (Stage 2)
              </label>
              <Select
                value={config.scoringModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, scoringModel: e.target.value }))}
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </Select>
              <div
                style={{
                  marginTop: 'var(--aparture-space-2)',
                  padding: 'var(--aparture-space-2)',
                  background: 'var(--aparture-bg)',
                  borderRadius: '4px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                    margin: 0,
                  }}
                >
                  {AVAILABLE_MODELS.find((m) => m.id === config.scoringModel)?.description}
                </p>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  fontWeight: 500,
                  color: 'var(--aparture-mute)',
                  marginBottom: 'var(--aparture-space-2)',
                }}
              >
                Deep PDF Analysis Model (Stage 3)
              </label>
              <Select
                value={config.pdfModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, pdfModel: e.target.value }))}
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.filter((m) => m.supportsPDF).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </Select>
              <div
                style={{
                  marginTop: 'var(--aparture-space-2)',
                  padding: 'var(--aparture-space-2)',
                  background: 'var(--aparture-bg)',
                  borderRadius: '4px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                    margin: 0,
                  }}
                >
                  {AVAILABLE_MODELS.find((m) => m.id === config.pdfModel)?.description}
                </p>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  fontWeight: 500,
                  color: 'var(--aparture-mute)',
                  marginBottom: 'var(--aparture-space-2)',
                }}
              >
                Briefing Model (synthesis + suggest)
              </label>
              <Select
                value={config.briefingModel ?? config.pdfModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, briefingModel: e.target.value }))}
                disabled={processing.isRunning}
              >
                {AVAILABLE_MODELS.filter((m) => m.supportsPDF).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </Select>
              <div
                style={{
                  marginTop: 'var(--aparture-space-2)',
                  padding: 'var(--aparture-space-2)',
                  background: 'var(--aparture-bg)',
                  borderRadius: '4px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-mute)',
                    margin: 0,
                  }}
                >
                  {
                    AVAILABLE_MODELS.find((m) => m.id === (config.briefingModel ?? config.pdfModel))
                      ?.description
                  }
                </p>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 'var(--aparture-space-3)',
              padding: 'var(--aparture-space-3)',
              background: 'color-mix(in srgb, var(--aparture-accent) 8%, var(--aparture-surface))',
              border: '1px solid color-mix(in srgb, var(--aparture-accent) 25%, transparent)',
              borderRadius: '4px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                margin: 0,
              }}
            >
              <strong>Tip:</strong> Use cheaper models for early filtering and scoring stages, and
              more expensive models for analyzing PDFs to optimize cost while maintaining accuracy.
            </p>
          </div>

          <div
            style={{
              marginTop: 'var(--aparture-space-4)',
              padding: 'var(--aparture-space-3)',
              background: 'var(--aparture-bg)',
              border: '1px solid var(--aparture-hairline)',
              borderRadius: '4px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                fontWeight: 500,
                color: 'var(--aparture-mute)',
                marginBottom: 'var(--aparture-space-2)',
              }}
            >
              Briefing hallucination check
            </p>
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                marginBottom: 'var(--aparture-space-3)',
              }}
            >
              After a briefing is generated, a second model call audits it for unsupported claims.
              If the check flags problems, the briefing is regenerated up to one additional time
              based on the criteria below.
            </p>
          </div>

          {/* Review & confirmation */}
          <div
            style={{
              marginTop: 'var(--aparture-space-6)',
              padding: 'var(--aparture-space-4)',
              background: 'var(--aparture-surface)',
              border: '1px solid var(--aparture-hairline)',
              borderRadius: '4px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
                marginBottom: 'var(--aparture-space-3)',
              }}
            >
              Review & confirmation
            </p>
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
                marginBottom: 'var(--aparture-space-4)',
              }}
            >
              Training wheels — turn these off as you build trust in your pipeline setup.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--aparture-space-3)',
              }}
            >
              <Checkbox
                label="Pause after filter to review overrides"
                checked={config.pauseAfterFilter ?? true}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, pauseAfterFilter: e.target.checked }))
                }
                disabled={processing.isRunning}
              />
              <Checkbox
                label="Auto-retry briefing if hallucination check returns YES"
                checked={config.briefingRetryOnYes ?? true}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, briefingRetryOnYes: e.target.checked }))
                }
                disabled={processing.isRunning}
              />
              <Checkbox
                label="Auto-retry briefing if hallucination check returns MAYBE"
                checked={config.briefingRetryOnMaybe ?? false}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, briefingRetryOnMaybe: e.target.checked }))
                }
                disabled={processing.isRunning}
              />
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              color: 'var(--aparture-mute)',
              padding: 0,
            }}
          >
            {showAdvanced ? (
              <ChevronDown style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            ) : (
              <ChevronRight style={{ width: '16px', height: '16px', marginRight: '4px' }} />
            )}
            Advanced Options
          </button>

          {showAdvanced && (
            <div
              style={{
                marginTop: 'var(--aparture-space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--aparture-space-4)',
                paddingLeft: 'var(--aparture-space-4)',
                borderLeft: '2px solid var(--aparture-hairline)',
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    fontWeight: 600,
                    color: 'var(--aparture-mute)',
                    marginBottom: 'var(--aparture-space-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Query Options
                </p>
                <div style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Days to Look Back
                    </label>
                    <Input
                      type="number"
                      value={config.daysBack}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          daysBack: parseInt(e.target.value) || 7,
                        }))
                      }
                      min="1"
                      max="30"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      ArXiv search range
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Correction Attempts
                    </label>
                    <Input
                      type="number"
                      value={config.maxCorrections}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxCorrections: parseInt(e.target.value) || 1,
                        }))
                      }
                      min="0"
                      max="5"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Fix malformed responses
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Retry Attempts
                    </label>
                    <Input
                      type="number"
                      value={config.maxRetries}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxRetries: parseInt(e.target.value) || 3,
                        }))
                      }
                      min="0"
                      max="10"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Retry failed API calls
                    </p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 'var(--aparture-space-4)',
                  paddingTop: 'var(--aparture-space-4)',
                  borderTop: '1px solid var(--aparture-hairline)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    fontWeight: 600,
                    color: 'var(--aparture-mute)',
                    marginBottom: 'var(--aparture-space-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Filter Options
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--aparture-space-4)',
                    alignItems: 'flex-end',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Filter Batch Size
                    </label>
                    <Input
                      type="number"
                      value={config.filterBatchSize}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          filterBatchSize: parseInt(e.target.value) || 3,
                        }))
                      }
                      min="1"
                      max="20"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Papers per API call
                    </p>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Categories to Process
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--aparture-space-4)',
                        padding: '6px 0',
                      }}
                    >
                      {['YES', 'MAYBE', 'NO'].map((category) => (
                        <Checkbox
                          key={category}
                          label={category}
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
                          disabled={processing.isRunning}
                        />
                      ))}
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Filter results to score
                    </p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 'var(--aparture-space-4)',
                  paddingTop: 'var(--aparture-space-4)',
                  borderTop: '1px solid var(--aparture-hairline)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--aparture-space-2)',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--aparture-font-sans)',
                      fontSize: 'var(--aparture-text-xs)',
                      fontWeight: 600,
                      color: 'var(--aparture-mute)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}
                  >
                    Abstract Scoring Options
                  </p>
                  <Checkbox
                    label="Enable Post-Processing"
                    checked={config.enableScorePostProcessing}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        enableScorePostProcessing: e.target.checked,
                      }))
                    }
                    disabled={processing.isRunning}
                  />
                </div>
                <div style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Scoring Batch Size
                    </label>
                    <Input
                      type="number"
                      value={config.scoringBatchSize}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          scoringBatchSize: parseInt(e.target.value) || 3,
                        }))
                      }
                      min="1"
                      max="10"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Papers per API call
                    </p>
                  </div>
                  {config.enableScorePostProcessing && (
                    <>
                      <div style={{ flex: 1 }}>
                        <label
                          style={{
                            display: 'block',
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-sm)',
                            fontWeight: 500,
                            color: 'var(--aparture-mute)',
                            marginBottom: '4px',
                          }}
                        >
                          Review Batch Size
                        </label>
                        <Input
                          type="number"
                          value={config.postProcessingBatchSize}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              postProcessingBatchSize: parseInt(e.target.value) || 5,
                            }))
                          }
                          min="3"
                          max="10"
                          disabled={processing.isRunning}
                        />
                        <p
                          style={{
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-xs)',
                            color: 'var(--aparture-mute)',
                            marginTop: '4px',
                          }}
                        >
                          Papers per comparison
                        </p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label
                          style={{
                            display: 'block',
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-sm)',
                            fontWeight: 500,
                            color: 'var(--aparture-mute)',
                            marginBottom: '4px',
                          }}
                        >
                          Papers to Review
                        </label>
                        <Input
                          type="number"
                          value={config.postProcessingCount}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              postProcessingCount: parseInt(e.target.value) || 50,
                            }))
                          }
                          min="5"
                          max="200"
                          disabled={processing.isRunning}
                        />
                        <p
                          style={{
                            fontFamily: 'var(--aparture-font-sans)',
                            fontSize: 'var(--aparture-text-xs)',
                            color: 'var(--aparture-mute)',
                            marginTop: '4px',
                          }}
                        >
                          Top papers to post-process
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {config.enableScorePostProcessing && (
                  <div
                    style={{
                      background: 'var(--aparture-bg)',
                      borderRadius: '4px',
                      padding: 'var(--aparture-space-2)',
                      marginTop: 'var(--aparture-space-2)',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        margin: 0,
                      }}
                    >
                      Post-processing reviews initial scores for consistency by comparing papers in
                      batches. This helps correct scoring errors from complex research criteria.
                    </p>
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: 'var(--aparture-space-4)',
                  paddingTop: 'var(--aparture-space-4)',
                  borderTop: '1px solid var(--aparture-hairline)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    fontWeight: 600,
                    color: 'var(--aparture-mute)',
                    marginBottom: 'var(--aparture-space-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  PDF Analysis Options
                </p>
                <div style={{ display: 'flex', gap: 'var(--aparture-space-4)' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Papers to Analyze
                    </label>
                    <Input
                      type="number"
                      value={config.maxDeepAnalysis}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          maxDeepAnalysis: parseInt(e.target.value) || 30,
                        }))
                      }
                      min="1"
                      max="100"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Number of PDFs to analyze
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-sm)',
                        fontWeight: 500,
                        color: 'var(--aparture-mute)',
                        marginBottom: '4px',
                      }}
                    >
                      Summaries to Output
                    </label>
                    <Input
                      type="number"
                      value={config.finalOutputCount}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          finalOutputCount: parseInt(e.target.value) || 15,
                        }))
                      }
                      min="1"
                      max="50"
                      disabled={processing.isRunning}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--aparture-font-sans)',
                        fontSize: 'var(--aparture-text-xs)',
                        color: 'var(--aparture-mute)',
                        marginTop: '4px',
                      }}
                    >
                      Final papers to display
                    </p>
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
